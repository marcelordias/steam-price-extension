// Common options and headers reused across requests
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const STEAMDB_HEADERS = {
  Accept: 'application/json',
  'X-Requested-With': 'SteamDB',
};

// Listener for Chrome messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const startTime = performance.now();
  console.log(message);
  if (message.action === "fetchPrices") {
    fetchPrices(message.data)
      .then(data => {
        logPerformance("fetchPrices", startTime);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logPerformance("fetchPrices (error)", startTime);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate asynchronous response
  }

  if (message.action === "GetAppPrice") {
    GetAppPrice(message.data)
      .then(data => {
        logPerformance("GetAppPrice", startTime);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logPerformance("GetAppPrice (error)", startTime);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate asynchronous response
  }
});

// Fetch prices with POST request
async function fetchPrices(data) {
  const authHeaders = await getAuthHeaders();
  console.log(authHeaders);
  const response = await fetch('https://steam-price-extension.onrender.com/api/prices', {
    method: 'POST',
    headers: { ...authHeaders },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

// Fetch app price from SteamDB
async function GetAppPrice({ appid, currency }) {
  const params = new URLSearchParams({
    appid: Number.parseInt(appid, 10),
    currency,
  });

  const response = await fetch(`https://steamdb.info/api/ExtensionAppPrice/?${params.toString()}`, {
    headers: STEAMDB_HEADERS,
  });

  return handleResponse(response);
}

// Handle response with status checks
async function handleResponse(response) {
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      console.warn('Rate limited. Retry after', retryAfter, 'seconds.');
    }
    if (response.status === 401) {
      // clear token and redirect to onboarding page
      chrome.storage.sync.remove(['authToken', 'authClientId'], () => {
        chrome.tabs.create({
          url: 'onboarding.html',
        });
      });
      throw new Error('Unauthorized - Please authenticate');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Parse Retry-After header
function parseRetryAfter(header) {
  const retryAfter = Number.parseInt(header, 10);
  return !Number.isNaN(retryAfter) && retryAfter > 0 ? retryAfter : 60; // Default to 60 seconds
}

// Log performance data for debugging
function logPerformance(action, startTime) {
  const duration = performance.now() - startTime;
  console.log(`${action} completed in ${duration.toFixed(2)}ms`);
}

async function getAuthHeaders() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['authToken', 'authClientId'], (result) => {
      resolve({
        'Content-Type': 'application/json',
        'x-api-key': `${result.authToken}`,
        'x-client-id': `${result.authClientId}`
      });
    });
  });
}
