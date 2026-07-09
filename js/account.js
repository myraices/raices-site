const RAICES_SUPABASE_URL = "https://tqtnffinhqbyesjdollk.supabase.co";
const RAICES_SUPABASE_KEY = "sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW";
const raicesSupabase = window.supabase.createClient(RAICES_SUPABASE_URL, RAICES_SUPABASE_KEY);

const state = { user: null, meta: {}, section: "profile", lang: localStorage.getItem("raices_lang") || "es" };
const $ = (id) => document.getElementById(id);

const copy = {
  es: {
    store:"Tienda", about:"Nosotros", contact:"Contacto", eyebrow:"Cuenta Raíces", accountTitle:"Mi Cuenta",
    profileNav:"👤 Perfil", addressesNav:"📍 Direcciones", ordersNav:"📦 Mis pedidos", preferencesNav:"🌎 Preferencias", securityNav:"🔒 Seguridad", logoutNav:"🚪 Cerrar sesión",
    profileTitle:"Perfil", profileIntro:"Actualiza tus datos principales para futuras órdenes.", firstName:"Nombre", lastName:"Apellidos", phone:"Teléfono", saveProfile:"Guardar cambios",
    addressTitle:"Dirección de entrega", addressIntro:"Por ahora guardaremos una dirección principal.", address1:"Dirección", address2:"Apt / Suite", optional:"opcional", city:"Ciudad", state:"Estado", saveAddress:"Guardar dirección",
    ordersTitle:"Mis pedidos", ordersEmpty:"Todavía no tienes pedidos.", ordersSmall:"Cuando activemos Square y Supabase Orders, aquí aparecerá tu historial.",
    preferencesTitle:"Preferencias", preferencesIntro:"Este idioma se usará para la experiencia de la web y futuras comunicaciones.", language:"Idioma preferido", savePreferences:"Guardar preferencias",
    securityTitle:"Seguridad", securityIntro:"Cambia tu contraseña cuando lo necesites.", newPassword:"Nueva contraseña", confirmPassword:"Confirmar contraseña", updatePassword:"Actualizar contraseña",
    loading:"Cargando tu cuenta...", saving:"Guardando...", error:"No se pudo guardar. Intenta de nuevo.", notSigned:"Necesitas iniciar sesión para ver Mi Cuenta.", redirect:"Volver al inicio",
    passwordMin:"La contraseña debe tener al menos 6 caracteres.", passwordMismatch:"Las contraseñas no coinciden.", passwordSaved:"Contraseña actualizada.",
    profileSaved:"Perfil actualizado.", addressSaved:"Dirección guardada.", prefSaved:"Preferencias guardadas."
  },
  en: {
    store:"Store", about:"About", contact:"Contact", eyebrow:"Raíces Account", accountTitle:"My Account",
    profileNav:"👤 Profile", addressesNav:"📍 Addresses", ordersNav:"📦 My orders", preferencesNav:"🌎 Preferences", securityNav:"🔒 Security", logoutNav:"🚪 Sign out",
    profileTitle:"Profile", profileIntro:"Update your main details for future orders.", firstName:"First name", lastName:"Last name", phone:"Phone", saveProfile:"Save changes",
    addressTitle:"Delivery address", addressIntro:"For now, we will save one primary delivery address.", address1:"Address", address2:"Apt / Suite", optional:"optional", city:"City", state:"State", saveAddress:"Save address",
    ordersTitle:"My orders", ordersEmpty:"You do not have any orders yet.", ordersSmall:"Once Square and Supabase Orders are active, your order history will appear here.",
    preferencesTitle:"Preferences", preferencesIntro:"This language will be used for the website experience and future communications.", language:"Preferred language", savePreferences:"Save preferences",
    securityTitle:"Security", securityIntro:"Change your password whenever you need to.", newPassword:"New password", confirmPassword:"Confirm password", updatePassword:"Update password",
    loading:"Loading your account...", saving:"Saving...", error:"We could not save. Try again.", notSigned:"You need to sign in to view My Account.", redirect:"Back to home",
    passwordMin:"Password must be at least 6 characters.", passwordMismatch:"Passwords do not match.", passwordSaved:"Password updated.",
    profileSaved:"Profile updated.", addressSaved:"Address saved.", prefSaved:"Preferences saved."
  }
};
function t(key){ return (copy[state.lang] && copy[state.lang][key]) || copy.es[key] || key; }
function setText(id, value){ const el=$(id); if(el) el.textContent=value; }
function applyAccountLanguage(){
  document.documentElement.lang = state.lang;
  setText("navStore", t("store")); setText("navAbout", t("about")); setText("navContact", t("contact"));
  setText("accountEyebrow", t("eyebrow"));
  setText("navProfile", t("profileNav")); setText("navAddresses", t("addressesNav")); setText("navOrders", t("ordersNav")); setText("navPreferences", t("preferencesNav")); setText("navSecurity", t("securityNav")); setText("logoutAccountBtn", t("logoutNav"));
  setText("profileTitle", t("profileTitle")); setText("profileIntro", t("profileIntro")); setText("labelFirstName", t("firstName")); setText("labelLastName", t("lastName")); setText("labelPhone", t("phone")); setText("saveProfileBtn", t("saveProfile"));
  setText("addressTitle", t("addressTitle")); setText("addressIntro", t("addressIntro")); setText("labelAddress1", t("address1")); setText("labelAddress2", t("address2")); setText("optionalText", t("optional")); setText("labelCity", t("city")); setText("labelState", t("state")); setText("saveAddressBtn", t("saveAddress"));
  setText("ordersTitle", t("ordersTitle")); setText("ordersEmpty", t("ordersEmpty")); setText("ordersSmall", t("ordersSmall"));
  setText("preferencesTitle", t("preferencesTitle")); setText("preferencesIntro", t("preferencesIntro")); setText("labelLanguage", t("language")); setText("savePreferencesBtn", t("savePreferences"));
  setText("securityTitle", t("securityTitle")); setText("securityIntro", t("securityIntro")); setText("labelNewPassword", t("newPassword")); setText("labelConfirmPassword", t("confirmPassword")); setText("updatePasswordBtn", t("updatePassword"));
  const langBtn = $("accountLangBtn"); if(langBtn) langBtn.textContent = state.lang === "es" ? "ES" : "EN";
  const pref = $("preferredLanguage"); if(pref) pref.value = state.lang;
  fillHeaderName();
}
function msg(id, text, ok=true){ const el=$(id); if(!el) return; el.textContent=text; el.dataset.state = ok ? "ok" : "error"; }
function currentMeta(){ return state.user && state.user.user_metadata ? state.user.user_metadata : {}; }
function safe(v){ return v == null ? "" : String(v); }
function displayName(){
  const m = state.meta || {};
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || safe(m.full_name).trim();
  return full || (state.user && state.user.email ? state.user.email.split("@")[0] : "");
}
function fillHeaderName(){
  if(!$('accountName')) return;
  const name = displayName();
  $('accountName').textContent = name ? name : t('accountTitle');
}
function setActive(section){
  state.section = section;
  document.querySelectorAll(".account-nav button[data-section]").forEach(b => b.classList.toggle("active", b.dataset.section === section));
  document.querySelectorAll(".account-section").forEach(s => s.classList.toggle("active", s.id === "section-" + section));
}
function fillForms(){
  const m = state.meta || {};
  fillHeaderName();
  $("accountEmailTop").textContent = state.user.email;
  $("firstName").value = safe(m.first_name || m.name || (m.full_name || "").split(" ")[0]);
  $("lastName").value = safe(m.last_name || "");
  $("email").value = safe(state.user.email);
  $("phone").value = safe(m.phone || "");
  const address = m.delivery_address || {};
  $("address1").value = safe(address.address1 || m.address1 || "");
  $("address2").value = safe(address.address2 || m.address2 || "");
  $("city").value = safe(address.city || m.city || "");
  $("state").value = safe(address.state || m.state || "TX");
  $("zip").value = safe(address.zip || m.zip || "");
  const lang = safe(m.language || localStorage.getItem("raices_lang") || "es").toLowerCase().startsWith("en") ? "en" : "es";
  state.lang = lang;
  localStorage.setItem("raices_lang", lang);
  applyAccountLanguage();
}
async function updateMetadata(nextMeta){
  const merged = { ...(state.meta || {}), ...nextMeta };
  const { data, error } = await raicesSupabase.auth.updateUser({ data: merged });
  if (error) throw error;
  state.user = data.user;
  state.meta = currentMeta();
  fillForms();
  return data.user;
}
async function init(){
  const { data } = await raicesSupabase.auth.getUser();
  if (!data || !data.user) {
    applyAccountLanguage();
    $("accountApp").innerHTML = `<div class="account-shell single"><div class="account-card"><h1>${t("notSigned")}</h1><a class="btn" href="/">${t("redirect")}</a></div></div>`;
    return;
  }
  state.user = data.user;
  state.meta = currentMeta();
  fillForms();
  $("accountApp").classList.remove("loading");
  document.querySelectorAll(".account-nav button[data-section]").forEach(btn => btn.addEventListener("click", () => setActive(btn.dataset.section)));
  setActive("profile");
}

