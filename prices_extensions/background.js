chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensão instalada com sucesso!");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchPrices") {
    fetch(message.url)
      .then(response => response.text())
      .then(html => sendResponse({ html }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Indicates that the response will be sent asynchronously
  }
});