/* Loads catalog-dependent scripts only after the Supabase catalog bridge resolves. */
(function () {
  const essentialScripts = [
    "js/catalog.js?v=23.2.4",
    "js/shop.js?v=23.2.4",
  ];
  const deferredScripts = [
    "js/analytics.js?v=23.2.4",
    "js/auth.js?v=23.2.4",
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function start() {
    await (window.RAICES_CATALOG_DATABASE_READY || Promise.resolve());

    for (const src of essentialScripts) {
      await loadScript(src);
    }
    const loadDeferred = async () => {
      for (const src of deferredScripts) await loadScript(src);
    };
    if ("requestIdleCallback" in window) requestIdleCallback(loadDeferred, { timeout: 2500 });
    else setTimeout(loadDeferred, 1200);

    window.dispatchEvent(new CustomEvent("raices:store-ready", {
      detail: {
        source: window.RAICES_CATALOG_SOURCE || "static",
        productCount: Array.isArray(window.RAICES_PRODUCTS)
          ? window.RAICES_PRODUCTS.length
          : 0,
      },
    }));
  }

  start().catch((error) => {
    console.error("[Raíces Bootstrap] Store initialization failed.", error);
  });
})();
