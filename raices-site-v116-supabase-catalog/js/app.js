(function(){
  function initialize(){

  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("backdrop");
  const mobileBtn = document.getElementById("mobileBtn");
  const closeDrawer = document.getElementById("closeDrawer");

  function closeMenu(){
    if(drawer) drawer.classList.remove("open");
    if(backdrop) backdrop.classList.remove("show");
  }

  if(mobileBtn) mobileBtn.addEventListener("click", function(){
    drawer.classList.add("open");
    backdrop.classList.add("show");
  });
  if(closeDrawer) closeDrawer.addEventListener("click", closeMenu);
  if(backdrop) backdrop.addEventListener("click", closeMenu);
  document.querySelectorAll(".drawer a").forEach(a => a.addEventListener("click", closeMenu));

  document.querySelectorAll(".reveal").forEach(el => {
    const obs = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .15 });
    obs.observe(el);
  });

  const footerCartLink = document.getElementById("footerCartLink");
  const openCart = document.getElementById("openCart");
  if(footerCartLink && openCart){
    footerCartLink.addEventListener("click", function(e){
      e.preventDefault();
      openCart.click();
    });
  }

  }
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initialize, { once:true });
  } else {
    initialize();
  }
})();
