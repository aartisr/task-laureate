const defaultDestination = 'http://localhost:5173/capture';

async function captureDestination() {
  const { destination } = await chrome.storage.sync.get({ destination: defaultDestination });
  try {
    const url = new URL(destination);
    return `${url.origin}${url.pathname.replace(/\/$/, '') || '/capture'}`;
  } catch {
    return defaultDestination;
  }
}

async function openCapture(info, tab) {
  const destination = await captureDestination();
  const text = info.selectionText || info.linkUrl || tab?.title || tab?.url || '';
  const sourceUrl = info.linkUrl || tab?.url || '';
  chrome.tabs.create({ url: `${destination}?text=${encodeURIComponent(text)}&url=${encodeURIComponent(sourceUrl)}` });
}

chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.create({ id: 'capture-selection', title: 'Capture in Task-Laureate', contexts: ['selection', 'page', 'link'] }));
chrome.contextMenus.onClicked.addListener((info, tab) => void openCapture(info, tab));
chrome.action.onClicked.addListener((tab) => void openCapture({}, tab));
