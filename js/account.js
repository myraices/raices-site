const RAICES_SUPABASE_URL = "https://tqtnffinhqbyesjdollk.supabase.co";
const RAICES_SUPABASE_KEY = "sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW";
const raicesSupabase = window.supabase.createClient(RAICES_SUPABASE_URL, RAICES_SUPABASE_KEY);

const state = { user: null, meta: {}, section: "profile", lang: localStorage.getItem("raices_lang") || "es", addresses: [] };
const $ = (id) => document.getElementById(id);

const copy = {
  es: {
    store:"Tienda", about:"Nosotros", contact:"Contacto", eyebrow:"Cuenta Raíces", accountTitle:"Mi Cuenta",
    profileNav:"👤 Perfil", addressesNav:"📍 Direcciones", ordersNav:"📦 Mis pedidos", preferencesNav:"🌎 Preferencias", securityNav:"🔒 Seguridad", logoutNav:"🚪 Cerrar sesión",
    profileTitle:"Perfil", profileIntro:"Actualiza tus datos principales para futuras órdenes.", firstName:"Nombre", lastName:"Apellidos", phone:"Teléfono", saveProfile:"Guardar cambios",
    addressTitle:"Mis direcciones", addressIntro:"Guarda varias direcciones y elige una como predeterminada.", addAddress:"+ Agregar dirección", addressName:"Nombre de la dirección", address1:"Dirección", address2:"Apt / Suite", optional:"opcional", city:"Ciudad", state:"Estado", defaultAddress:"Usar como dirección predeterminada", saveAddress:"Guardar dirección", cancel:"Cancelar", noAddresses:"Todavía no tienes direcciones guardadas.", edit:"Editar", remove:"Eliminar", defaultBadge:"Predeterminada", confirmDelete:"¿Eliminar esta dirección?",
    ordersTitle:"Mis pedidos", ordersEmpty:"Todavía no tienes pedidos.", ordersSmall:"Cuando activemos Square y Supabase Orders, aquí aparecerá tu historial.",
    preferencesTitle:"Preferencias", preferencesIntro:"Este idioma se usará para la experiencia de la web y futuras comunicaciones.", language:"Idioma preferido", savePreferences:"Guardar preferencias",
    securityTitle:"Seguridad", securityIntro:"Cambia tu contraseña cuando lo necesites.", newPassword:"Nueva contraseña", confirmPassword:"Confirmar contraseña", updatePassword:"Actualizar contraseña",
    saving:"Guardando...", error:"No se pudo guardar. Intenta de nuevo.", addressTableError:"Primero debes ejecutar el archivo supabase/customer_addresses.sql en Supabase.", notSigned:"Necesitas iniciar sesión para ver Mi Cuenta.", redirect:"Volver al inicio",
    passwordMin:"La contraseña debe tener al menos 6 caracteres.", passwordMismatch:"Las contraseñas no coinciden.", passwordSaved:"Contraseña actualizada.",
    profileSaved:"Perfil actualizado.", addressSaved:"Dirección guardada.", addressDeleted:"Dirección eliminada.", prefSaved:"Preferencias guardadas."
  },
  en: {
    store:"Store", about:"About", contact:"Contact", eyebrow:"Raíces Account", accountTitle:"My Account",
    profileNav:"👤 Profile", addressesNav:"📍 Addresses", ordersNav:"📦 My orders", preferencesNav:"🌎 Preferences", securityNav:"🔒 Security", logoutNav:"🚪 Sign out",
    profileTitle:"Profile", profileIntro:"Update your main details for future orders.", firstName:"First name", lastName:"Last name", phone:"Phone", saveProfile:"Save changes",
    addressTitle:"My addresses", addressIntro:"Save multiple addresses and choose one as your default.", addAddress:"+ Add address", addressName:"Address name", address1:"Address", address2:"Apt / Suite", optional:"optional", city:"City", state:"State", defaultAddress:"Use as default address", saveAddress:"Save address", cancel:"Cancel", noAddresses:"You do not have any saved addresses yet.", edit:"Edit", remove:"Delete", defaultBadge:"Default", confirmDelete:"Delete this address?",
    ordersTitle:"My orders", ordersEmpty:"You do not have any orders yet.", ordersSmall:"Once Square and Supabase Orders are active, your order history will appear here.",
    preferencesTitle:"Preferences", preferencesIntro:"This language will be used for the website experience and future communications.", language:"Preferred language", savePreferences:"Save preferences",
    securityTitle:"Security", securityIntro:"Change your password whenever you need to.", newPassword:"New password", confirmPassword:"Confirm password", updatePassword:"Update password",
    saving:"Saving...", error:"We could not save. Try again.", addressTableError:"First run supabase/customer_addresses.sql in Supabase.", notSigned:"You need to sign in to view My Account.", redirect:"Back to home",
    passwordMin:"Password must be at least 6 characters.", passwordMismatch:"Passwords do not match.", passwordSaved:"Password updated.",
    profileSaved:"Profile updated.", addressSaved:"Address saved.", addressDeleted:"Address deleted.", prefSaved:"Preferences saved."
  }
};

