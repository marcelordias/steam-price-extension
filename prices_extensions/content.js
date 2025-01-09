(async function () {
  const gameTitle = document.querySelector(".apphub_AppName")?.textContent;
  if (!gameTitle) {
    console.error("Título do jogo não encontrado.");
    return;
  }

  const gameSlug = gameTitle.toLowerCase().replace(/\s+/g, "-");
  const urlEneba = `https://www.eneba.com/steam-${gameSlug}-pc-steam-key-global`;
  const urlInstantGaming = `https://www.instant-gaming.com/en/4211-buy-${gameSlug}-pc-game`;
  console.log("urlEneba:", urlEneba);
  console.log("urlInstantGaming:", urlInstantGaming);
  
  chrome.runtime.sendMessage({ action: "fetchPrices", urlInstantGaming }, async (response) => {

    console.log("Response:", response);

    // if (response.error) {
    //   console.error("Erro ao buscar os dados:", response.error);
    //   return;
    // }

    // // const parser = new DOMParser();
    // const doc = parser.parseFromString(response.html, "text/html");

    // const iframe = document.createElement("iframe");

    // iframe.src = url;
    // iframe.style.width = "100%";
    // iframe.style.height = "500px";

    // document.body.appendChild(iframe);
  });
})();