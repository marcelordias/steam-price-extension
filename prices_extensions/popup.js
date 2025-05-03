const DEFAULT_PRICE_RANGE = { min: 0, max: 999 };

document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        minPriceRange: document.getElementById('minPriceRange'),
        maxPriceRange: document.getElementById('maxPriceRange'),
        minPriceDisplay: document.getElementById('minPriceDisplay'),
        maxPriceDisplay: document.getElementById('maxPriceDisplay'),
        rangeTrack: document.querySelector('.range-track'),
        storesList: document.getElementById('storesList'),
        storeSearch: document.getElementById('storeSearch'),
        storeCount: document.querySelector('.store-count'),
        selectAllStoresBtn: document.getElementById('selectAll'),
        deselectAllStoresBtn: document.getElementById('deselectAll'),
        regionsList: document.getElementById('regionsList'),
        regionSearch: document.getElementById('regionSearch'),
        regionCount: document.querySelector('.region-count'),
        selectAllRegionsBtn: document.getElementById('selectAllRegions'),
        deselectAllRegionsBtn: document.getElementById('deselectAllRegions'),
        editionsList: document.getElementById('editionsList'),
        editionSearch: document.getElementById('editionSearch'),
        editionCount: document.querySelector('.edition-count'),
        selectAllEditionsBtn: document.getElementById('selectAllEditions'),
        deselectAllEditionsBtn: document.getElementById('deselectAllEditions'),
        currenciesList: document.getElementById('currenciesList'),
        currencySearch: document.getElementById('currencySearch'),
        currencyCount: document.querySelector('.currency-count'),
        platformsList: document.getElementById('platformsList'),
        platformSearch: document.getElementById('platformSearch'),
        platformCount: document.querySelector('.platform-count')
    };

    // Fetch data from a JSON file and merge with saved preferences
    async function loadData(filename, key) {
        try {
            if (key === 'priceRange') {
                return new Promise(resolve => {
                    chrome.storage.local.get(['priceRange'], result => {
                        resolve(result.priceRange || DEFAULT_PRICE_RANGE);
                    });
                });
            }

            const response = await fetch(filename);
            const data = await response.json();
            const saved = await new Promise(resolve => {
                chrome.storage.local.get([key], result => resolve(result[key] || []));
            });

            return data[key].map(item => ({
                ...item,
                checked: saved.length > 0
                    ? saved.some(s => s === item.id.toString() || s === item.name)
                    : item.checked
            })).sort((a, b) => b.checked - a.checked);
        } catch (error) {
            console.error(`Error loading ${key}:`, error);
            return key === 'priceRange' ? DEFAULT_PRICE_RANGE : [];
        }
    }

    // Create a generic element for filters
    function createFilterElement(item, name) {
        const label = document.createElement('label');
        label.className = `${name}-option`;
        const value = item.name || item.id.toString();

        // Different markup for currency and platform (radio) vs others (checkbox)
        if (name === 'currency' || name === 'platform') {
            label.innerHTML = `
                <input type="radio" name="${name}" value="${value}" ${item.checked ? 'checked' : ''}>
                <span class="radio-mark"></span>
                <span class="filter-name">${item.name}</span>
            `;
        } else {
            label.innerHTML = `
                <input type="checkbox" name="${name}" value="${value}" ${item.checked ? 'checked' : ''}>
                <span class="checkmark"></span>
                <span class="filter-name">${item.name}</span>
                ${item.isPopular ? '<span class="filter-tag">Popular</span>' : ''}
            `;
        }

        // Add change event listener to each filter element
        setTimeout(() => {
            const input = label.querySelector('input');
            input.addEventListener('change', debounce(applyFilters, 500));
        }, 0);

        return label;
    }

    // Initialize a filter list with search and selection functionality
    async function initializeFilterList({
        listElement, searchElement, countElement, selectAllBtn, deselectAllBtn, dataLoader, name
    }) {
        const data = await dataLoader();
        data.forEach(item => listElement.appendChild(createFilterElement(item, name)));

        // Search functionality
        searchElement.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            listElement.querySelectorAll(`.${name}-option`).forEach(option => {
                const text = option.querySelector('.filter-name').textContent.toLowerCase();
                option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
            });
        });

        // Select/Deselect all functionality
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                toggleAll(listElement, name, true, countElement);
                applyFilters(); // Apply filters after toggle
            });
        }
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                toggleAll(listElement, name, false, countElement);
                applyFilters(); // Apply filters after toggle
            });
        }
        // Update count on change
        listElement.addEventListener('change', () => updateCount(listElement, name, countElement));
        updateCount(listElement, name, countElement);
    }

    // Toggle all checkboxes in a list
    function toggleAll(listElement, name, check, countElement) {
        if (name === 'currency' || name === 'platform') {
            return;
        }

        listElement.querySelectorAll(`input[name="${name}"]`).forEach(checkbox => {
            checkbox.checked = check;
        });
        updateCount(listElement, name, countElement);
    }

    // Update the count of selected items
    function updateCount(listElement, name, countElement) {
        const total = listElement.querySelectorAll(`input[name="${name}"]`).length;
        const checked = listElement.querySelectorAll(`input[name="${name}"]:checked`).length;
        countElement.textContent = `${checked} of ${total} selected`;
    }

    // Helper function to debounce function calls
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Update price range display
    const updatePriceDisplay = function () {
        const minValue = parseInt(elements.minPriceRange.value);
        const maxValue = parseInt(elements.maxPriceRange.value);

        // Ensure min doesn't exceed max
        if (minValue > maxValue) {
            if (this === elements.minPriceRange) {
                elements.minPriceRange.value = maxValue;
            } else {
                elements.maxPriceRange.value = minValue;
            }
        }

        elements.minPriceDisplay.textContent = `€${elements.minPriceRange.value}`;
        elements.maxPriceDisplay.textContent = `€${elements.maxPriceRange.value}`;

        // Update range track
        const minPercent = (elements.minPriceRange.value / elements.minPriceRange.max) * 100;
        const maxPercent = (elements.maxPriceRange.value / elements.maxPriceRange.max) * 100;
        elements.rangeTrack.style.left = `${minPercent}%`;
        elements.rangeTrack.style.width = `${maxPercent - minPercent}%`;
    };

    const debouncedUpdatePriceDisplay = debounce(function () {
        updatePriceDisplay.call(this);
        applyFilters(); // Apply filters after price range change
    }, 500);

    // Save filters to local storage
    async function saveFilters(filters) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(filters, () => {
                if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
                else resolve();
            });
        });
    }

    // Get selected filters for a specific name
    function getSelectedFilters(name) {
        if (name === 'priceRange') {
            return {
                min: parseInt(elements.minPriceRange.value),
                max: parseInt(elements.maxPriceRange.value)
            };
        }

        // For currency and platform, get only one selected value
        if (name === 'currency' || name === 'platform') {
            const selected = document.querySelector(`input[name="${name}"]:checked`);
            return selected ? selected.value : '';
        }

        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
            .map(checkbox => checkbox.value);
    }

    // This function replaces the form submit handler
    async function applyFilters() {
        const filterStatusElement = document.createElement('div');
        filterStatusElement.className = 'filter-status';
        filterStatusElement.textContent = 'Applying filters...';
        filterStatusElement.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--primary-color);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            opacity: 0.9;
        `;
        document.body.appendChild(filterStatusElement);

        try {
            const filters = {
                priceRange: getSelectedFilters('priceRange'),
                stores: getSelectedFilters('store'),
                regions: getSelectedFilters('region'),
                editions: getSelectedFilters('edition'),
                currency: getSelectedFilters('currency'),
                platform: getSelectedFilters('platform')
            };

            await saveFilters(filters);

            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            if (currentTab.url?.includes('store.steampowered.com/app/')) {
                filterStatusElement.textContent = 'Fetching prices...';

                try {
                    const response = await new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(
                            currentTab.id,
                            { action: 'applyFilters', filters },
                            (response) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else {
                                    resolve(response);
                                }
                            }
                        );

                        setTimeout(() => reject(new Error('Request timed out')), 10000);
                    });

                    if (response?.success) {
                        filterStatusElement.textContent = 'Filters applied!';
                    } else {
                        console.error('Error fetching prices:', response?.error);
                        filterStatusElement.textContent = 'Error fetching prices';
                    }
                } catch (error) {
                    console.error('Message error:', error);
                    filterStatusElement.textContent = 'Communication error';
                }
            } else {
                filterStatusElement.textContent = 'Filters saved!';
            }
        } catch (error) {
            console.error('Error saving filters:', error);
            filterStatusElement.textContent = 'Error saving filters';
        } finally {
            // Remove the status element after a delay
            setTimeout(() => {
                filterStatusElement.remove();
            }, 1500);
        }
    }

    // Load saved preferences
    chrome.storage.local.get(['priceRange'], (result) => {
        const range = result.priceRange || DEFAULT_PRICE_RANGE;
        elements.minPriceRange.value = range.min;
        elements.maxPriceRange.value = range.max;
        updatePriceDisplay();
    });

    // Add event listeners for price range sliders
    elements.minPriceRange.addEventListener('input', debouncedUpdatePriceDisplay);
    elements.maxPriceRange.addEventListener('input', debouncedUpdatePriceDisplay);

    // Initialize all filters
    await Promise.all([
        initializeFilterList({
            listElement: elements.storesList,
            searchElement: elements.storeSearch,
            countElement: elements.storeCount,
            selectAllBtn: elements.selectAllStoresBtn,
            deselectAllBtn: elements.deselectAllStoresBtn,
            dataLoader: () => loadData('stores.json', 'stores'),
            name: 'store'
        }),
        initializeFilterList({
            listElement: elements.regionsList,
            searchElement: elements.regionSearch,
            countElement: elements.regionCount,
            selectAllBtn: elements.selectAllRegionsBtn,
            deselectAllBtn: elements.deselectAllRegionsBtn,
            dataLoader: () => loadData('regions.json', 'regions'),
            name: 'region'
        }),
        initializeFilterList({
            listElement: elements.editionsList,
            searchElement: elements.editionSearch,
            countElement: elements.editionCount,
            selectAllBtn: elements.selectAllEditionsBtn,
            deselectAllBtn: elements.deselectAllEditionsBtn,
            dataLoader: () => loadData('editions.json', 'editions'),
            name: 'edition'
        }),
        initializeFilterList({
            listElement: elements.currenciesList,
            searchElement: elements.currencySearch,
            countElement: elements.currencyCount,
            selectAllBtn: null,
            deselectAllBtn: null,
            dataLoader: () => loadData('currencies.json', 'currencies'),
            name: 'currency'
        }),
        initializeFilterList({
            listElement: elements.platformsList,
            searchElement: elements.platformSearch,
            countElement: elements.platformCount,
            selectAllBtn: null,
            deselectAllBtn: null,
            dataLoader: () => loadData('platforms.json', 'platforms'),
            name: 'platform'
        })
    ]);
});