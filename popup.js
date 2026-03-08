// popup.js

let currentMode = 'quick';

// Check Gmail tab
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

// Buttons
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

// Mode cards
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
  setTimeout(() => t.classList.remove('show'), 2000);
}
