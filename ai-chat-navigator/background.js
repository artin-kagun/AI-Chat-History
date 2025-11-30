// アイコンをクリックしたらサイドパネルを開く設定を有効にする
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});