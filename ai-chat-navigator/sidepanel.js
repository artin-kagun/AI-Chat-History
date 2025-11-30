document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-btn');
  const listContainer = document.getElementById('list-container');

  function showStatus(msg, color = '#ccc') {
    listContainer.innerHTML = `<div style="padding:10px; color:${color}; font-size:12px;">${msg}</div>`;
  }

  // URLが対応サイトかチェックする関数
  function isSupportedUrl(url) {
    if (!url) return false;
    return url.includes('gemini.google.com') || 
           url.includes('chatgpt.com') || 
           url.includes('chat.openai.com');
  }

  function renderList(questions, tabId) {
    listContainer.innerHTML = '';
    
    if (!questions || questions.length === 0) {
      listContainer.innerHTML = '<div class="no-data" style="padding:10px; color:#999">質問が見つかりません</div>';
      return;
    }

    questions.forEach((q, displayIndex) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'history-item';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'item-header';

      const titleSpan = document.createElement('div');
      titleSpan.className = 'title-text';
      titleSpan.textContent = `${displayIndex + 1}. ${q.text}`;

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'toggle-btn';
      toggleBtn.textContent = '▼';

      const fullTextDiv = document.createElement('div');
      fullTextDiv.className = 'full-text';
      fullTextDiv.textContent = q.text;

      headerDiv.addEventListener('click', (e) => {
        if (e.target === toggleBtn) return;
        chrome.tabs.sendMessage(tabId, { action: 'SCROLL_TO', originalIndex: q.originalIndex });
      });

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        itemDiv.classList.toggle('expanded');
        toggleBtn.textContent = itemDiv.classList.contains('expanded') ? '▲' : '▼';
      });

      headerDiv.appendChild(titleSpan);
      headerDiv.appendChild(toggleBtn);
      itemDiv.appendChild(headerDiv);
      itemDiv.appendChild(fullTextDiv);
      listContainer.appendChild(itemDiv);
    });
  }

  async function fetchQuestions() {
    if (listContainer.childElementCount === 0) {
      showStatus('データを取得中...');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // URLチェックをGemini/ChatGPT両対応に
    if (!tab || !isSupportedUrl(tab.url)) {
      showStatus('Gemini または ChatGPT の<br>タブを開いてください', '#777');
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'GET_QUESTIONS' }, (response) => {
      if (chrome.runtime.lastError) return;
      renderList(response, tab.id);
    });
  }

  // --- イベントリスナー ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'QUESTIONS_UPDATED') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        // 送信元のタブIDと現在のアクティブタブIDが一致する場合のみ更新
        if (activeTab && sender.tab && activeTab.id === sender.tab.id) {
          renderList(message.data, activeTab.id);
        }
      });
    }
  });

  chrome.tabs.onActivated.addListener(fetchQuestions);
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && isSupportedUrl(tab.url)) {
      fetchQuestions();
    }
  });

  refreshBtn.addEventListener('click', fetchQuestions);
  fetchQuestions();
});