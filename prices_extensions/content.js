/** @type {browser} ExtensionApi */
var ExtensionApi = (() => {
  if (typeof browser !== 'undefined' && browser.storage) {
    return browser;
  }
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return chrome;
  }
  throw new Error('No appropriate web extensions API found');
})();

// Constants
const language = ExtensionApi.i18n.getUILanguage();
const numberFormatter = new Intl.NumberFormat(language);
let CurrentAppID = null;

// Cache for previous requests
const priceCache = new Map();

// Utilities
function GetLanguage() {
  return language;
}

function GetAppIDFromUrl(url) {
  const match = url.match(/\/(?:app|sub|bundle|friendsthatplay|gamecards|recommended|widget)\/(?<id>[0-9]+)/);
  return match ? Number.parseInt(match.groups.id, 10) : -1;
}

function GetCurrentAppID() {
  if (!CurrentAppID) {
    CurrentAppID = GetAppIDFromUrl(location.pathname);
  }
  console.log(`[AppID] Current AppID: ${CurrentAppID}`); // Debugging line
  return CurrentAppID;
}

function _t(message, substitutions = []) {
  return ExtensionApi.i18n.getMessage(message, substitutions);
}

function GetLocalResource(res) {
  return ExtensionApi.runtime.getURL(res);
}

function GetHomepage() {
  return 'https://steamdb.info/';
}

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
    } finally {
      DrawLowestPrice();
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
    .replace(/™|®|©/g, '')                 // Remove trademark/copyright symbols
    .replace(/\s+/g, ' ')                  // Normalize whitespace
    .replace(/\s*[-:]\s*(Steam|Valve).*/i, '') // Remove "- Steam" or ": Valve" suffixes
    .replace(/[:;]/g, '')             // Replace colons and semicolons with spaces
    .trim();

  console.log(`[Title Extraction] Raw: "${rawTitle}", Cleaned: "${cleanTitle}"`);

  if (!cleanTitle) {
    throw new Error('Game title could not be determined');
  }

  return cleanTitle;
}

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
    .replace(/™|®|©/g, '')                 // Remove trademark/copyright symbols
    .replace(/\s+/g, ' ')                  // Normalize whitespace
    .replace(/\s*[-:]\s*(Steam|Valve).*/i, '') // Remove "- Steam" or ": Valve" suffixes
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
    data.forEach((offer) => {
      const newWrapper = createPriceWrapper(offer);
      existingWrapper.insertAdjacentElement('afterend', newWrapper);
    });
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

function FormatRelativeDate(date) {
  const relativeFormatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const dayInSeconds = 86400; // 24 * 60 * 60
  const daysSince = Math.floor((Date.now() / 1000 - date) / dayInSeconds);

  if (daysSince > 30) {
    return [daysSince, relativeFormatter.format(-Math.round(daysSince / 30), 'month')];
  }

  return [daysSince, relativeFormatter.format(-daysSince, 'day')];
}

async function DrawLowestPrice() {
  const priceMeta = document.querySelector('meta[itemprop="price"]');
  const price = priceMeta ? parseFloat(priceMeta.content.replace(',', '.')) : 0;

  if (!price || price < 0.01) return;

  let currency = document.querySelector('meta[itemprop="priceCurrency"]')?.content || 'USD';

  // Adjust currency for USD regional mappings
  if (currency === 'USD') {
    currency = adjustCurrencyForRegion() || 'USD';
  }

  const container = document.getElementById('game_area_purchase');
  if (!container) return;

  const element = createLowestPriceElement();
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'steamdb_prices_loading';
  loadingIndicator.textContent = 'Loading price history...';
  element.querySelector('div').appendChild(loadingIndicator);

  container.insertAdjacentElement('afterbegin', element);

  try {
    console.log(`[Request] Fetching price history for ${GetCurrentAppID()} (${currency})`);
    const response = await chrome.runtime.sendMessage({
      action: 'GetAppPrice',
      data: { appid: GetCurrentAppID(), currency },
    });

    if (!response?.success) {
      // Show a meaningful error instead of removing the element
      element.querySelector('.steamdb_prices_top').textContent = 'Price history unavailable';
      element.querySelector('.steamdb_prices_bottom').textContent =
        response?.error ? `Error: ${response.error}` : 'Could not load price data';
      loadingIndicator.remove();
      return;
    }

    loadingIndicator.remove();
    updateLowestPriceElement(response.data, element);
  } catch (error) {
    console.error('Error loading price history:', error);
    element.querySelector('.steamdb_prices_top').textContent = 'Price history unavailable';
    element.querySelector('.steamdb_prices_bottom').textContent = `Error: ${error.message}`;
    loadingIndicator?.remove();
  }
}

function adjustCurrencyForRegion() {
  const countryMap = {
    AZ: 'USD-CIS', AM: 'USD-CIS', BY: 'USD-CIS', GE: 'USD-CIS', KG: 'USD-CIS',
    BD: 'USD-SASIA', NP: 'USD-SASIA', PK: 'USD-SASIA',
    AR: 'USD-LATAM', VE: 'USD-LATAM',
    DZ: 'USD-MENA', TR: 'USD-MENA',
  };

  const script = document.evaluate('//script[contains(text(), "EnableSearchSuggestions")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  const country = script?.textContent.match(/EnableSearchSuggestions\(.+?'(?<cc>[A-Z]{2})',/)?.groups?.cc;
  return countryMap[country] || null;
}

function createLowestPriceElement() {
  const element = document.createElement('a');
  element.className = 'steamdb_prices';
  element.href = `${GetHomepage()}app/${GetCurrentAppID()}/`;
  element.target = '_blank';
  element.dir = _t('@@bidi_dir');

  const image = document.createElement('img');
  image.src = GetLocalResource('assets/white.svg');
  element.appendChild(image);

  const textContainer = document.createElement('div');
  textContainer.innerHTML = '<div class="steamdb_prices_top">…</div><div class="steamdb_prices_bottom">…</div>';
  element.appendChild(textContainer);

  return element;
}

function updateLowestPriceElement(data, element) {
  const top = element.querySelector('.steamdb_prices_top');
  const bottom = element.querySelector('.steamdb_prices_bottom');

  if (!data.data || !data.data.p) {
    top.innerHTML = _t('app_price_unavailable') || 'Price data unavailable';
    bottom.textContent = data.error ? `Error: ${data.error}` : 'Could not load price data';
    return;
  }

  const safePrice = escapeHtml(data.data.p);

  if (data.data.l) {
    top.innerHTML = _t('app_lowest_price_limited', [safePrice, escapeHtml(data.data.l)]);
  } else if (data.data.d > 0) {
    top.innerHTML = _t('app_lowest_price_discount', [safePrice, data.data.d.toString()]);
  } else {
    top.innerHTML = _t('app_lowest_price', [safePrice]);
  }

  const lastUpdated = new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(data.data.t * 1000);
  const [, relativeText] = FormatRelativeDate(data.data.t);

  if (data.data.c > 1) {
    bottom.textContent = _t('app_lowest_date_multiple', [lastUpdated, relativeText, data.data.c.toString()]);
  } else {
    bottom.textContent = _t('app_lowest_date', [lastUpdated, relativeText]);
  }
}

function escapeHtml(str) {
  return str.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
