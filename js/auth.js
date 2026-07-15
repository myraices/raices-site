const raicesSupabase = window.raicesSupabase;
if (!raicesSupabase) {
  throw new Error("Raíces Supabase client is not configured.");
}

const authModal = document.getElementById("authModal");
const authBackdrop = document.getElementById("authBackdrop");
const authClose = document.getElementById("authClose");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const authMessage = document.getElementById("authMessage");
const authLoggedOut = document.getElementById("authLoggedOut");
const authLoggedIn = document.getElementById("authLoggedIn");
const authResetPassword = document.getElementById("authResetPassword");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordMessage = document.getElementById("resetPasswordMessage");
const accountEmail = document.getElementById("accountEmail");
const userWrap = document.getElementById("userWrap");
const userGreeting = document.getElementById("userGreeting");
const userIconLink = document.getElementById("userIconLink");
const userActionLabel = document.getElementById("userActionLabel");
const drawerAccountLink = document.getElementById("drawerAccountLink");
const logoutBtn = document.getElementById("logoutBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const forgotPasswordPanel = document.getElementById("forgotPasswordPanel");
const sendResetPasswordBtn = document.getElementById("sendResetPasswordBtn");
let lastUnconfirmedEmail = "";
let isPasswordRecoveryMode = false;
let signupTurnstileWidgetId = null;
let forgotTurnstileWidgetId = null;
let signupTurnstileToken = "";
let forgotTurnstileToken = "";

function resetTurnstileWidget(widgetId) {
  if (widgetId !== null && window.turnstile) window.turnstile.reset(widgetId);
}

function waitForTurnstile(attempts = 40) {
  return new Promise(function(resolve, reject) {
    function check(remaining) {
      if (window.turnstile && typeof window.turnstile.render === "function") return resolve(window.turnstile);
      if (remaining <= 0) return reject(new Error("Turnstile did not load"));
      setTimeout(function(){ check(remaining - 1); }, 150);
    }
    check(attempts);
  });
}

async function renderTurnstileWidgets() {
  const sitekey = String(window.RAICES_TURNSTILE_SITE_KEY || "").trim();
  if (!sitekey || sitekey.includes("__TURNSTILE")) throw new Error("Turnstile site key is not configured");
  const turnstileApi = await waitForTurnstile();
  if (document.getElementById("signupTurnstile") && signupTurnstileWidgetId === null) {
    signupTurnstileWidgetId = turnstileApi.render("#signupTurnstile", {
      sitekey: sitekey, action: "signup", theme: "light", size: "normal",
      callback: function(token){ signupTurnstileToken = token; },
      "expired-callback": function(){ signupTurnstileToken = ""; },
      "error-callback": function(){ signupTurnstileToken = ""; }
    });
  }
  if (document.getElementById("forgotTurnstile") && forgotTurnstileWidgetId === null) {
    forgotTurnstileWidgetId = turnstileApi.render("#forgotTurnstile", {
      sitekey: sitekey, action: "password_reset", theme: "light", size: "normal",
      callback: function(token){ forgotTurnstileToken = token; },
      "expired-callback": function(){ forgotTurnstileToken = ""; },
      "error-callback": function(){ forgotTurnstileToken = ""; }
    });
  }
}

async function verifyTurnstile(token, action) {
  if (!token) throw new Error("captcha_required");
  const response = await fetch("/.netlify/functions/verify-turnstile", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: token, action: action })
  });
  const result = await response.json().catch(function(){ return {}; });
  if (!response.ok || !result.ok) throw new Error(result.error || "captcha_failed");
  return true;
}

function validateSignupName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) return false;
  if (!/^[\p{L}][\p{L}\p{M}'’.-]*(?: [\p{L}][\p{L}\p{M}'’.-]*)*$/u.test(name)) return false;
  const letters = name.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");
  if (/(.)\1{4,}/u.test(letters)) return false;
  if (letters.length >= 10 && !/[aeiouáéíóúü]/u.test(letters)) return false;
  const uncommonRun = letters.match(/[^aeiouáéíóúüy]{8,}/u);
  if (letters.length >= 14 && uncommonRun) return false;
  return true;
}

