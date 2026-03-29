(() => {
  let tooltip = null;

  document.addEventListener('mouseup', (e) => {
    // If the mouseup is on our tooltip, ignore it — click handler will handle it
    if (tooltip && tooltip.contains(e.target)) return;

    // Small delay so selection is finalized
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection ? selection.toString().trim() : '';

      removeTooltip();

      if (selectedText.length > 0 && selectedText.length <= 5000) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        showTooltip(rect, selectedText);
      }
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (tooltip && !tooltip.contains(e.target)) {
      removeTooltip();
    }
  });

  function showTooltip(rect, text) {
    tooltip = document.createElement('div');
    tooltip.id = 'hs-tooltip';
    tooltip.innerHTML = `
      <span class="hs-label">Save Highlight?</span>
      <button id="hs-save-btn">Save</button>
      <button id="hs-cancel-btn">✕</button>
    `;

    document.body.appendChild(tooltip);

    const tooltipWidth = tooltip.offsetWidth || 220;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let left = rect.left + scrollX + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top + scrollY - 52;

    if (left < 8) left = 8;
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;
    if (top < scrollY + 8) top = rect.bottom + scrollY + 8;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    document.getElementById('hs-save-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const capturedText = text; // capture before tooltip is removed
      removeTooltip();
      window.getSelection().removeAllRanges();
      saveHighlight(capturedText);
    });

    document.getElementById('hs-cancel-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTooltip();
      window.getSelection().removeAllRanges();
    });
  }

  function removeTooltip() {
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  function saveHighlight(text) {
    const highlight = {
      id: Date.now(),
      text: text,
      url: window.location.href,
      title: document.title || window.location.hostname,
      timestamp: Date.now()
    };

    try {
      chrome.storage.local.get(['highlights'], (result) => {
        if (chrome.runtime.lastError) {
          showFeedback('⚠ Reload page to reactivate extension', '#e67e22');
          return;
        }
        const highlights = result.highlights || [];
        highlights.unshift(highlight);
        chrome.storage.local.set({ highlights }, () => {
          if (chrome.runtime.lastError) {
            showFeedback('⚠ Reload page to reactivate extension', '#e67e22');
            return;
          }
          showFeedback('✓ Highlight saved!', '#4CAF50');
        });
      });
    } catch (_) {
      showFeedback('⚠ Reload page to reactivate extension', '#e67e22');
    }
  }

  function showFeedback(message, color) {
    const existing = document.getElementById('hs-feedback');
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.id = 'hs-feedback';
    feedback.textContent = message;
    feedback.style.background = color;
    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.style.opacity = '0';
      setTimeout(() => feedback.remove(), 400);
    }, 2000);
  }
})();