document.addEventListener("DOMContentLoaded", function(){
  state.lang = (localStorage.getItem("raices_lang") || "es").toLowerCase().startsWith("en") ? "en" : "es";
  applyAccountLanguage();
  init().catch(err => { console.error(err); $("accountApp").innerHTML = `<p class="account-message" data-state="error">${t("error")}</p>`; });

  const langBtn = $("accountLangBtn");
  if(langBtn) langBtn.addEventListener("click", async function(){
    state.lang = state.lang === "es" ? "en" : "es";
    localStorage.setItem("raices_lang", state.lang);
    applyAccountLanguage();
    if(state.user){ try { await updateMetadata({ language: state.lang }); } catch(e){ console.warn(e); } }
  });

  $("profileForm").addEventListener("submit", async function(e){
    e.preventDefault(); msg("profileMessage", t("saving"));
    try {
      const first = $("firstName").value.trim();
      const last = $("lastName").value.trim();
      await updateMetadata({ first_name:first, last_name:last, full_name:[first,last].filter(Boolean).join(" ").trim(), phone:$("phone").value.trim() });
      msg("profileMessage", t("profileSaved"));
    } catch(err){ console.error(err); msg("profileMessage", t("error"), false); }
  });

  $("addressForm").addEventListener("submit", async function(e){
    e.preventDefault(); msg("addressMessage", t("saving"));
    try {
      await updateMetadata({ delivery_address:{ address1:$("address1").value.trim(), address2:$("address2").value.trim(), city:$("city").value.trim(), state:$("state").value.trim(), zip:$("zip").value.trim() } });
      msg("addressMessage", t("addressSaved"));
    } catch(err){ console.error(err); msg("addressMessage", t("error"), false); }
  });

  $("preferencesForm").addEventListener("submit", async function(e){
    e.preventDefault(); msg("preferencesMessage", t("saving"));
    try {
      const lang = $("preferredLanguage").value;
      state.lang = lang;
      localStorage.setItem("raices_lang", lang);
      applyAccountLanguage();
      await updateMetadata({ language: lang });
      msg("preferencesMessage", t("prefSaved"));
    } catch(err){ console.error(err); msg("preferencesMessage", t("error"), false); }
  });

  $("passwordForm").addEventListener("submit", async function(e){
    e.preventDefault();
    const p1 = $("newAccountPassword").value;
    const p2 = $("confirmAccountPassword").value;
    if (p1.length < 6) return msg("passwordMessage", t("passwordMin"), false);
    if (p1 !== p2) return msg("passwordMessage", t("passwordMismatch"), false);
    msg("passwordMessage", t("saving"));
    const { error } = await raicesSupabase.auth.updateUser({ password:p1 });
    if (error) return msg("passwordMessage", error.message || t("error"), false);
    $("passwordForm").reset();
    msg("passwordMessage", t("passwordSaved"));
  });

  $("logoutAccountBtn").addEventListener("click", async function(){
    await raicesSupabase.auth.signOut();
    window.location.href = "/";
  });
});