function captchaMessage(error) {
  const code = String((error && error.message) || error || "");
  if (code === "captcha_required") return authText("Completa la verificación de seguridad.", "Complete the security verification.");
  if (code === "verification_unavailable") return authText("La verificación no está disponible ahora. Intenta de nuevo.", "Security verification is unavailable. Try again.");
  return authText("La verificación de seguridad venció o no fue válida. Intenta de nuevo.", "The security verification expired or was invalid. Try again.");
}

async function openAuthModal(e) {
  if (e) e.preventDefault();
  if (!isPasswordRecoveryMode) {
    try {
      const { data } = await raicesSupabase.auth.getUser();
      if (data && data.user) {
        window.location.href = "/account";
        return;
      }
    } catch (err) {
      console.warn("Raíces account redirect warning:", err);
    }
  }
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden","false");
  if (!isPasswordRecoveryMode) checkAuthState();
}
function closeAuthModal() {
  if (isPasswordRecoveryMode) return;
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden","true");
  authMessage.textContent = "";
  if (resetPasswordMessage) resetPasswordMessage.textContent = "";
}
document.querySelectorAll('a[href="#usuario"]').forEach(function(link){ link.addEventListener("click", openAuthModal); });
if (authBackdrop) authBackdrop.addEventListener("click", closeAuthModal);
if (authClose) authClose.addEventListener("click", closeAuthModal);

function showLogin(clearMessage = true) {
  isPasswordRecoveryMode = false;
  if (authResetPassword) authResetPassword.classList.add("hidden");
  authLoggedIn.classList.add("hidden");
  authLoggedOut.classList.remove("hidden");
  loginTab.classList.add("active"); signupTab.classList.remove("active");
  loginForm.classList.remove("hidden"); signupForm.classList.add("hidden");
  if (clearMessage) authMessage.textContent = "";
}
function showSignup(clearMessage = true) {
  isPasswordRecoveryMode = false;
  if (authResetPassword) authResetPassword.classList.add("hidden");
  authLoggedIn.classList.add("hidden");
  authLoggedOut.classList.remove("hidden");
  signupTab.classList.add("active"); loginTab.classList.remove("active");
  signupForm.classList.remove("hidden"); loginForm.classList.add("hidden");
  if (clearMessage) authMessage.textContent = "";
  renderTurnstileWidgets().catch(function(err){ console.error("Raíces Turnstile load error:", err); });
  setTimeout(function(){ document.getElementById("signupName").focus(); }, 80);
}

function getAuthLang() {
  return window.raicesLang || localStorage.getItem("raices_lang") || "es";
}

function normalizeUserLanguage(value) {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "es";
}

function getPreferredLanguageFromUser(user) {
  const meta = user && user.user_metadata ? user.user_metadata : {};
  return normalizeUserLanguage(meta.language || meta.preferred_language || "es");
}

function applyPreferredLanguageFromUser(user) {
  if (!user) return getAuthLang();
  const preferredLanguage = getPreferredLanguageFromUser(user);
  localStorage.setItem("raices_lang", preferredLanguage);
  if (typeof window.applyRaicesLanguage === "function") {
    window.applyRaicesLanguage(preferredLanguage);
  } else {
    window.raicesLang = preferredLanguage;
    document.documentElement.lang = preferredLanguage;
  }
  return preferredLanguage;
}

function authText(es, en) {
  return String(getAuthLang()).toLowerCase().startsWith("en") ? en : es;
}

function showPasswordRecoveryView() {
  isPasswordRecoveryMode = true;
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden", "false");
  authLoggedOut.classList.add("hidden");
  authLoggedIn.classList.add("hidden");
  if (authResetPassword) authResetPassword.classList.remove("hidden");
  if (resetPasswordMessage) resetPasswordMessage.textContent = "";
  setTimeout(function(){
    const input = document.getElementById("newPassword");
    if (input) input.focus();
  }, 120);
}

function cleanRecoveryUrl() {
  if (window.history && window.history.replaceState) {
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  }
}

