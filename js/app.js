(function(){
  function initialize(){
    const drawer = document.getElementById("drawer");
    const backdrop = document.getElementById("backdrop");
    const mobileBtn = document.getElementById("mobileBtn");
    const closeDrawer = document.getElementById("closeDrawer");

    function setMenuState(open){
      if(!drawer || !backdrop) return;
      drawer.classList.toggle("open", open);
      backdrop.classList.toggle("show", open);
      drawer.setAttribute("aria-hidden", open ? "false" : "true");
      if(mobileBtn) mobileBtn.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("mobile-menu-open", open);
    }
    function closeMenu(){ setMenuState(false); }

    if(drawer) drawer.setAttribute("aria-hidden", "true");
    if(mobileBtn){
      mobileBtn.setAttribute("aria-controls", "drawer");
      mobileBtn.setAttribute("aria-expanded", "false");
      mobileBtn.addEventListener("click", function(event){
        event.preventDefault();
        setMenuState(!(drawer && drawer.classList.contains("open")));
      });
    }
    if(closeDrawer) closeDrawer.addEventListener("click", closeMenu);
    if(backdrop) backdrop.addEventListener("click", closeMenu);
    document.querySelectorAll(".drawer a").forEach(a => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", function(event){ if(event.key === "Escape") closeMenu(); });
    window.addEventListener("resize", function(){ if(window.innerWidth > 900) closeMenu(); }, { passive:true });

    if("IntersectionObserver" in window){
      const obs = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if(entry.isIntersecting){
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: .15 });
      document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
    }else{
      document.querySelectorAll(".reveal").forEach(el => el.classList.add("visible"));
    }

    const footerCartLink = document.getElementById("footerCartLink");
    const openCart = document.getElementById("openCart");
    if(footerCartLink && openCart){
      footerCartLink.addEventListener("click", function(e){ e.preventDefault(); openCart.click(); });
    }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once:true });
  else initialize();
})();
