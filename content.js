// content.js — isolated world bridge (MV3)
//
// This file runs as a content script (isolated world) inside Gmail.
// It bridges app.js (MAIN world) ↔ background.js (service worker).
//
// KEY DESIGN: ALL Gmail API fetch calls happen HERE, not in background.js.
// This eliminates the MV3 service-worker 30-second idle termination issue
// entirely. Content scripts live as long as the Gmail tab is open.
//
// background.js is only used for:
//   - chrome.identity.getAuthToken (requires the chrome.identity API)
//   - Pollinations AI relay
//   - app.js injection

(function () {
  if (window.__aimoInit) return;
  window.__aimoInit = true;

  // Inject app.js into MAIN world via background (bypasses Gmail page CSP)
  chrome.runtime.sendMessage({ type: 'AIMO_INJECT' }, () => { void chrome.runtime.lastError; });

  /* ─── OAuth token cache ──────────────────────────────────────────
   * Cached for this page session. On first use we ask background.js
   * (which calls chrome.identity.getAuthToken). On subsequent calls
   * we reuse the cached token. On a 401 we clear the cache and retry.
   */
  let _cachedToken = null;

  /**
   * Get the OAuth token.
   * background.js calls chrome.identity.getAuthToken — the only place
   * chrome.identity is available. One fast round-trip to the SW (~10ms
   * when token is already cached by Chrome).
   */
  function getToken(interactive = true) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'AIMO_GMAIL_TOKEN', interactive },
        response => {
          void chrome.runtime.lastError;
          if (response && response.ok) {
            _cachedToken = response.token;
            resolve(_cachedToken);
          } else {
            reject(new Error((response && response.error) || 'Could not get Gmail OAuth token'));
          }
        }
      );
    });
  }

  /**
   * Clear the cached token locally and in Chrome's identity cache.
   * Called whenever Gmail API returns 401.
   */
  function clearToken(token) {
    _cachedToken = null;
    chrome.runtime.sendMessage({ type: 'AIMO_GMAIL_CLEAR_TOKEN', token }, () => {
      void chrome.runtime.lastError;
    });
  }

  /* ─── Gmail API helpers (all fetch, no service worker) ──────────── */

  /**
   * Ensure a label named `name` exists. Returns the label ID.
   * If it already exists, returns its ID. Creates it otherwise.
   */
  async function ensureLabel(token, name) {
    // 1. List all labels
    const listRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
      headers: { 'Authorization': 'Bearer ' + token },
    });

    if (listRes.status === 401) throw new Error('401');
    if (!listRes.ok) throw new Error('labels.list failed: HTTP ' + listRes.status);

    const listData = await listRes.json();
    const existing = (listData.labels || []).find(
      l => l.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing.id;

    // 2. Create the label
    const createRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/labels', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    });

    if (createRes.status === 401) throw new Error('401');
    if (!createRes.ok) {
      const body = await createRes.text().catch(() => '');
      throw new Error('labels.create failed: HTTP ' + createRes.status + ' — ' + body.slice(0, 120));
    }

    const created = await createRes.json();
    return created.id;
  }

  /**
   * Apply `labelId` to each thread in `threadIds`.
   * Returns array of { threadId, ok, status }.
   */
  async function applyLabelToThreads(token, labelId, threadIds) {
    const results = [];

    for (const threadId of threadIds) {
      const res = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ addLabelIds: [labelId] }),
        }
      );

      if (res.status === 401) throw new Error('401');

      results.push({ threadId, ok: res.ok, status: res.status });

      // Respect Gmail API per-user rate limits
      await new Promise(r => setTimeout(r, 80));
    }

    return results;
  }

  /**
   * Top-level Gmail operation dispatcher.
   * Automatically retries once on a 401 (expired / revoked token).
   */
  async function handleGmailOp(op, data, retried = false) {
    // Reuse cached token if available; otherwise fetch a new one
    const token = _cachedToken || (await getToken(true));

    try {
      switch (op) {
        case 'checkAuth':
          // Just validates the token; no API call needed
          return { authorized: true };

        case 'ensureLabel':
          return await ensureLabel(token, data.name);

        case 'applyLabel':
          return await applyLabelToThreads(token, data.labelId, data.threadIds);

        default:
          throw new Error('Unknown Gmail op: ' + op);
      }
    } catch (e) {
      if (!retried && String(e).includes('401')) {
        // Token expired — clear cache, get a fresh one, and retry once
        clearToken(token);
        return handleGmailOp(op, data, true);
      }
      throw e;
    }
  }

  /* ─── Message bridge: window ↔ background ────────────────────── */

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.ns !== 'AIMO') return;

    // ── AI inference relay (unchanged) ──
    if (d.type === 'REQ') {
      chrome.runtime.sendMessage(
        { type: 'AIMO_CALL', prompt: d.prompt, detail: d.detail, id: d.id },
        response => {
          void chrome.runtime.lastError;
          window.postMessage({
            ns: 'AIMO', type: 'RES', id: d.id,
            ...(response || { ok: false, error: 'No response from background' }),
          }, '*');
        }
      );
      return;
    }

    // ── Gmail API requests — handled ENTIRELY in this content script ──
    // No service worker involved. handleGmailOp runs as a regular async
    // function in the content script context, which has no idle timeout.
    if (d.type === 'GMAIL_REQ') {
      handleGmailOp(d.op, d.data)
        .then(result => {
          window.postMessage({
            ns: 'AIMO', type: 'GMAIL_RES', id: d.id,
            ok: true, result,
          }, '*');
        })
        .catch(e => {
          window.postMessage({
            ns: 'AIMO', type: 'GMAIL_RES', id: d.id,
            ok: false, error: String(e),
          }, '*');
        });
    }
  });

  // ── Relay popup commands → app.js custom DOM events ──────────
  chrome.runtime.onMessage.addListener(msg => {
    const fire = (n, d) => document.dispatchEvent(new CustomEvent(n, d ? { detail: d } : undefined));
    if (msg.type === 'AIMO_TOGGLE')   fire('aimo:toggle');
    if (msg.type === 'AIMO_ANALYZE')  { fire('aimo:open'); setTimeout(() => fire('aimo:analyze'), 500); }
    if (msg.type === 'AIMO_BULK')     { fire('aimo:open'); setTimeout(() => fire('aimo:bulk', { count: msg.count || 20 }), 500); }
    if (msg.type === 'AIMO_MODEL')    fire('aimo:model', { model: msg.model });
  });
})();