function urlLooksLikeRecovery() {
  const url = new URL(window.location.href);
  const raw = (url.search + " " + url.hash).toLowerCase();
  return raw.includes("type=recovery") || raw.includes("#reset-password") || raw.includes("access_token=");
}

function setAuthPlainMessage(message) {
  authMessage.textContent = message || "";
}

function setUnconfirmedMessage(email) {
  lastUnconfirmedEmail = String(email || "").trim().toLowerCase();
  const message = authText(
    "Ese correo todavía no está confirmado. Revisa tu bandeja de entrada o reenvía el correo de confirmación.",
    "That email is not confirmed yet. Check your inbox or resend the confirmation email."
  );
  const resendText = authText("Reenviar confirmación", "Resend confirmation");
  const recoverText = authText("Olvidé mi contraseña", "Forgot password");
  authMessage.innerHTML = `
    <div>${message}</div>
    <div class="auth-inline-actions">
      <button class="auth-link" type="button" id="resendConfirmationBtn">${resendText}</button>
      <button class="auth-link" type="button" id="recoverFromUnconfirmedBtn">${recoverText}</button>
    </div>
  `;
  const resendBtn = document.getElementById("resendConfirmationBtn");
  const recoverBtn = document.getElementById("recoverFromUnconfirmedBtn");
  if (resendBtn) resendBtn.addEventListener("click", resendConfirmationEmail);
  if (recoverBtn) recoverBtn.addEventListener("click", function(){ if (forgotPasswordBtn) forgotPasswordBtn.click(); });
}

function isEmailNotConfirmedError(error) {
  const message = String((error && error.message) || error || "").toLowerCase();
  return message.includes("email not confirmed") || message.includes("not confirmed");
}

async function resendConfirmationEmail() {
  const email = lastUnconfirmedEmail || (document.getElementById("loginEmail") && document.getElementById("loginEmail").value.trim().toLowerCase());
  if (!email) {
    setAuthPlainMessage(authText("Escribe tu email y vuelve a intentarlo.", "Enter your email and try again."));
    return;
  }
  setAuthPlainMessage(authText("Reenviando confirmación...", "Resending confirmation..."));
  try {
    const { error } = await raicesSupabase.auth.resend({
      type: "signup",
      email: email,
      options: { emailRedirectTo: "https://myraices.com/" }
    });
    if (error) {
      setUnconfirmedMessage(email);
      const extra = document.createElement("div");
      extra.style.marginTop = "8px";
      extra.textContent = error.message || authText("No se pudo reenviar el correo.", "We could not resend the email.");
      authMessage.appendChild(extra);
      return;
    }
    setAuthPlainMessage(authText(
      "Te reenviamos el correo de confirmación. Revisa también Spam o Promotions.",
      "We resent the confirmation email. Please also check Spam or Promotions."
    ));
  } catch (err) {
    console.error("Raíces resend confirmation error:", err);
    setAuthPlainMessage(authText("No se pudo reenviar el correo. Intenta de nuevo.", "We could not resend the email. Try again."));
  }
}

function isExistingSignupResponse(data, error) {
  const message = String((error && error.message) || "").toLowerCase();
  if (message.includes("already") || message.includes("registered") || message.includes("exists")) return true;
  const identities = data && data.user && data.user.identities;
  return Array.isArray(identities) && identities.length === 0;
}

function routeExistingEmailToLogin(email) {
  const loginEmail = document.getElementById("loginEmail");
  if (loginEmail) loginEmail.value = email || "";
  showLogin(false);
  authMessage.textContent = authText(
    "Ese correo ya está registrado. Inicia sesión o usa ‘Olvidé mi contraseña’.",
    "That email is already registered. Sign in or use ‘Forgot password’."
  );
  setTimeout(function(){
    const passwordInput = document.getElementById("loginPassword");
    if (passwordInput) passwordInput.focus();
  }, 80);
}
loginTab.addEventListener("click", showLogin);
signupTab.addEventListener("click", showSignup);


async function syncBrevoContact(payload) {
  try {
    await fetch("/.netlify/functions/brevo-subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Raíces Brevo sync warning:", err);
  }
}

