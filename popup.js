// popup.js

let currentMode = 'quick';

// ── Auth UI elements ──────────────────────────────────────────
const authBanner = document.getElementById('auth-banner');
const authIco    = document.getElementById('auth-ico');
const authLbl    = document.getElementById('auth-lbl');
const authSub    = document.getElementById('auth-sub');
const btnAuth    = document.getElementById('btn-auth');

// ── Check Gmail tab ───────────────────────────────────────────
chrome.tabs.query({ url: 'https://mail.google.com/*' }, tabs => {
  const dot = document.getElementById('sdot');
  const txt = document.getElementById('stxt');
  if (tabs.length) {
    txt.textContent = 'Gmail is open ✓';
  } else {
    dot.classList.add('off');
    txt.textContent = 'Open Gmail first';
  }
});

// ── Check auth status on popup open ──────────────────────────
// Uses getAuthToken({ interactive:false }) via the service worker.
// This returns immediately with whether a token is cached — no popup, no hang.
chrome.runtime.sendMessage({ type: 'AIMO_AUTH_CHECK' }, res => {
  void chrome.runtime.lastError;
  if (res && res.authorized) {
    setAuthorized(true);
  } else {
    setAuthorized(false);
  }
});

function setAuthorized(authorized, email) {
  if (authorized) {
    authBanner.className = 'authorized';
    authIco.textContent  = '✅';
    authLbl.textContent  = 'Gmail authorized' + (email ? ' (' + email + ')' : '');
    authSub.textContent  = 'Labels will be applied via Gmail API';
    btnAuth.textContent  = '✓ Authorized';
    btnAuth.classList.add('done');
    btnAuth.disabled = true;
  } else {
    authBanner.className = 'unauthorized';
    authIco.textContent  = '🔐';
    authLbl.textContent  = 'Gmail not authorized';
    authSub.textContent  = 'Required for bulk labeling — click to authorize';
    btnAuth.textContent  = 'Authorize Gmail';
    btnAuth.classList.remove('done');
    btnAuth.disabled = false;
  }
}

// ── Authorize Gmail button ────────────────────────────────────
//
// WHY this is here and not in app.js or background.js:
// chrome.identity.getAuthToken({ interactive:true }) must be called from
// a Chrome extension page (popup/options) in direct response to a user click.
// Calling it from a service worker in response to a content script message
// (as the old code did) causes it to silently hang — Chrome doesn't reliably
// surface the OAuth consent popup from that context.
//
// Flow:
// 1. User clicks this button
// 2. popup.js sends AIMO_AUTH to background.js
// 3. background.js calls getAuthToken({ interactive:true })
// 4. Chrome shows the OAuth consent window (may close this popup)
// 5. User approves → token is cached in Chrome's identity cache
// 6. All subsequent getAuthToken({ interactive:false }) calls in background.js
//    return the cached token in < 5ms → no more timeouts
//
btnAuth.addEventListener('click', () => {
  btnAuth.disabled = true;
  btnAuth.textContent = '⏳ Opening auth…';
  authLbl.textContent = 'Waiting for authorization…';
  authSub.textContent = 'Approve the Google popup that opens';

  chrome.runtime.sendMessage({ type: 'AIMO_AUTH' }, res => {
    void chrome.runtime.lastError;
    // NOTE: This callback may never fire if the extension popup closes when
    // the OAuth consent window takes focus.  That's OK — the token IS cached
    // by the time the user approves.  When the user re-opens the popup,
    // the AIMO_AUTH_CHECK at the top of this file will detect it and show
    // "✅ Gmail authorized".
    if (res && res.ok) {
      setAuthorized(true, res.email);
      toast('✅ Gmail authorized — you can now use Bulk Organize!');
    } else if (res) {
      setAuthorized(false);
      toast('⚠ Auth failed: ' + (res.error || 'unknown error'));
    }
    // If res is undefined the popup closed before the callback fired —
    // that's expected.  The user will see the correct state when they
    // re-open the popup.
  });
});

// ── Action buttons ────────────────────────────────────────────
document.getElementById('btn-open').addEventListener('click', () => {
  send({ type: 'AIMO_TOGGLE' });
  toast('Sidebar toggled ✓');
  setTimeout(() => window.close(), 350);
});

document.getElementById('btn-analyze').addEventListener('click', () => {
  send({ type: 'AIMO_ANALYZE' });
  toast('Opening + analyzing…');
  setTimeout(() => window.close(), 450);
});

document.getElementById('btn-bulk').addEventListener('click', () => {
  send({ type: 'AIMO_BULK', count: 20 });
  toast('Starting bulk organize…');
  setTimeout(() => window.close(), 450);
});

// ── Mode cards ────────────────────────────────────────────────
document.querySelectorAll('.model-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentMode = card.dataset.model;
    chrome.storage.local.set({ aimoMode: currentMode });
    const modeMap = { quick: 'claude-haiku-4-5', balanced: 'claude-sonnet-4-6', deep: 'claude-opus-4-6' };
    send({ type: 'AIMO_MODEL', model: modeMap[currentMode] });
    toast('Mode: ' + card.querySelector('.mc-lbl').textContent + ' ✓');
  });
});

// Load saved mode
chrome.storage.local.get(['aimoMode'], res => {
  if (res.aimoMode) {
    currentMode = res.aimoMode;
    document.querySelectorAll('.model-card').forEach(c => c.classList.toggle('active', c.dataset.model === currentMode));
  }
});

// ── Helpers ───────────────────────────────────────────────────
function send(message) {
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, tabs => {
    if (!tabs.length) return;
    chrome.tabs.sendMessage(tabs[0].id, message, () => {
      if (chrome.runtime.lastError) {
        chrome.scripting.executeScript(
          { target: { tabId: tabs[0].id }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) return;
            setTimeout(() => chrome.tabs.sendMessage(tabs[0].id, message, () => void chrome.runtime.lastError), 800);
          }
        );
      }
    });
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
