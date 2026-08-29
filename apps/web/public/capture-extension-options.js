const field = document.querySelector('#destination');
const status = document.querySelector('#status');
chrome.storage.sync.get({ destination: 'http://localhost:5173/capture' }).then(({ destination }) => { field.value = destination; });
document.querySelector('#save').addEventListener('click', async () => {
  try { const url = new URL(field.value); await chrome.storage.sync.set({ destination: `${url.origin}${url.pathname.replace(/\/$/, '') || '/capture'}` }); status.textContent = 'Saved. Capture will open here.'; }
  catch { status.textContent = 'Enter a complete URL, such as https://tasks.example.com/capture.'; }
});
