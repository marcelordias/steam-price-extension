// Cache configuration
const CACHE_CONFIG = {
  prices: {
    maxAge: 3600000, // 1 hour in milliseconds
    name: 'prices-cache'
  }
};

// Initialize caches when service worker starts
let caches = {
  prices: new Map()
};

// Load configuration files
async function loadJsonFile(filename) {
  try {
    const response = await fetch(chrome.runtime.getURL(filename));
    return await response.json();
  } catch (error) {
    console.error(`[Config] Error loading ${filename}:`, error);
    return null;
  }
}

// Load cached data from storage
async function initializeCaches() {
  try {
    const result = await chrome.storage.local.get(['pricesCache']);

    if (result.pricesCache) {
      caches.prices = new Map(JSON.parse(result.pricesCache));
      // Clean expired entries
      cleanCache('prices');
    }

    console.log('[Cache] Initialized with', caches.prices.size, 'price entries');
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
});
// Handle other actions if needed
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    console.log('[Init] Extension installed, setting up default configurations');

    try {
      // Load JSON configuration files
      const stores = await loadJsonFile('stores.json');
      const regions = await loadJsonFile('regions.json');
      const editions = await loadJsonFile('editions.json');
      const currencies = await loadJsonFile('currencies.json');
      const platforms = await loadJsonFile('platforms.json');

      // Extract checked values from each configuration
      const defaultConfig = {
        priceRange: { min: 0, max: 999 },
        stores: stores ? stores.stores.filter(item => item.checked).map(item => item.name) : ['Steam'],
        regions: regions ? regions.regions.filter(item => item.checked).map(item => item.name) : ['GLOBAL'],
        editions: editions ? editions.editions.filter(item => item.checked).map(item => item.name) : ['Standard'],
        currency: (currencies && currencies.currencies.find(c => c.checked)) ?
          currencies.currencies.find(c => c.checked).name : 'eur',
        platform: (platforms && platforms.platforms.find(p => p.checked)) ?
          platforms.platforms.find(p => p.checked).name : 'PC'
      };

      // Save to storage
      await chrome.storage.local.set(defaultConfig);
      console.log('[Init] Default configuration saved:', defaultConfig);
    } catch (error) {
      console.error('[Init] Error setting up default configuration:', error);
    }
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
}, 3600000);