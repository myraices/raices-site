const RAICES_SUPABASE_URL = "https://tqtnffinhqbyesjdollk.supabase.co";
const RAICES_SUPABASE_KEY = "sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW";
const raicesSupabase = window.supabase.createClient(RAICES_SUPABASE_URL, RAICES_SUPABASE_KEY);

const state = { user: null, meta: {}, section: "profile", lang: localStorage.getItem("raices_lang") || "es" };
const $ = (id) => document.getElementById(id);

const copy = {
  es: {
    loading: "Cargando tu cuenta...", saved: "Cambios guardados.", saving: "Guardando...", error: "No se pudo guardar. Intenta de nuevo.",
    notSigned: "Necesitas iniciar sesión para ver Mi Cuenta.", redirect: "Volver al inicio", logout: "Cerrar sesión",
    passwordMin: "La contraseña debe tener al menos 6 caracteres.", passwordMismatch: "Las contraseñas no coinciden.", passwordSaved: "Contraseña actualizada.",
    profileSaved: "Perfil actualizado.", addressSaved: "Dirección guardada.", prefSaved: "Preferencias guardadas.", ordersEmpty: "Todavía no tienes pedidos."
  },
  en: {
    loading: "Loading your account...", saved: "Changes saved.", saving: "Saving...", error: "We could not save. Try again.",
    notSigned: "You need to sign in to view My Account.", redirect: "Back to home", logout: "Sign out",
    passwordMin: "Password must be at least 6 characters.", passwordMismatch: "Passwords do not match.", passwordSaved: "Password updated.",
    profileSaved: "Profile updated.", addressSaved: "Address saved.", prefSaved: "Preferences saved.", ordersEmpty: "You do not have any orders yet."
  }
};
function t(key){ return (copy[state.lang] && copy[state.lang][key]) || copy.es[key] || key; }
function msg(id, text, ok=true){ const el=$(id); if(!el) return; el.textContent=text; el.dataset.state = ok ? "ok" : "error"; }
function currentMeta(){ return state.user && state.user.user_metadata ? state.user.user_metadata : {}; }
function safe(v){ return v == null ? "" : String(v); }
function displayName(){
  const m = state.meta || {};
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || safe(m.full_name).trim();
  return full || (state.user && state.user.email ? state.user.email.split("@")[0] : "");
}
function setActive(section){
  state.section = section;
  document.querySelectorAll(".account-nav button[data-section]").forEach(b => b.classList.toggle("active", b.dataset.section === section));
  document.querySelectorAll(".account-section").forEach(s => s.classList.toggle("active", s.id === "section-" + section));
}
function fillForms(){
  const m = state.meta || {};
  $("accountName").textContent = displayName() || "Mi Cuenta";
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
  $("preferredLanguage").value = lang;
  state.lang = lang;
  localStorage.setItem("raices_lang", lang);
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
  init().catch(err => { console.error(err); $("accountApp").innerHTML = `<p class="account-message" data-state="error">${t("error")}</p>`; });

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
      localStorage.setItem("raices_lang", lang);
      state.lang = lang;
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
