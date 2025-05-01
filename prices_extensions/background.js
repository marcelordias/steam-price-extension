// Common options and headers reused across requests
const STEAMDB_HEADERS = {
  Accept: 'application/json',
  'X-Requested-With': 'SteamDB',
};

// Cache configuration
const CACHE_CONFIG = {
  prices: {
    maxAge: 3600000, // 1 hour in milliseconds
    name: 'prices-cache'
  },
  steamdb: {
    maxAge: 86400000, // 24 hours in milliseconds
    name: 'steamdb-cache'
  }
};

// Initialize caches when service worker starts
let caches = {
  prices: new Map(),
  steamdb: new Map()
};

// Load cached data from storage
async function initializeCaches() {
  try {
    const result = await chrome.storage.local.get(['pricesCache', 'steamdbCache']);

    if (result.pricesCache) {
      caches.prices = new Map(JSON.parse(result.pricesCache));
      // Clean expired entries
      cleanCache('prices');
    }

    if (result.steamdbCache) {
      caches.steamdb = new Map(JSON.parse(result.steamdbCache));
      // Clean expired entries
      cleanCache('steamdb');
    }

    console.log('[Cache] Initialized with', caches.prices.size, 'price entries and',
      caches.steamdb.size, 'SteamDB entries');
  } catch (error) {
    console.error('[Cache] Initialization error:', error);
  }
}

// Clean expired entries from cache
function cleanCache(cacheType) {
  const now = Date.now();
  const cache = caches[cacheType];
  const maxAge = CACHE_CONFIG[cacheType].maxAge;

  let expiredCount = 0;

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > maxAge) {
      cache.delete(key);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    console.log(`[Cache] Removed ${expiredCount} expired entries from ${cacheType} cache`);
    // Save updated cache
    persistCache(cacheType);
  }
}

// Save cache to storage
async function persistCache(cacheType) {
  const cache = caches[cacheType];
  const cacheData = JSON.stringify([...cache.entries()]);

  try {
    await chrome.storage.local.set({
      [`${cacheType}Cache`]: cacheData
    });
    console.log(`[Cache] Saved ${cache.size} entries to ${cacheType} cache`);
  } catch (error) {
    console.error(`[Cache] Error saving ${cacheType} cache:`, error);
  }
}

// Initialize caches when service worker starts
initializeCaches();

// Listener for Chrome messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const requestId = generateRequestId();
  const startTime = performance.now();

  console.log(`[${requestId}] Received message:`, message.action);

  if (message.action === "fetchPrices") {
    // Try to get from cache first
    const cacheKey = JSON.stringify(message.data);
    const cachedResponse = getCachedResponse('prices', cacheKey);

    if (cachedResponse) {
      console.log(`[${requestId}] Cache hit for fetchPrices`);
      logPerformance("fetchPrices (cached)", startTime, requestId);
      sendResponse({ success: true, data: cachedResponse, fromCache: true });
      return true;
    }

    fetchPrices(message.data, requestId)
      .then(data => {
        // Cache the successful response
        cacheResponse('prices', cacheKey, data);

        logPerformance("fetchPrices", startTime, requestId);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logPerformance("fetchPrices (error)", startTime, requestId);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate asynchronous response
  }

  if (message.action === "GetAppPrice") {
    // Try to get from cache first
    const cacheKey = JSON.stringify(message.data);
    const cachedResponse = getCachedResponse('steamdb', cacheKey);

    if (cachedResponse) {
      console.log(`[${requestId}] Cache hit for GetAppPrice`);
      logPerformance("GetAppPrice (cached)", startTime, requestId);
      sendResponse({ success: true, data: cachedResponse, fromCache: true });
      return true;
    }

    GetAppPrice(message.data, requestId)
      .then(data => {
        // Cache the successful response
        cacheResponse('steamdb', cacheKey, data);

        logPerformance("GetAppPrice", startTime, requestId);
        sendResponse({ success: true, data });
      })
      .catch(error => {
        logPerformance("GetAppPrice (error)", startTime, requestId);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicate asynchronous response
  }
});

// Get response from cache if valid
function getCachedResponse(cacheType, key) {
  const cache = caches[cacheType];
  const entry = cache.get(key);

  if (!entry) return null;

  // Check if entry is expired
  const now = Date.now();
  if (now - entry.timestamp > CACHE_CONFIG[cacheType].maxAge) {
    cache.delete(key);
    persistCache(cacheType);
    return null;
  }

  return entry.data;
}

// Cache response
function cacheResponse(cacheType, key, data) {
  caches[cacheType].set(key, {
    data,
    timestamp: Date.now()
  });

  // Persist cache if it's grown significantly
  if (caches[cacheType].size % 10 === 0) {
    persistCache(cacheType);
  }
}

// Generate unique request ID
function generateRequestId() {
  return Math.random().toString(36).substring(2, 8);
}

// Fetch prices with POST request
async function fetchPrices(data, requestId) {
  console.log(`[${requestId}] Fetching prices for: ${data.gameTitle}`);

  const response = await fetch('https://steam-price-extension.onrender.com/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return handleResponse(response, requestId);
}

// Fetch app price from SteamDB
async function GetAppPrice({ appid, currency }, requestId) {
  const params = new URLSearchParams({
    appid: Number.parseInt(appid, 10),
    currency,
  });

  console.log(`[${requestId}] Fetching SteamDB price for app: ${appid}, currency: ${currency}`);

  try {
    // Add retry logic with exponential backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`https://steamdb.info/api/ExtensionAppPrice/?${params.toString()}`, {
          headers: {
            ...STEAMDB_HEADERS,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });

        // Check for rate limiting
        if (response.status === 429) {
          // Increase the retry delay more significantly
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After')) || Math.max(5000, (2 ** attempt) * 2000);
          console.log(`[${requestId}] Rate limited, retrying after ${retryAfter}ms (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        if (attempt === 2) throw error;
        // Increase backoff time
        await new Promise(resolve => setTimeout(resolve, Math.max(3000, (2 ** attempt) * 2000)));
      }
    }
    throw new Error('Failed after 3 retry attempts');
  } catch (error) {
    console.error(`[${requestId}] Error fetching price history:`, error);
    // Return a formatted error that the UI can handle
    return { success: false, error: error.message };
  }
}

// Handle response with status checks
async function handleResponse(response, requestId) {
  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      console.warn(`[${requestId}] Rate limited. Retry after ${retryAfter} seconds.`);
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
function logPerformance(action, startTime, requestId) {
  const duration = performance.now() - startTime;
  console.log(`[${requestId}] ${action} completed in ${duration.toFixed(2)}ms`);
}

setInterval(() => {
  cleanCache('prices');
  cleanCache('steamdb');
}, 3600000);