console.log('🚀 AI Sidebar: Content Script Loaded on', window.location.hostname);

// --- サイト判定とセレクタ設定 ---
let TARGET_SELECTOR = '';

if (window.location.hostname.includes('google.com')) {
  // Gemini用
  TARGET_SELECTOR = 'user-query, .query-text';
} else {
  // ChatGPT用 ([data-message-author-role="user"] がユーザーの発言ブロック)
  TARGET_SELECTOR = '[data-message-author-role="user"]';
}

let debounceTimer = null;
let lastDataStr = ''; 

// データを抽出する共通関数
function getQuestionsData() {
  if (!TARGET_SELECTOR) return [];

  const elements = document.querySelectorAll(TARGET_SELECTOR);
  const uniqueQuestions = [];
  const seenTexts = new Set();

  elements.forEach((el, index) => {
    // ChatGPTは要素内に余計なメタデータが入る場合があるため、純粋なテキストを取得
    const text = el.innerText.trim();
    
    // 短すぎるものや重複はスキップ
    if (!text || seenTexts.has(text)) return;
    
    seenTexts.add(text);
    uniqueQuestions.push({
      text: text,
      originalIndex: index
    });
  });
  return uniqueQuestions;
}

// サイドパネルへデータを送る関数
function notifySidebar() {
  const data = getQuestionsData();
  const currentDataStr = JSON.stringify(data);

  if (currentDataStr === lastDataStr) return;
  lastDataStr = currentDataStr;
  
  console.log(`📡 自動更新: ${data.length}件送信 (${window.location.hostname})`);
  
  chrome.runtime.sendMessage({ 
    action: 'QUESTIONS_UPDATED', 
    data: data 
  }).catch(() => {});
}

// --- メッセージリスナー ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_QUESTIONS') {
    const data = getQuestionsData();
    lastDataStr = JSON.stringify(data);
    sendResponse(data);
  }

  else if (request.action === 'SCROLL_TO') {
    const elements = document.querySelectorAll(TARGET_SELECTOR);
    const target = elements[request.originalIndex];
    
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // ハイライト演出
      const originalBg = target.style.backgroundColor;
      target.style.transition = 'background-color 0.3s';
      // ダークモード対応のため、薄い黄色を半透明で乗せる
      target.style.backgroundColor = 'rgba(255, 215, 0, 0.2)'; 
      setTimeout(() => target.style.backgroundColor = originalBg || 'transparent', 1500);
    }
  }
});

// --- DOM監視 ---
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(notifySidebar, 1500);
});

observer.observe(document.body, { childList: true, subtree: true });