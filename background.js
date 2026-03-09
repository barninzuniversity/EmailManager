// background.js — service worker
// Handles: (1) injecting app.js, (2) Pollinations AI relay, (3) OAuth token vending
//
// IMPORTANT: The service worker does NOT make any Gmail API fetch calls.
// All Gmail API calls (ensureLabel, applyLabel) happen in content.js, which
// runs in the page context and has no 30-second idle timeout.
// The service worker's only Gmail-related job is calling chrome.identity.getAuthToken
// which is a single fast operation (< 500ms when the token is already cached).

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Inject app.js into the Gmail tab ──────────────────────────
  if (message.type === 'AIMO_INJECT') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      files: ['app.js'],
    }).then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  // ── Relay AI prompt to Pollinations ──────────────────────────
  if (message.type === 'AIMO_CALL') {
    callWithRetry(message.prompt, message.detail || 'normal')
      .then(text => sendResponse({ ok: true, text }))
      .catch(e  => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  // ── Vend OAuth token to content.js ───────────────────────────
  // content.js uses this token to make ALL Gmail API fetch calls directly.
  // interactive=true means Chrome will show the consent popup on first use.
  // After the user approves, the token is cached; subsequent calls return
  // immediately (<1ms) with no popup shown again, unless revoked.
  if (message.type === 'AIMO_GMAIL_TOKEN') {
    const interactive = message.interactive !== false; // default true
    chrome.identity.getAuthToken({ interactive }, token => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || 'Unknown auth error';
        console.error('[AIMO background] getAuthToken error:', msg);
        sendResponse({ ok: false, error: 'Gmail auth error: ' + msg });
      } else {
        console.log('[AIMO background] getAuthToken success');
        sendResponse({ ok: true, token });
      }
    });
    return true;
  }

  // ── Invalidate a stale/revoked token (called by content.js on 401) ──
  if (message.type === 'AIMO_GMAIL_CLEAR_TOKEN') {
    chrome.identity.removeCachedAuthToken({ token: message.token }, () => {
      sendResponse({ ok: true });
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
