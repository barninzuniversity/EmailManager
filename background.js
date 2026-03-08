// background.js — service worker, Pollinations.ai free API

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AIMO_INJECT') {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      world: 'MAIN',
      files: ['app.js'],
    }).then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (message.type === 'AIMO_CALL') {
    callWithRetry(message.prompt, message.detail || 'normal')
      .then(text => sendResponse({ ok: true, text }))
      .catch(e  => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

async function callWithRetry(prompt, detail, attempts = 4) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const text = await callAI(prompt, detail);
      if (!text || text.trim().length < 2) {
        // Empty response — wait and retry
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
        { role: 'user',   content: prompt }
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
