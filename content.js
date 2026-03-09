// content.js — isolated world bridge (MV3)
//
// ALL Gmail API fetch calls happen here (no service worker timeout risk).
// background.js is only used for: app.js injection, Pollinations relay,
// and chrome.identity.getAuthToken (which requires the identity API).
//
// KEY RULE: getToken() is ALWAYS called with interactive:false here.
// Interactive OAuth must only happen from popup.js → AIMO_AUTH.
// If no token is cached, we return NOT_AUTHORIZED so app.js can show
// a clear message: "open popup and click Authorize Gmail".

(function () {
  if (window.__aimoInit) return;
  window.__aimoInit = true;

  // Inject app.js into MAIN world via background (bypasses Gmail CSP)
  chrome.runtime.sendMessage({ type: 'AIMO_INJECT' }, () => { void chrome.runtime.lastError; });

  /* ─── OAuth token cache ─────────────────────────────────────── */
  let _cachedToken = null;

  /**
   * Get the OAuth token — NON-INTERACTIVE ONLY.
   * Returns the cached token from Chrome's identity cache.
   * If no token is cached, rejects with NOT_AUTHORIZED.
   * The user must click "Authorize Gmail" in the popup first.
   */
  function getToken() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'AIMO_GMAIL_TOKEN', interactive: false }, // NEVER interactive here
        response => {
          void chrome.runtime.lastError;
          if (response && response.ok && response.token) {
            _cachedToken = response.token;
            resolve(_cachedToken);
          } else {
            const err = (response && response.error) || 'NOT_AUTHORIZED';
            reject(new Error(err));
          }
        }
      );
    });
  }

  /**
   * Clear stale token locally and from Chrome's identity cache.
   * Called when Gmail API returns 401.
   */
  function clearToken(token) {
    _cachedToken = null;
    chrome.runtime.sendMessage(
      { type: 'AIMO_GMAIL_CLEAR_TOKEN', token },
      () => { void chrome.runtime.lastError; }
    );
  }

  /* ─── Gmail API helpers (fetch in content script, no SW) ─────── */

  async function ensureLabel(token, name) {
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
      await new Promise(r => setTimeout(r, 80));
    }
    return results;
  }

  /**
   * Top-level dispatcher. Uses ONLY cached token (interactive:false).
   * On 401, clears token and retries once with a fresh cached token.
   * If still no token → throws NOT_AUTHORIZED.
   */
  async function handleGmailOp(op, data, retried = false) {
    let token;
    try {
      token = _cachedToken || (await getToken()); // always interactive:false
    } catch (e) {
      throw new Error('NOT_AUTHORIZED: Open the extension popup and click "Authorize Gmail" first.');
    }

    try {
      switch (op) {
        case 'checkAuth':
          // Lightweight check — just confirms token exists
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
        clearToken(token);
        return handleGmailOp(op, data, true);
      }
      throw e;
    }
  }

  /* ─── Message bridge: window (app.js) ↔ background ─────────── */

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.ns !== 'AIMO') return;

    // AI inference relay
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

    // Gmail API — runs entirely in content script, no service worker
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

  // Relay popup commands → app.js custom DOM events
  chrome.runtime.onMessage.addListener(msg => {
    const fire = (n, d) => document.dispatchEvent(new CustomEvent(n, d ? { detail: d } : undefined));
    if (msg.type === 'AIMO_TOGGLE')  fire('aimo:toggle');
    if (msg.type === 'AIMO_ANALYZE') { fire('aimo:open'); setTimeout(() => fire('aimo:analyze'), 500); }
    if (msg.type === 'AIMO_BULK')    { fire('aimo:open'); setTimeout(() => fire('aimo:bulk', { count: msg.count || 20 }), 500); }
    if (msg.type === 'AIMO_MODEL')   fire('aimo:model', { model: msg.model });
  });
})();
