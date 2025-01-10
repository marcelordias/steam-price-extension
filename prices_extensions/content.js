chrome.storage.local.get(['priceRange', 'stores', 'regions', 'editions', 'currency', 'platform'], (result) => {
  if (Object.keys(result).length) {
    fetchPricesWithFilters({
      priceRange: result.priceRange || { min: 0, max: 999 },
      stores: result.stores || [],
      regions: result.regions || [],
      editions: result.editions || [],
      currency: result.currency || "",
      platform: result.platform || ""
    });
    console.log('Filters:', result);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applyFilters") {
    fetchPricesWithFilters(message.filters)
      .then(response => sendResponse({ success: true, data: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function fetchPricesWithFilters(filters) {
  try {
    let gameTitle = document.querySelector(".apphub_AppName")?.textContent;
    // remove special characters like ®, ™, etc.
    gameTitle = gameTitle.replace(/[^a-zA-Z0-9 ]/g, "");
    if (!gameTitle) {
      throw new Error("Game title not found");
    }

    // Send message to background script to make the request
    const data = await chrome.runtime.sendMessage({
      action: "fetchPrices",
      data: {
        gameTitle,
        filterOptions: filters
      }
    });

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch prices');
    }
    injectPrices(data.data);
    return data;
  } catch (error) {
    console.error('Error fetching prices:', error);
    throw error;
  }
}

function injectPrices(data) {
  console.log('Prices:', data);

  // Selecionar o contêiner principal
  const mainContainer = document.querySelector('#game_area_purchase');
  if (!mainContainer) {
    console.warn('Contêiner principal não encontrado.');
    return;
  }

  // Selecionar o wrapper existente
  const existingWrapper = mainContainer.querySelector('.game_area_purchase_game_wrapper');
  if (!existingWrapper) {
    console.warn('Wrapper existente não encontrado.');
    return;
  }

  const existingDynamics = document.querySelectorAll('.dynamic');
  existingDynamics.forEach(element => element.remove());


  if (Array.isArray(data)) {
    data.forEach(offer => {
      // Criar um novo wrapper com a classe `game_area_purchase_game_wrapper`
      const newWrapper = document.createElement('div');
      newWrapper.classList.add('game_area_purchase_game_wrapper');
      newWrapper.classList.add('dynamic');

      // Criar o contêiner interno `game_area_purchase_game`
      const newPriceSection = document.createElement('div');
      newPriceSection.classList.add('game_area_purchase_game');

      // Adicionar plataforma
      const platformDiv = document.createElement('div');
      platformDiv.classList.add('game_area_purchase_platform');
      platformDiv.innerHTML = '<span class="platform_img win"></span>';
      newPriceSection.appendChild(platformDiv);

      // Adicionar título do jogo/loja
      const title = document.createElement('h1');
      title.textContent = `Comprar de ${offer.merchantName}`;
      newPriceSection.appendChild(title);

      // Adicionar preço
      const priceDiv = document.createElement('div');
      priceDiv.classList.add('game_purchase_action');
      priceDiv.innerHTML = `
        <div class="game_purchase_action_bg">
          <div class="game_purchase_price price">
            ${offer.cheapestOffer.price.price}€
          </div>
          <div class="btn_addtocart">
            <a href="${offer.cheapestOffer.redirectUrl}" target="_blank" class="btn_green_steamui btn_medium">
              <span> + Comprar</span>
            </a>
          </div>
        </div>`;
      newPriceSection.appendChild(priceDiv);

      // Inserir o contêiner interno no wrapper
      newWrapper.appendChild(newPriceSection);

      // Inserir o novo wrapper logo após o existente
      existingWrapper.insertAdjacentElement('afterend', newWrapper);
    });
  } else {
    console.warn('Os dados fornecidos não são um array.');
    return;
  }
}



