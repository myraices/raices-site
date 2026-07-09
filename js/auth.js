const RAICES_SUPABASE_URL = "https://tqtnffinhqbyesjdollk.supabase.co";
const RAICES_SUPABASE_KEY = "sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW";
const raicesSupabase = window.supabase.createClient(RAICES_SUPABASE_URL, RAICES_SUPABASE_KEY);
window.raicesSupabase = raicesSupabase;

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
const logoutBtn = document.getElementById("logoutBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
let lastUnconfirmedEmail = "";
let isPasswordRecoveryMode = false;

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
  setTimeout(function(){ document.getElementById("signupName").focus(); }, 80);
}

function getAuthLang() {
  return window.raicesLang || localStorage.getItem("raices_lang") || "es";
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
    if (userIconLink) {
      userIconLink.setAttribute("title", displayName ? "Mi cuenta - Hola, " + displayName : "Mi cuenta - conectado");
      userIconLink.setAttribute("aria-label", displayName ? "Mi cuenta, conectado como " + displayName : "Mi cuenta, conectado");
    }
  } else {
    authLoggedIn.classList.add("hidden");
    authLoggedOut.classList.remove("hidden");
    if (userWrap) userWrap.classList.remove("logged-in");
    if (userGreeting) userGreeting.textContent = "";
    if (userIconLink) {
      userIconLink.setAttribute("title", "Mi cuenta");
      userIconLink.setAttribute("aria-label", "Usuario");
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
  syncBrevoContact({ email: email, name: userName, source: "confirmed_user", consent: true, language: getAuthLang() });
  setAuthPlainMessage(authText("Sesión iniciada.", "Signed in."));
  checkAuthState();
});

signupForm.addEventListener("submit", async function(e) {
  e.preventDefault();
  authMessage.textContent = "Creando cuenta...";

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const password = document.getElementById("signupPassword").value;

  try {
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
    authMessage.textContent = "Error inesperado al crear la cuenta. Revisa la consola.";
  }
});

forgotPasswordBtn.addEventListener("click", async function() {
  const email = document.getElementById("loginEmail").value;
  if (!email) { setAuthPlainMessage(authText("Escribe tu email arriba y luego pulsa recuperar contraseña.", "Enter your email above, then click forgot password.")); return; }
  const resetUrl = window.location.origin + "/#reset-password";
  const { error } = await raicesSupabase.auth.resetPasswordForEmail(email, { redirectTo: resetUrl });
  setAuthPlainMessage(error ? error.message : authText("Te enviamos un correo para recuperar tu contraseña.", "We sent you a password reset email."));
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

raicesSupabase.auth.onAuthStateChange(function(event) {
  if (event === "PASSWORD_RECOVERY" || urlLooksLikeRecovery()) {
    showPasswordRecoveryView();
    return;
  }
  checkAuthState();
});

if (urlLooksLikeRecovery()) {
  showPasswordRecoveryView();
} else {
  checkAuthState();
}
