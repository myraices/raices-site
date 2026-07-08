document.addEventListener("DOMContentLoaded", function(){
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
});

// v89: Newsletter / Brevo community subscription
(function(){
  function t(key){ return (window.raicesT && window.raicesT(key)) || key; }
  function lang(){ return window.raicesLang || localStorage.getItem('raices_lang') || 'es'; }
  document.addEventListener('DOMContentLoaded', function(){
    const form = document.getElementById('newsletterForm');
    if(!form) return;
    const nameInput = document.getElementById('newsletterName');
    const emailInput = document.getElementById('emailInput');
    const consentInput = document.getElementById('newsletterConsent');
    const message = document.getElementById('newsletterMessage');
    function setMessage(state, text){
      if(!message) return;
      message.dataset.state = state || 'idle';
      message.textContent = text || '';
    }
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      setMessage('idle', t('newsletter_sending'));
      if(!email || !email.includes('@')){
        setMessage('error', t('newsletter_invalid_email'));
        return;
      }
      if(consentInput && !consentInput.checked){
        setMessage('error', t('newsletter_consent_error'));
        return;
      }
      try{
        const response = await fetch('/.netlify/functions/brevo-subscribe', {
          method:'POST',
          headers:{'content-type':'application/json'},
          body: JSON.stringify({
            email,
            name,
            language: lang(),
            source:'newsletter_section',
            consent: true
          })
        });
        if(!response.ok){
          throw new Error('Subscribe failed');
        }
        localStorage.setItem('raices_newsletter_email', email);
        setMessage('ok', t('newsletter_success'));
        form.reset();
      }catch(err){
        setMessage('error', t('newsletter_error'));
      }
    });
  });
})();
