document.addEventListener('DOMContentLoaded', () => {
  loadHighlights();
  loadApiKey();

  document.getElementById('save-key-btn').addEventListener('click', saveApiKey);
  document.getElementById('clear-all-btn').addEventListener('click', clearAll);
});

// ── API Key ─────────────────────────────────────────────

function loadApiKey() {
  chrome.storage.local.get(['openai_api_key'], (result) => {
    if (result.openai_api_key) {
      document.getElementById('api-key-input').value = result.openai_api_key;
    }
  });
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  chrome.storage.local.set({ openai_api_key: key }, () => {
    const btn = document.getElementById('save-key-btn');
    const original = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

// ── Load & Render ────────────────────────────────────────

function loadHighlights() {
  chrome.storage.local.get(['highlights'], (result) => {
    const highlights = result.highlights || [];
    renderHighlights(highlights);
  });
}

function renderHighlights(highlights) {
  const container = document.getElementById('highlights-container');
  const countEl = document.getElementById('highlight-count');

  countEl.textContent = highlights.length === 1
    ? '1 highlight'
    : `${highlights.length} highlights`;

  if (highlights.length === 0) {
    container.innerHTML = `
      <div id="empty-state">
        <div class="empty-icon">&#128220;</div>
        <p>No highlights yet.</p>
        <p class="empty-hint">Select text on any page — a popup will appear to save it.</p>
      </div>`;
    return;
  }

  container.innerHTML = '';
  highlights.forEach((h) => {
    container.appendChild(createCard(h));
  });
}

function createCard(highlight) {
  const card = document.createElement('div');
  card.className = 'highlight-card';
  card.dataset.id = highlight.id;

  const date = new Date(highlight.timestamp).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const rawUrl = highlight.url || '';
  const displayUrl = rawUrl.replace(/^https?:\/\//, '').substring(0, 45);
  const safeUrl = sanitizeUrl(rawUrl);
  const safeDisplayUrl = escapeHtml(displayUrl);
  const safeText = escapeHtml(highlight.text);

  card.innerHTML = `
    <div class="highlight-text">
      <span class="highlight-quote">&ldquo;</span>${safeText}<span class="highlight-quote">&rdquo;</span>
    </div>
    <div class="highlight-meta">
      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(rawUrl)}">${safeDisplayUrl}</a>
      <span class="meta-dot">·</span>
      <span>${escapeHtml(date)}</span>
    </div>
    <div class="highlight-actions">
      <button class="btn-delete">Delete</button>
      <button class="btn-summarize">✨ Summarize</button>
    </div>
  `;

  card.querySelector('.btn-delete').addEventListener('click', () => {
    deleteHighlight(highlight.id, card);
  });

  card.querySelector('.btn-summarize').addEventListener('click', () => {
    summarizeHighlight(highlight, card);
  });

  return card;
}

// ── Delete ───────────────────────────────────────────────

function deleteHighlight(id, card) {
  card.style.opacity = '0.4';
  card.style.transition = 'opacity 0.2s';

  chrome.storage.local.get(['highlights'], (result) => {
    const highlights = (result.highlights || []).filter((h) => h.id !== id);
    chrome.storage.local.set({ highlights }, loadHighlights);
  });
}

function clearAll() {
  if (!confirm('Delete all saved highlights? This cannot be undone.')) return;
  chrome.storage.local.set({ highlights: [] }, loadHighlights);
}

// ── AI Summarize ─────────────────────────────────────────

async function summarizeHighlight(highlight, card) {
  const { openai_api_key: apiKey } = await storageGet(['openai_api_key']);

  if (!apiKey) {
    alert('Please enter and save your OpenAI API key at the top of this panel.');
    return;
  }

  const btn = card.querySelector('.btn-summarize');
  btn.textContent = 'Summarizing…';
  btn.disabled = true;

  // Remove any existing summary
  const existing = card.querySelector('.summary-box');
  if (existing) existing.remove();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a concise summarizer. Given a highlighted text excerpt, write a 1–2 sentence summary of its key point.'
          },
          {
            role: 'user',
            content: highlight.text
          }
        ],
        max_tokens: 120,
        temperature: 0.4
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message || `HTTP ${response.status}`;
      throw new Error(msg);
    }

    const summary = data.choices?.[0]?.message?.content?.trim() || 'No summary returned.';
    appendSummary(card, summary, false);

  } catch (err) {
    appendSummary(card, 'Error: ' + err.message, true);
  }

  btn.textContent = '✨ Summarize';
  btn.disabled = false;
}

function appendSummary(card, text, isError) {
  const box = document.createElement('div');
  box.className = 'summary-box' + (isError ? ' error' : '');
  box.textContent = text;
  card.appendChild(box);
}

// ── Helpers ──────────────────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return escapeHtml(url);
    }
  } catch (_) {}
  return '#';
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
