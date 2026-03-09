// background.js — service worker
// Handles: app.js injection, Pollinations AI relay, OAuth token vending

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Inject app.js ──────────────────────────────────────────
  if (message.type === 'AIMO_INJECT') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      files: ['app.js'],
    }).then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  // ── Pollinations AI relay ──────────────────────────────────
  if (message.type === 'AIMO_CALL') {
    callWithRetry(message.prompt, message.detail || 'normal')
      .then(text => sendResponse({ ok: true, text }))
      .catch(e  => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  // ── Token vend to content.js (NON-interactive by default) ──
  // content.js uses interactive:false — it only gets a cached token.
  // If no token is cached yet, it gets an error and tells the user
  // to click "Authorize Gmail" in the popup.
  // interactive:true is ONLY sent by popup.js's AIMO_AUTH handler below.
  if (message.type === 'AIMO_GMAIL_TOKEN') {
    const interactive = message.interactive === true; // default FALSE
    chrome.identity.getAuthToken({ interactive }, token => {
      if (chrome.runtime.lastError || !token) {
        void chrome.runtime.lastError;
        const msg = interactive
          ? (chrome.runtime.lastError?.message || 'Auth failed')
          : 'NOT_AUTHORIZED';
        sendResponse({ ok: false, error: msg });
      } else {
        sendResponse({ ok: true, token });
      }
    });
    return true;
  }

  // ── Clear stale token (called by content.js on 401) ────────
  if (message.type === 'AIMO_GMAIL_CLEAR_TOKEN') {
    chrome.identity.removeCachedAuthToken({ token: message.token }, () => {
      void chrome.runtime.lastError;
      sendResponse({ ok: true });
    });
    return true;
  }

  // ── Interactive OAuth — ONLY called from popup.js ──────────
  // popup.js sends this when the user clicks "Authorize Gmail".
  // This is the ONLY place interactive:true is used.
  // Must be triggered by a direct user click in an extension page.
  if (message.type === 'AIMO_AUTH') {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      if (chrome.runtime.lastError || !token) {
        const err = chrome.runtime.lastError?.message || 'No token returned';
        void chrome.runtime.lastError;
        sendResponse({ ok: false, error: err });
        return;
      }
      // Quick verify: hit /profile to confirm the token actually works
      fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
        headers: { 'Authorization': 'Bearer ' + token },
      }).then(r => {
        if (!r.ok) throw new Error('Gmail API returned HTTP ' + r.status);
        return r.json();
      }).then(profile => {
        sendResponse({ ok: true, email: profile.emailAddress || 'authorized' });
      }).catch(e => {
        sendResponse({ ok: false, error: 'Token ok but verify failed: ' + String(e) });
      });
    });
    return true;
  }

  // ── Non-interactive auth check (popup.js on open) ──────────
  // Returns immediately: authorized:true if a token is cached, false if not.
  if (message.type === 'AIMO_AUTH_CHECK') {
    chrome.identity.getAuthToken({ interactive: false }, token => {
      void chrome.runtime.lastError; // suppress "no token" — it's expected
      sendResponse({ ok: true, authorized: !!token });
    });
    return true;
  }
});

/* ═══════════════════════════════════════════════════════════════
   Pollinations.ai — AI inference
   ═══════════════════════════════════════════════════════════════ */

async function callWithRetry(prompt, detail, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const text = await callAI(prompt, detail);
      if (!text || text.trim().length < 2) {
        await sleep(1500 * (i + 1));
        lastErr = new Error('Empty response — Pollinations returned nothing, retrying…');
        continue;
      }
      return text;
    } catch (e) {
      lastErr = e;
      const msg = String(e);
      const retry = msg.includes('502') || msg.includes('503') || msg.includes('504')
                 || msg.includes('500') || msg.includes('network') || msg.includes('fetch');
      if (!retry) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw lastErr || new Error('All retries failed — please try again');
}

async function callAI(prompt, detail) {
  const system = detail === 'deep'
    ? 'You are an expert email analyst. Respond with valid JSON only. No markdown fences, no explanation.'
    : 'You are an email classifier. Respond with valid JSON only. No markdown, no extra text.';

  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.2,
      private: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${body.slice(0, 100)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