function getUserDisplayName(user) {
  const meta = user && user.user_metadata ? user.user_metadata : {};
  const fullName = (meta.full_name || meta.name || "").trim();
  if (fullName) return fullName.split(/\s+/)[0];
  if (user && user.email) return user.email.split("@")[0];
  return "";
}

async function checkAuthState() {
  if (isPasswordRecoveryMode) return;
  if (authResetPassword) authResetPassword.classList.add("hidden");
  const { data } = await raicesSupabase.auth.getUser();
  if (data && data.user) {
    const displayName = getUserDisplayName(data.user);
    authLoggedOut.classList.add("hidden");
    authLoggedIn.classList.remove("hidden");
    accountEmail.textContent = displayName ? "Hola, " + displayName : data.user.email;
    if (userWrap) userWrap.classList.add("logged-in");
    if (userGreeting) userGreeting.textContent = displayName ? "Hola, " + displayName : "Hola";
    const accountLabel = authText("Mi cuenta", "My account");
    if (userActionLabel) userActionLabel.textContent = accountLabel;
    if (drawerAccountLink) drawerAccountLink.textContent = "👤 " + accountLabel;
    if (userIconLink) {
      userIconLink.setAttribute("title", displayName ? accountLabel + " - " + displayName : accountLabel);
      userIconLink.setAttribute("aria-label", displayName ? accountLabel + ", " + displayName : accountLabel);
    }
  } else {
    authLoggedIn.classList.add("hidden");
    authLoggedOut.classList.remove("hidden");
    if (userWrap) userWrap.classList.remove("logged-in");
    if (userGreeting) userGreeting.textContent = "";
    const loginLabel = authText("Iniciar sesión", "Sign in");
    if (userActionLabel) userActionLabel.textContent = loginLabel;
    if (drawerAccountLink) drawerAccountLink.textContent = "👤 " + loginLabel;
    if (userIconLink) {
      userIconLink.setAttribute("title", loginLabel);
      userIconLink.setAttribute("aria-label", loginLabel);
    }
  }
}

loginForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  authMessage.textContent = "Verificando...";
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const { data, error } = await raicesSupabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (isEmailNotConfirmedError(error)) {
      setUnconfirmedMessage(email);
    } else {
      setAuthPlainMessage(error.message);
    }
    return;
  }
  const userName = data && data.user ? getUserDisplayName(data.user) : "";
  const preferredLanguage = data && data.user ? applyPreferredLanguageFromUser(data.user) : getAuthLang();
  syncBrevoContact({ email: email, name: userName, source: "confirmed_user", consent: true, language: preferredLanguage });
  setAuthPlainMessage(authText("Sesión iniciada.", "Signed in."));
  checkAuthState();
});

signupForm.addEventListener("submit", async function(e) {
  e.preventDefault();

  const name = document.getElementById("signupName").value.trim().replace(/\s+/g, " ");
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const password = document.getElementById("signupPassword").value;
  if (!validateSignupName(name)) {
    setAuthPlainMessage(authText("Escribe un nombre real y válido.", "Enter a real, valid name."));
    return;
  }
  if (!signupTurnstileToken) {
    setAuthPlainMessage(authText("Completa la verificación de seguridad.", "Complete the security verification."));
    return;
  }
  authMessage.textContent = authText("Verificando y creando cuenta...", "Verifying and creating account...");

  try {
    await verifyTurnstile(signupTurnstileToken, "signup");
    const { data, error } = await raicesSupabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: name, first_name: name, language: getAuthLang() },
        emailRedirectTo: "https://myraices.com/"
      }
    });

    if (isExistingSignupResponse(data, error)) {
      console.warn("Raíces signup duplicate email:", email);
      routeExistingEmailToLogin(email);
      return;
    }

    if (error) {
      console.error("Raíces signup error:", error);
      authMessage.textContent = error.message || authText("No se pudo crear la cuenta.", "We could not create the account.");
      return;
    }

    console.log("Raíces signup response:", data);
    signupForm.reset();
    const loginEmail = document.getElementById("loginEmail");
    if (loginEmail) loginEmail.value = email;
    setAuthPlainMessage(authText(
      "Cuenta creada. Te enviamos un correo para confirmar el registro. No podrás iniciar sesión hasta confirmar tu email.",
      "Account created. We sent you an email to confirm your registration. You cannot sign in until your email is confirmed."
    ));
  } catch (err) {
    console.error("Raíces signup unexpected error:", err);
    setAuthPlainMessage(captchaMessage(err));
  } finally {
    signupTurnstileToken = "";
    resetTurnstileWidget(signupTurnstileWidgetId);
  }
});

