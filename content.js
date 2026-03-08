// content.js — isolated world bridge (MV3)

(function () {
  if (window.__aimoInit) return;
  window.__aimoInit = true;

  // Inject app.js into MAIN world via background (bypasses Gmail page CSP)
  chrome.runtime.sendMessage({ type: 'AIMO_INJECT' }, () => { void chrome.runtime.lastError; });

  // Relay AI requests: app.js window.postMessage → chrome.runtime → background
  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.ns !== 'AIMO' || d.type !== 'REQ') return;

    chrome.runtime.sendMessage(
      { type: 'AIMO_CALL', prompt: d.prompt, detail: d.detail, id: d.id },
      response => {
        void chrome.runtime.lastError;
        window.postMessage({
          ns: 'AIMO', type: 'RES', id: d.id,
          ...(response || { ok: false, error: 'No response from background' })
        }, '*');
      }
    );
  });

  // Relay popup commands → app.js custom DOM events
  chrome.runtime.onMessage.addListener(msg => {
    const fire = (n, d) => document.dispatchEvent(new CustomEvent(n, d ? { detail: d } : undefined));
    if (msg.type === 'AIMO_TOGGLE')   fire('aimo:toggle');
    if (msg.type === 'AIMO_ANALYZE')  { fire('aimo:open'); setTimeout(() => fire('aimo:analyze'), 500); }
    if (msg.type === 'AIMO_BULK')     { fire('aimo:open'); setTimeout(() => fire('aimo:bulk', { count: msg.count || 20 }), 500); }
    if (msg.type === 'AIMO_MODEL')    fire('aimo:model', { model: msg.model });
  });
})();