function t(key){ return (copy[state.lang] && copy[state.lang][key]) || copy.es[key] || key; }
function setText(id, value){ const el=$(id); if(el) el.textContent=value; }
function safe(v){ return v == null ? "" : String(v); }
function msg(id, text, ok=true){ const el=$(id); if(!el) return; el.textContent=text; el.dataset.state = ok ? "ok" : "error"; }
function currentMeta(){ return state.user && state.user.user_metadata ? state.user.user_metadata : {}; }
function escapeHtml(value){ return safe(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function displayName(){
  const m = state.meta || {};
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim() || safe(m.full_name).trim();
  return full || (state.user && state.user.email ? state.user.email.split("@")[0] : "");
}
function fillHeaderName(){ if($("accountName")) $("accountName").textContent = displayName() || t("accountTitle"); }

function applyAccountLanguage(){
  document.documentElement.lang = state.lang;
  setText("navStore",t("store")); setText("navAbout",t("about")); setText("navContact",t("contact")); setText("accountEyebrow",t("eyebrow"));
  setText("navProfile",t("profileNav")); setText("navAddresses",t("addressesNav")); setText("navOrders",t("ordersNav")); setText("navPreferences",t("preferencesNav")); setText("navSecurity",t("securityNav")); setText("logoutAccountBtn",t("logoutNav"));
  setText("profileTitle",t("profileTitle")); setText("profileIntro",t("profileIntro")); setText("labelFirstName",t("firstName")); setText("labelLastName",t("lastName")); setText("labelPhone",t("phone")); setText("saveProfileBtn",t("saveProfile"));
  setText("addressTitle",t("addressTitle")); setText("addressIntro",t("addressIntro")); setText("addAddressBtn",t("addAddress")); setText("labelAddressName",t("addressName")); setText("labelAddress1",t("address1")); setText("labelAddress2",t("address2")); setText("optionalText",t("optional")); setText("labelCity",t("city")); setText("labelState",t("state")); setText("labelDefaultAddress",t("defaultAddress")); setText("saveAddressBtn",t("saveAddress")); setText("cancelAddressBtn",t("cancel")); setText("addressesEmptyText",t("noAddresses"));
  setText("ordersTitle",t("ordersTitle")); setText("ordersEmpty",t("ordersEmpty")); setText("ordersSmall",t("ordersSmall"));
  setText("preferencesTitle",t("preferencesTitle")); setText("preferencesIntro",t("preferencesIntro")); setText("labelLanguage",t("language")); setText("savePreferencesBtn",t("savePreferences"));
  setText("securityTitle",t("securityTitle")); setText("securityIntro",t("securityIntro")); setText("labelNewPassword",t("newPassword")); setText("labelConfirmPassword",t("confirmPassword")); setText("updatePasswordBtn",t("updatePassword"));
  const langBtn=$("accountLangBtn"); if(langBtn) langBtn.textContent=state.lang==="es"?"ES":"EN";
  const pref=$("preferredLanguage"); if(pref) pref.value=state.lang;
  fillHeaderName(); renderAddresses();
}

function setActive(section){
  state.section=section;
  document.querySelectorAll(".account-nav button[data-section]").forEach(b=>b.classList.toggle("active",b.dataset.section===section));
  document.querySelectorAll(".account-section").forEach(s=>s.classList.toggle("active",s.id==="section-"+section));
}
function fillForms(){
  const m=state.meta||{};
  fillHeaderName(); $("accountEmailTop").textContent=state.user.email;
  $("firstName").value=safe(m.first_name||m.name||(m.full_name||"").split(" ")[0]);
  $("lastName").value=safe(m.last_name||""); $("email").value=safe(state.user.email); $("phone").value=safe(m.phone||"");
  const lang=safe(m.language||localStorage.getItem("raices_lang")||"es").toLowerCase().startsWith("en")?"en":"es";
  state.lang=lang; localStorage.setItem("raices_lang",lang); applyAccountLanguage();
}
async function updateMetadata(nextMeta){
  const merged={...(state.meta||{}),...nextMeta};
  const {data,error}=await raicesSupabase.auth.updateUser({data:merged});
  if(error) throw error; state.user=data.user; state.meta=currentMeta(); fillForms(); return data.user;
}

function resetAddressForm(){
  $("addressForm").reset(); $("addressId").value=""; $("state").value="TX"; $("addressMessage").textContent=""; $("addressForm").classList.add("hidden");
}
function openAddressForm(address=null){
  $("addressForm").classList.remove("hidden");
  $("addressId").value=address?address.id:""; $("addressName").value=address?safe(address.label):""; $("address1").value=address?safe(address.address_line1):""; $("address2").value=address?safe(address.address_line2):""; $("city").value=address?safe(address.city):""; $("state").value=address?safe(address.state):"TX"; $("zip").value=address?safe(address.postal_code):""; $("isDefaultAddress").checked=address?Boolean(address.is_default):state.addresses.length===0;
  $("addressName").focus();
}
function renderAddresses(){
  const list=$("addressesList"), empty=$("addressesEmpty"); if(!list||!empty) return;
  if(!state.addresses.length){ list.innerHTML=""; empty.classList.remove("hidden"); return; }
  empty.classList.add("hidden");
  list.innerHTML=state.addresses.map(a=>`<article class="address-card" data-id="${escapeHtml(a.id)}"><div class="address-card-copy"><div class="address-card-title"><strong>${escapeHtml(a.label||t('addressTitle'))}</strong>${a.is_default?`<span class="default-badge">★ ${t('defaultBadge')}</span>`:""}</div><p>${escapeHtml(a.address_line1)}${a.address_line2?`, ${escapeHtml(a.address_line2)}`:""}<br>${escapeHtml(a.city)}, ${escapeHtml(a.state)} ${escapeHtml(a.postal_code)}</p></div><div class="address-card-actions"><button type="button" data-action="edit">${t('edit')}</button><button type="button" data-action="delete" class="danger-link">${t('remove')}</button></div></article>`).join("");
}
async function loadAddresses(){
  const {data,error}=await raicesSupabase.from("customer_addresses").select("*").eq("user_id",state.user.id).order("is_default",{ascending:false}).order("created_at",{ascending:true});
  if(error){ console.error(error); msg("addressMessage", error.code==="42P01"?t("addressTableError"):t("error"),false); state.addresses=[]; renderAddresses(); return; }
  state.addresses=data||[]; renderAddresses();
}
async function saveAddress(){
  const id=$("addressId").value;
  const payload={user_id:state.user.id,label:$("addressName").value.trim(),address_line1:$("address1").value.trim(),address_line2:$("address2").value.trim()||null,city:$("city").value.trim(),state:$("state").value.trim().toUpperCase(),postal_code:$("zip").value.trim(),country:"US",is_default:$("isDefaultAddress").checked};
  if(payload.is_default){ const {error}=await raicesSupabase.from("customer_addresses").update({is_default:false}).eq("user_id",state.user.id); if(error) throw error; }
  const query=id?raicesSupabase.from("customer_addresses").update(payload).eq("id",id):raicesSupabase.from("customer_addresses").insert(payload);
  const {error}=await query; if(error) throw error;
  if(!payload.is_default && state.addresses.length===0){ await raicesSupabase.from("customer_addresses").update({is_default:true}).eq("user_id",state.user.id); }
  await loadAddresses(); resetAddressForm(); msg("addressMessage",t("addressSaved"));
}
async function deleteAddress(id){
  const current=state.addresses.find(a=>String(a.id)===String(id));
  const {error}=await raicesSupabase.from("customer_addresses").delete().eq("id",id); if(error) throw error;
  await loadAddresses();
  if(current&&current.is_default&&state.addresses.length){ const first=state.addresses[0]; await raicesSupabase.from("customer_addresses").update({is_default:true}).eq("id",first.id); await loadAddresses(); }
  msg("addressMessage",t("addressDeleted"));
}

async function init(){
  const {data}=await raicesSupabase.auth.getUser();
  if(!data||!data.user){ applyAccountLanguage(); $("accountApp").innerHTML=`<div class="account-shell single"><div class="account-card"><h1>${t("notSigned")}</h1><a class="btn" href="/">${t("redirect")}</a></div></div>`; return; }
  state.user=data.user; state.meta=currentMeta(); fillForms(); $("accountApp").classList.remove("loading");
  document.querySelectorAll(".account-nav button[data-section]").forEach(btn=>btn.addEventListener("click",()=>setActive(btn.dataset.section)));
  setActive("profile"); await loadAddresses();
}

document.addEventListener("DOMContentLoaded",function(){
  state.lang=(localStorage.getItem("raices_lang")||"es").toLowerCase().startsWith("en")?"en":"es"; applyAccountLanguage();
  init().catch(err=>{console.error(err); $("accountApp").innerHTML=`<p class="account-message" data-state="error">${t("error")}</p>`;});
  $("accountLangBtn")?.addEventListener("click",async()=>{state.lang=state.lang==="es"?"en":"es";localStorage.setItem("raices_lang",state.lang);applyAccountLanguage();if(state.user){try{await updateMetadata({language:state.lang});}catch(e){console.warn(e);}}});
  $("profileForm").addEventListener("submit",async e=>{e.preventDefault();msg("profileMessage",t("saving"));try{const first=$("firstName").value.trim(),last=$("lastName").value.trim();await updateMetadata({first_name:first,last_name:last,full_name:[first,last].filter(Boolean).join(" ").trim(),phone:$("phone").value.trim()});msg("profileMessage",t("profileSaved"));}catch(err){console.error(err);msg("profileMessage",t("error"),false);}});
  $("addAddressBtn").addEventListener("click",()=>openAddressForm()); $("cancelAddressBtn").addEventListener("click",resetAddressForm);
  $("addressForm").addEventListener("submit",async e=>{e.preventDefault();msg("addressMessage",t("saving"));try{await saveAddress();}catch(err){console.error(err);msg("addressMessage",err.code==="42P01"?t("addressTableError"):t("error"),false);}});
  $("addressesList").addEventListener("click",async e=>{const btn=e.target.closest("button[data-action]");if(!btn)return;const card=btn.closest(".address-card"),id=card?.dataset.id,address=state.addresses.find(a=>String(a.id)===String(id));if(btn.dataset.action==="edit"&&address)openAddressForm(address);if(btn.dataset.action==="delete"&&id&&confirm(t("confirmDelete"))){try{await deleteAddress(id);}catch(err){console.error(err);msg("addressMessage",t("error"),false);}}});
  $("preferencesForm").addEventListener("submit",async e=>{e.preventDefault();msg("preferencesMessage",t("saving"));try{const lang=$("preferredLanguage").value;state.lang=lang;localStorage.setItem("raices_lang",lang);applyAccountLanguage();await updateMetadata({language:lang});msg("preferencesMessage",t("prefSaved"));}catch(err){console.error(err);msg("preferencesMessage",t("error"),false);}});
  $("passwordForm").addEventListener("submit",async e=>{e.preventDefault();const p1=$("newAccountPassword").value,p2=$("confirmAccountPassword").value;if(p1.length<6)return msg("passwordMessage",t("passwordMin"),false);if(p1!==p2)return msg("passwordMessage",t("passwordMismatch"),false);msg("passwordMessage",t("saving"));const{error}=await raicesSupabase.auth.updateUser({password:p1});if(error)return msg("passwordMessage",error.message||t("error"),false);$("passwordForm").reset();msg("passwordMessage",t("passwordSaved"));});
  $("logoutAccountBtn").addEventListener("click",async()=>{await raicesSupabase.auth.signOut();window.location.href="/";});
});