forgotPasswordBtn.addEventListener("click", async function() {
  const email = document.getElementById("loginEmail").value.trim();
  if (!email) { setAuthPlainMessage(authText("Escribe tu email arriba y luego pulsa recuperar contraseña.", "Enter your email above, then click forgot password.")); return; }
  if (forgotPasswordPanel) forgotPasswordPanel.classList.remove("hidden");
  setAuthPlainMessage(authText("Completa la verificación para enviar el enlace.", "Complete the verification to send the link."));
  renderTurnstileWidgets().catch(function(err){ console.error("Raíces Turnstile load error:", err); });
});

if (sendResetPasswordBtn) sendResetPasswordBtn.addEventListener("click", async function() {
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  if (!email) { setAuthPlainMessage(authText("Escribe tu email arriba.", "Enter your email above.")); return; }
  if (!forgotTurnstileToken) { setAuthPlainMessage(authText("Completa la verificación de seguridad.", "Complete the security verification.")); return; }
  sendResetPasswordBtn.disabled = true;
  setAuthPlainMessage(authText("Verificando...", "Verifying..."));
  try {
    await verifyTurnstile(forgotTurnstileToken, "password_reset");
    const resetUrl = window.location.origin + "/#reset-password";
    const { error } = await raicesSupabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
    setAuthPlainMessage(error ? error.message : authText("Te enviamos un correo para recuperar tu contraseña.", "We sent you a password reset email."));
    if (!error && forgotPasswordPanel) forgotPasswordPanel.classList.add("hidden");
  } catch (err) {
    console.error("Raíces password reset verification error:", err);
    setAuthPlainMessage(captchaMessage(err));
  } finally {
    forgotTurnstileToken = "";
    resetTurnstileWidget(forgotTurnstileWidgetId);
    sendResetPasswordBtn.disabled = false;
  }
});

if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword = document.getElementById("confirmNewPassword").value;
    if (newPassword.length < 6) {
      resetPasswordMessage.textContent = authText("La contraseña debe tener al menos 6 caracteres.", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      resetPasswordMessage.textContent = authText("Las contraseñas no coinciden.", "Passwords do not match.");
      return;
    }
    resetPasswordMessage.textContent = authText("Guardando nueva contraseña...", "Saving new password...");
    const { error } = await raicesSupabase.auth.updateUser({ password: newPassword });
    if (error) {
      resetPasswordMessage.textContent = error.message || authText("No se pudo actualizar la contraseña.", "We could not update your password.");
      return;
    }
    resetPasswordForm.reset();
    cleanRecoveryUrl();
    await raicesSupabase.auth.signOut();
    isPasswordRecoveryMode = false;
    showLogin(false);
    setAuthPlainMessage(authText("Contraseña actualizada. Ahora puedes iniciar sesión con tu nueva contraseña.", "Password updated. You can now sign in with your new password."));
  });
}

logoutBtn.addEventListener("click", async function() {
  await raicesSupabase.auth.signOut();
  checkAuthState();
});

raicesSupabase.auth.onAuthStateChange(function(event, session) {
  if (event === "PASSWORD_RECOVERY" || urlLooksLikeRecovery()) {
    showPasswordRecoveryView();
    return;
  }
  if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session && session.user) {
    applyPreferredLanguageFromUser(session.user);
  }
  checkAuthState();
});

if (urlLooksLikeRecovery()) {
  showPasswordRecoveryView();
} else {
  checkAuthState();
}
renderTurnstileWidgets().catch(function(err){ console.warn("Raíces Turnstile initialization:", err); });


window.addEventListener("raices:languageChanged", function(){
  checkAuthState().catch(function(err){ console.warn("Raíces account label language warning:", err); });
});
