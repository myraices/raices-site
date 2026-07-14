(function(){
  function initialize(){

  function sendEvent(name, params = {}) {
    if (typeof gtag === "function") {
      gtag("event", name, params);
    }
  }

  const whatsapp = document.getElementById("whatsappLink");
  if (whatsapp) {
    whatsapp.addEventListener("click", function(){
      sendEvent("click_whatsapp", {
        event_category: "engagement",
        event_label: "floating_whatsapp"
      });
    });
  }

  document.querySelectorAll("[data-wa]").forEach(function(link){
    link.addEventListener("click", function(){
      sendEvent("click_whatsapp_order", {
        event_category: "commerce_intent",
        event_label: link.dataset.wa || "whatsapp_order"
      });
    });
  });

  const newsletter = document.querySelector('form[name="newsletter"]');
  if (newsletter) {
    newsletter.addEventListener("submit", function(){
      sendEvent("newsletter_signup", {
        event_category: "lead",
        event_label: "newsletter_form"
      });
    });
  }

  const langBtn = document.getElementById("langBtn");
  if (langBtn) {
    langBtn.addEventListener("click", function(){
      sendEvent("change_language", {
        event_category: "engagement",
        event_label: "header_language"
      });
    });
  }

  const drawerLangBtn = document.getElementById("drawerLangBtn");
  if (drawerLangBtn) {
    drawerLangBtn.addEventListener("click", function(){
      sendEvent("change_language", {
        event_category: "engagement",
        event_label: "mobile_language"
      });
    });
  }

  document.querySelectorAll('a[href="#arepas"]').forEach(function(link){
    link.addEventListener("click", function(){
      sendEvent("select_product_category", {
        event_category: "product_interest",
        item_category: "arepas"
      });
    });
  });

  document.querySelectorAll('a[href="#empanadas"]').forEach(function(link){
    link.addEventListener("click", function(){
      sendEvent("select_product_category", {
        event_category: "product_interest",
        item_category: "empanadas"
      });
    });
  });

  document.querySelectorAll('a[href="#proteinas"]').forEach(function(link){
    link.addEventListener("click", function(){
      sendEvent("select_product_category", {
        event_category: "product_interest",
        item_category: "proteinas"
      });
    });
  });

  document.querySelectorAll('a[href="#tes"]').forEach(function(link){
    link.addEventListener("click", function(){
      sendEvent("select_product_category", {
        event_category: "product_interest",
        item_category: "tes_infusiones"
      });
    });
  });

  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initialize, { once:true });
  } else {
    initialize();
  }
})();
