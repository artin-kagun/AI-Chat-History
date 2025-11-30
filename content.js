console.log('🚀 AI Sidebar: Content Script Loaded');

// サイト判定
let TARGET_SELECTOR = '';
if (window.location.hostname.includes('google.com')) {
  TARGET_SELECTOR = 'user-query, .query-text';
} else {
  TARGET_SELECTOR = '[data-message-author-role="user"]';
}

let debounceTimer = null;
let lastDataStr = '';

// --- ヘルパー: スクロール可能なメイン要素を探す ---
function findMainScroller() {
  const allElements = document.querySelectorAll('*');
  let mainScroller = null;
  let maxScrollHeight = 0;

  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      if (el.scrollHeight > maxScrollHeight) {
        maxScrollHeight = el.scrollHeight;
        mainScroller = el;
      }
    }
  }
  // 見つからない場合はbody/documentElementを返す
  return mainScroller || document.documentElement || document.body;
}

// --- データ抽出 ---
function getQuestionsData() {
  if (!TARGET_SELECTOR) return [];
  const elements = document.querySelectorAll(TARGET_SELECTOR);
  const uniqueQuestions = [];
  const seenTexts = new Set();

  elements.forEach((el, index) => {
    const text = el.innerText.trim();
    if (!text || seenTexts.has(text)) return;
    seenTexts.add(text);
    uniqueQuestions.push({ text: text, originalIndex: index });
  });
  return uniqueQuestions;
}

// --- 自動更新通知 ---
function notifySidebar() {
  const data = getQuestionsData();
  const currentDataStr = JSON.stringify(data);
  if (currentDataStr === lastDataStr) return;
  lastDataStr = currentDataStr;
  chrome.runtime.sendMessage({ action: 'QUESTIONS_UPDATED', data: data }).catch(() => {});
}

// --- メッセージ受信 ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 通常取得
  if (request.action === 'GET_QUESTIONS') {
    const data = getQuestionsData();
    sendResponse(data);
  }

  // ★全履歴読み込み（スクロール遡行）
  else if (request.action === 'LOAD_ALL_HISTORY') {
    const scroller = findMainScroller();
    
    // 現在位置を記憶（処理後に戻すため）
    // ただしDOMが増えるので厳密に戻すのは難しいが、一番下に戻すのが無難
    const startScrollTop = scroller.scrollTop;

    console.log('🔄 全履歴読み込みを開始します...');
    
    // 再帰的にロードを行う関数
    const loadMore = () => {
      const preHeight = scroller.scrollHeight;
      scroller.scrollTop = 0; // 一番上へ

      // ロード待ち（1.5秒待機）
      setTimeout(() => {
        const postHeight = scroller.scrollHeight;
        
        // 高さが伸びていれば、まだ上に過去ログがある
        if (postHeight > preHeight) {
          console.log('📜 過去ログを検出、さらに読み込みます...');
          loadMore(); // 再帰呼び出し
        } else {
          // 高さが変わらなければロード完了
          console.log('✅ 全ロード完了');
          // 一番下に戻す（使い勝手のため）
          scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
          
          // データを返却
          const data = getQuestionsData();
          sendResponse(data);
        }
      }, 1500); // ネットワーク環境によってはここを長くする必要がある
    };

    loadMore();
    return true; // 非同期レスポンスのため必須
  }

  // ジャンプ
  else if (request.action === 'SCROLL_TO') {
    const elements = document.querySelectorAll(TARGET_SELECTOR);
    const target = elements[request.originalIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const originalBg = target.style.backgroundColor;
      target.style.transition = 'background-color 0.3s';
      target.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
      setTimeout(() => target.style.backgroundColor = originalBg || 'transparent', 1500);
    }
  }
});

// 監視
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(notifySidebar, 1500);
});
observer.observe(document.body, { childList: true, subtree: true });

// 右下ボタン（省略せずに入れておく）
(function addScrollBottomButton() {
  if (document.getElementById('my-last-question-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'my-last-question-btn';
  btn.innerText = '⬇'; 
  btn.title = '最後の質問へジャンプ';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '20px', width: '40px', height: '40px',
    borderRadius: '50%', border: 'none', backgroundColor: 'rgba(50, 50, 50, 0.8)',
    color: 'white', fontSize: '18px', cursor: 'pointer', zIndex: '9999',
    boxShadow: '0 2px 5px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  btn.onclick = () => {
    let s = window.location.hostname.includes('google.com') ? 'user-query, .query-text' : '[data-message-author-role="user"]';
    const all = document.querySelectorAll(s);
    if (all.length > 0) {
      const last = all[all.length - 1];
      last.scrollIntoView({ behavior: 'smooth', block: 'center' });
      last.style.transition = 'background-color 0.3s';
      last.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
      setTimeout(() => last.style.backgroundColor = 'transparent', 1500);
    }
  };
  document.body.appendChild(btn);
})();