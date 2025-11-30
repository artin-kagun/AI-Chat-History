document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refresh-btn');
  const listContainer = document.getElementById('list-container');

  function showStatus(msg, color = '#ccc') {
    listContainer.innerHTML = `<div style="padding:10px; color:${color}; font-size:12px;">${msg}</div>`;
  }

  function isSupportedUrl(url) {
    if (!url) return false;
    return url.includes('gemini.google.com') || url.includes('chatgpt.com') || url.includes('chat.openai.com');
  }

  // ★全履歴読み込み関数
  async function fetchAllHistory() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !isSupportedUrl(tab.url)) {
      showStatus('Gemini または ChatGPT の<br>タブを開いてください', '#777');
      return;
    }

    // UIをロード中に変更
    refreshBtn.disabled = true;
    refreshBtn.textContent = '全履歴を読込中...';
    refreshBtn.style.backgroundColor = '#555';
    showStatus('過去ログを遡って取得しています...<br>画面がスクロールしますがそのままお待ちください。', '#8ab4f8');

    // Content Scriptへ指令（LOAD_ALL_HISTORY）
    chrome.tabs.sendMessage(tab.id, { action: 'LOAD_ALL_HISTORY' }, (response) => {
      // 処理完了後の復帰
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'リスト更新 (全読込)';
      refreshBtn.style.backgroundColor = '#8ab4f8';

      if (chrome.runtime.lastError) {
        showStatus('エラー: リロードしてください', 'red');
        return;
      }

      renderList(response, tab.id);
    });
  }

  function renderList(questions, tabId) {
    listContainer.innerHTML = '';
    if (!questions || questions.length === 0) {
      listContainer.innerHTML = '<div class="no-data" style="padding:10px; color:#999">質問が見つかりません</div>';
      return;
    }
    // ... (以下、描画ロジックは変更なし) ...
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

  // 自動更新等のリスナー
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'QUESTIONS_UPDATED') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && sender.tab && activeTab.id === sender.tab.id) {
          renderList(message.data, activeTab.id);
        }
      });
    }
  });

  // タブ切り替え時は「簡易取得」を行う（いきなりスクロールするとうざいため）
  chrome.tabs.onActivated.addListener(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if(tab && isSupportedUrl(tab.url)) {
        // ここではLOAD_ALLではなく、GET_QUESTIONS(既存の軽い取得)を送るのがマナーだが
        // 今回はシンプルにするため簡易取得を送る
        chrome.tabs.sendMessage(tab.id, { action: 'GET_QUESTIONS' }, (resp) => {
            if(!chrome.runtime.lastError) renderList(resp, tab.id);
        });
    }
  });

  // ボタンクリック時は「全履歴取得」を実行
  refreshBtn.addEventListener('click', fetchAllHistory);
  
  // 初回ロード時も簡易取得
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if(tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_QUESTIONS' }, (resp) => {
          if(!chrome.runtime.lastError) renderList(resp, tabs[0].id);
      });
  });
});