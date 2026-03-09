// background.js — service worker, Pollinations.ai + Gmail API (OAuth2)

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
let _labelsCache = null;
let _authBlockedUntil = 0;
let _lastAuthError = '';

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

  if (message.type === 'AIMO_GMAIL') {
    handleGmailRequest(message.op, message.payload || {})
      .then(data => sendResponse({ ok: true, data }))
      .catch(e => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
});

async function handleGmailRequest(op, payload) {
  if (op === 'ensureLabel') {
    const labelName = String(payload.labelName || '').trim();
    if (!labelName) throw new Error('Missing label name');
    const labelId = await ensureGmailLabel(labelName);
    return { labelId };
  }

  if (op === 'applyLabelToThreads') {
    const labelId = String(payload.labelId || '').trim();
    const threadIds = Array.isArray(payload.threadIds) ? payload.threadIds.map(String).filter(Boolean) : [];
    if (!labelId) throw new Error('Missing label ID');
    if (!threadIds.length) return { applied: 0, failed: 0 };
    const result = await applyLabelToThreads(labelId, threadIds);
    return result;
  }

  if (op === 'clearAuthCache') {
    const token = await getAuthToken(false).catch(() => null);
    if (token) await removeCachedToken(token);
    return { ok: true };
  }

  if (op === 'pingAuth') {
    const token = await getAuthToken(true);
    return { ok: true, tokenPreview: token ? token.slice(0, 12) : '' };
  }

  throw new Error(`Unknown Gmail op: ${op}`);
}

async function ensureGmailLabel(name) {
  const labels = await listLabels();
  const existing = labels.find(l => (l.name || '').toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const created = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    body: JSON.stringify({
      name,
      messageListVisibility: 'show',
      labelListVisibility: 'labelShow'
    })
  });

  _labelsCache = null;
  if (!created?.id) throw new Error('Gmail API did not return label ID');
  return created.id;
}

async function applyLabelToThreads(labelId, threadIds) {
  const uniq = [...new Set(threadIds)];
  let applied = 0;
  let failed = 0;

  for (const threadId of uniq) {
    try {
      await gmailFetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}/modify`, {
        method: 'POST',
        body: JSON.stringify({ addLabelIds: [labelId] })
      });
      applied++;
    } catch (_) {
      failed++;
    }
    await sleep(30);
  }

  return { applied, failed };
}

async function listLabels() {
  if (_labelsCache) return _labelsCache;
  const data = await gmailFetch('https://gmail.googleapis.com/gmail/v1/users/me/labels');
  _labelsCache = data?.labels || [];
  return _labelsCache;
}

async function gmailFetch(url, init = {}, retry = true) {
  const token = await getAuthToken(false);
  const res = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });

  if (res.status === 401 && retry) {
    await removeCachedToken(token);
    await getAuthToken(true); // one interactive recovery attempt
    return gmailFetch(url, init, false);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}: ${body.slice(0, 180)}`);
  }

  if (res.status === 204) return {};
  return res.json().catch(() => ({}));
}

function getAuthToken(interactive) {
  return new Promise((resolve, reject) => {
    if (interactive && Date.now() < _authBlockedUntil) {
      return reject(new Error(_lastAuthError || 'OAuth temporarily blocked. Please wait a minute and retry.'));
    }

    chrome.identity.getAuthToken({ interactive, scopes: [GMAIL_SCOPE] }, token => {
      if (chrome.runtime.lastError) {
        const msg = String(chrome.runtime.lastError.message || 'OAuth failed');
        if (interactive && /invalid_request|deleted_client|not allowed|disallowed|popup|closed/i.test(msg)) {
          _authBlockedUntil = Date.now() + 60_000;
          _lastAuthError = msg;
        }
        return reject(new Error(msg));
      }
      if (!token) return reject(new Error('No OAuth token received'));
      _lastAuthError = '';
      resolve(token);
    });
  });
}

function removeCachedToken(token) {
  return new Promise(resolve => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

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
