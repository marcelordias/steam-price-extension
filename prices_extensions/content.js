// Cache for previous requests
const priceCache = new Map();

// Storage and Filters
chrome.storage.local.get(
  ['priceRange', 'stores', 'regions', 'editions', 'currency', 'platform'],
  async (result) => {
    try {
      await fetchPricesWithFilters({
        priceRange: result.priceRange || { min: 0, max: 999 },
        stores: result.stores || [],
        regions: result.regions || [],
        editions: result.editions || [],
        currency: result.currency || '',
        platform: result.platform || '',
      });
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  }
);

// Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'applyFilters') {
    fetchPricesWithFilters(message.filters)
      .then((response) => sendResponse({ success: true, data: response }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

function extractGameTitle() {
  const appHubName = document.querySelector('.apphub_AppName');

  const pageTitle = document.title.split('::')[0]?.trim() ||
    document.title.split('-')[0]?.trim() ||
    document.title;

  const metaTitle = document.querySelector('meta[property="og:title"]')?.content;

  // Choose the best available source
  let rawTitle = appHubName?.textContent || metaTitle || pageTitle || '';

  // Clean the title but preserve meaningful characters
  // Only remove characters that might interfere with search
  let cleanTitle = rawTitle
    .replace(/[™®©]/g, '')                      // Remove trademark/copyright symbols
    .replace(/\s+/g, ' ')                       // Normalize whitespace
    .replace(/\s*[-:]\s*(Steam|Valve).*/i, '') // Remove "- Steam" or ": Valve" suffixes
    .replace(/[:;]/g, '')                      // Replace colons and semicolons with spaces
    .trim();

  console.log(`[Title Extraction] Raw: "${rawTitle}", Cleaned: "${cleanTitle}"`);

  if (!cleanTitle) {
    throw new Error('Game title could not be determined');
  }

  return cleanTitle;
}

async function fetchPricesWithFilters(filters) {
  try {
    const gameTitle = extractGameTitle();

    // Create a cache key from the gameTitle and filters
    const cacheKey = JSON.stringify({ gameTitle, filters });

    // Check if we have cached results in memory
    if (priceCache.has(cacheKey)) {
      console.log('[Cache] Using in-memory cached price data');
      const cachedData = priceCache.get(cacheKey);
      injectPrices(cachedData);
      return cachedData;
    }

    // Show loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'game_area_purchase_game_wrapper dynamic loading';
    loadingIndicator.innerHTML = `
      <div class="game_area_purchase_game notice_box_content">
        <div class="game_purchase_loading">
          <div class="throbber"></div>
          <div>Loading prices...</div>
        </div>
      </div>
    `;

    const mainContainer = document.querySelector('#game_area_purchase');
    const existingWrapper = mainContainer?.querySelector('.game_area_purchase_game_wrapper');
    if (mainContainer && existingWrapper) {
      // Clean previous dynamic elements
      mainContainer.querySelectorAll('.dynamic').forEach(el => el.remove());
      existingWrapper.insertAdjacentElement('afterend', loadingIndicator);
    }

    console.log(`[Request] Fetching prices for ${gameTitle} with filters`);
    const requestStart = performance.now();

    const data = await Promise.race([
      chrome.runtime.sendMessage({
        action: 'fetchPrices',
        data: { gameTitle, filterOptions: filters },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fetch timeout - request took too long')), 30000)
      )
    ]);

    // Remove loading indicator
    loadingIndicator?.remove();

    const requestDuration = performance.now() - requestStart;
    console.log(
      `[Performance] Price fetch completed in ${requestDuration.toFixed(2)}ms` +
      (data.fromCache ? ' (from service worker cache)' : '')
    );

    if (!data.success) throw new Error(data.error || 'Failed to fetch prices');

    // Cache the successful response in memory
    priceCache.set(cacheKey, data.data);

    injectPrices(data.data);
    return data;
  } catch (error) {
    console.error('[Error] Error fetching prices:', error);

    // Show error message in UI
    const mainContainer = document.querySelector('#game_area_purchase');
    if (mainContainer) {
      const errorEl = document.createElement('div');
      errorEl.className = 'game_area_purchase_game_wrapper dynamic error';
      errorEl.innerHTML = `
        <div class="game_area_purchase_game notice_box_content">
          <h1>Error loading prices</h1>
          <div>${error.message}</div>
        </div>
      `;
      mainContainer.querySelector('.loading')?.remove();
      const existingWrapper = mainContainer.querySelector('.game_area_purchase_game_wrapper');
      if (existingWrapper) {
        existingWrapper.insertAdjacentElement('afterend', errorEl);
      }
    }

    throw error;
  }
}

function injectPrices(data) {
  const mainContainer = document.querySelector('#game_area_purchase');
  const existingWrapper = mainContainer?.querySelector('.game_area_purchase_game_wrapper');

  if (!mainContainer || !existingWrapper) {
    console.warn('Required containers not found');
    return;
  }

  // Clean previous dynamic elements
  mainContainer.querySelectorAll('.dynamic').forEach((el) => el.remove());

  if (Array.isArray(data)) {
    if (data.length === 0) {
      // No alternative prices found, show message
      const noResultsWrapper = document.createElement('div');
      noResultsWrapper.classList.add('game_area_purchase_game_wrapper', 'dynamic');

      noResultsWrapper.innerHTML = `
        <div class="game_area_purchase_game notice_box_content">
          <h1>No Alternative Prices Found</h1>
          <div>No alternative pricing options were found for this game with your current filter settings.</div>
        </div>
      `;

      existingWrapper.insertAdjacentElement('afterend', noResultsWrapper);
    } else {
      // Found prices, display them
      data.forEach((offer) => {
        const newWrapper = createPriceWrapper(offer);
        existingWrapper.insertAdjacentElement('afterend', newWrapper);
      });
    }
  } else {
    console.warn('Data is not an array:', data);
  }
}

function createPriceWrapper(offer) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('game_area_purchase_game_wrapper', 'dynamic');

  const priceSection = document.createElement('div');
  priceSection.classList.add('game_area_purchase_game', 'notice_box_content');

  const platformDiv = document.createElement('div');
  platformDiv.classList.add('game_area_purchase_platform');
  platformDiv.innerHTML = '<span class="platform_img win"></span>';
  priceSection.appendChild(platformDiv);

  const title = document.createElement('h1');
  title.textContent = `Comprar de ${offer.merchantName}`;
  priceSection.appendChild(title);

  const priceDiv = document.createElement('div');
  priceDiv.classList.add('game_purchase_action');
  priceDiv.innerHTML = `
    <div class="game_purchase_action_bg">
      <div class="game_purchase_price price">${offer.cheapestOffer.price.priceWithoutCoupon}€</div>
      <div class="btn_addtocart">
        <a href="${offer.cheapestOffer.redirectUrl}" target="_blank" class="btn_green_steamui btn_medium">
          <span style="background: #a25024;"> + Comprar</span>
        </a>
      </div>
    </div>`;
  priceSection.appendChild(priceDiv);

  wrapper.appendChild(priceSection);
  return wrapper;
}