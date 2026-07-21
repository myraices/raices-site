/* Loads catalog-dependent scripts only after the Supabase catalog bridge resolves. */
(function () {
  const dependentScripts = [
    "js/catalog.js?v=128.2",
    "js/shop.js?v=128.2",
    "js/analytics.js?v=128.2",
    "js/auth.js?v=128.2",
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

    for (const src of dependentScripts) {
      await loadScript(src);
    }

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
