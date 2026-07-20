window.RAICES_CATEGORIES = {
  "Kitchen": {
    title: "Kitchen",
    spanish: "Cocina",
    tagline: "Alimentos artesanales inspirados en la naturaleza.",
    tagline_en: "Handcrafted foods inspired by nature.",
    description: "Arepas, empanadas y proteínas al vacío elaboradas con ingredientes reales, pensadas para nutrir sin complicar tu día.",
    description_en: "Arepas, empanadas and ready-to-enjoy proteins made with real ingredients to nourish your day with ease.",
    image: "assets/categories/category-kitchen.jpg"
  },
  "Herbal": {
    title: "Herbal",
    spanish: "Herbal",
    tagline: "Rituales herbales. Una misma raíz.",
    tagline_en: "Herbal rituals. One same root.",
    description: "Infusiones y rituales herbales creados para acompañar tus momentos de energía, equilibrio y calma.",
    description_en: "Herbal infusions and rituals created to accompany moments of energy, balance and calm.",
    image: "assets/categories/category-herbal.jpg"
  },
  "Desserts": {
    title: "Desserts",
    spanish: "Dulces",
    tagline: "Porque el bienestar también merece dulzura.",
    tagline_en: "Because wellness also deserves sweetness.",
    description: "Postres artesanales con ingredientes naturales, porciones generosas y una mirada más consciente hacia lo dulce.",
    description_en: "Handcrafted desserts with natural ingredients and a more thoughtful way to enjoy sweetness.",
    image: "assets/categories/category-desserts.jpg"
  },
  "Home": {
    title: "Home",
    spanish: "Home",
    tagline: "Pequeños objetos para grandes rituales.",
    tagline_en: "Small objects for meaningful rituals.",
    description: "Objetos y accesorios para transformar una taza, una mesa o una pausa en un pequeño ritual cotidiano.",
    description_en: "Objects and accessories that turn a cup, a table or a pause into a meaningful everyday ritual.",
    image: "assets/categories/category-home.jpg"
  },
  "Wellness": {
    title: "Wellness",
    spanish: "Wellness",
    tagline: "Conocimiento que nutre cuerpo y mente.",
    tagline_en: "Knowledge that nourishes body and mind.",
    description: "Guías digitales para cultivar hábitos, cocina consciente, calma y bienestar desde lo esencial.",
    description_en: "Digital guides to cultivate habits, conscious cooking, calm and wellbeing from the essential.",
    image: "assets/categories/category-wellness.jpg"
  }
};

window.RAICES_COLLECTIONS = {
  "Signature Arepas": { title: "Signature Arepas Collection", description: "Tradición reinventada con yuca, vegetales y sabores naturales.", image: "assets/arepas-board.jpg" },
  "Signature Empanadas": { title: "Signature Empanadas Collection", description: "Masa artesanal, rellenos honestos y colores que nacen de la raíz.", image: "assets/empanadas-signature-board.jpg" },
  "Protein Craft Collection": { title: "Protein Craft Collection", description: "Proteínas cocinadas lentamente y listas para disfrutar.", image: "assets/proteinas-board.jpg" },
  "Three Moments": { title: "Herbal Rituals", description: "Slim & Drain, Golden Fit, Dream & Calm y Gut Harmony: rituales herbales para acompañar tu día.", image: "assets/categories/category-herbal.jpg" },
  "Ritual Collection": { title: "Ritual Collection", description: "Los tres tés insignia de Raíces para acompañar cada momento del día.", image: "assets/products/herbal/herbal-ritual-collection.jpg" },
  "Ritual Box": { title: "Ritual Box", description: "Caja premium con té a elección, mug, difusor y tarjeta ritual.", image: "assets/products/herbal/herbal-ritual-box-dream-calm.jpg" },
  "Signature Desserts": { title: "Signature Desserts", description: "Lo dulce también puede sentirse natural, cuidado y especial.", image: "assets/categories/category-desserts.jpg" },
  "Home Rituals": { title: "Home Rituals", description: "Piezas sencillas para preparar, servir y disfrutar con intención.", image: "assets/categories/category-home.jpg" },
  "The Library": { title: "The Library", description: "Guías digitales para volver a lo esencial y cultivar bienestar.", image: "assets/categories/category-wellness.jpg" }
};


/* v124 — public store release mode. Change only STORE_MODE when Raíces is ready to sell. */
window.RAICES_STORE_CONFIG = Object.freeze({
  VERSION: "v124",
  STORE_MODE: "PREOPENING", // PREOPENING | SALES
  DELIVERY: Object.freeze({
    currency: "USD",
    zones: [
      { name: "Katy / Cinco Ranch", fee: 5, zips: ["77449","77450","77491","77493","77494"] },
      { name: "Fulshear", fee: 8, zips: ["77441"] },
      { name: "Richmond", fee: 8, zips: ["77406","77407","77469"] },
      { name: "Sugar Land", fee: 15, zips: ["77478","77479","77498"] },
      { name: "Cypress", fee: 15, zips: ["77429","77433"] },
      { name: "Houston", fee: 15, prefixes: ["770"] }
    ]
  }),
  CHECKOUT_PREVIEW_URL: "checkout-preview.html"
});
