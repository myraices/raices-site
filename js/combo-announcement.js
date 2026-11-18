(() => {
  const banner = document.getElementById('comboAnnouncement');
  const title = banner.querySelector('strong');
  const details = banner.querySelector('p');
  const terms = banner.querySelector('small');
  const link = banner.querySelector('a');

  function updateLanguage() {
    const english = window.raicesLang === 'en';
    banner.setAttribute('aria-label', english ? 'Promotion' : 'Promoción');
    title.textContent = english ? 'Get a free mini cake!' : '¡Una torta pequeña de regalo!';
    details.replaceChildren(title, english
      ? ' Buy one eligible pack of arepas and one eligible pack of protein.'
      : ' Compra un paquete de arepas y uno de proteína participantes.');
    terms.textContent = english
      ? 'Through November 23 · 1 gift per order · While supplies last'
      : 'Hasta el 23 de noviembre · 1 regalo por pedido · Hasta agotar existencias';
    link.textContent = english ? 'Shop arepas and proteins →' : 'Ver arepas y proteínas →';
  }

  fetch('/.netlify/functions/create-square-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ giftAnnouncement: true })
  }).then(async response => {
    if (!response.ok || (await response.json()).showGiftAnnouncement !== true) return;
    updateLanguage();
    window.addEventListener('raices:languageChanged', updateLanguage);
    banner.hidden = false;
  }).catch(() => {
    banner.hidden = true;
  });
})();
