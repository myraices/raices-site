const RAICES_SUPABASE_URL = "https://tqtnffinhqbyesjdollk.supabase.co";
const RAICES_SUPABASE_KEY = "sb_publishable_UzqAP9ZoPNJVtn1FKpoSNg_oNwvJgKW";
const raicesSupabase = window.supabase.createClient(RAICES_SUPABASE_URL, RAICES_SUPABASE_KEY);

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
const accountEmail = document.getElementById("accountEmail");
const userWrap = document.getElementById("userWrap");
const userGreeting = document.getElementById("userGreeting");
const userIconLink = document.getElementById("userIconLink");
const logoutBtn = document.getElementById("logoutBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");

function openAuthModal(e) {
  if (e) e.preventDefault();
  authModal.classList.add("open");
  authModal.setAttribute("aria-hidden","false");
  checkAuthState();
}
function closeAuthModal() {
  authModal.classList.remove("open");
  authModal.setAttribute("aria-hidden","true");
  authMessage.textContent = "";
}
document.querySelectorAll('a[href="#usuario"]').forEach(function(link){ link.addEventListener("click", openAuthModal); });
if (authBackdrop) authBackdrop.addEventListener("click", closeAuthModal);
if (authClose) authClose.addEventListener("click", closeAuthModal);

function showLogin() {
  loginTab.classList.add("active"); signupTab.classList.remove("active");
  loginForm.classList.remove("hidden"); signupForm.classList.add("hidden");
  authMessage.textContent = "";
}
function showSignup() {
  signupTab.classList.add("active"); loginTab.classList.remove("active");
  signupForm.classList.remove("hidden"); loginForm.classList.add("hidden");
  authMessage.textContent = "";
  setTimeout(function(){ document.getElementById("signupName").focus(); }, 80);
}
loginTab.addEventListener("click", showLogin);
signupTab.addEventListener("click", showSignup);

function getUserDisplayName(user) {
  const meta = user && user.user_metadata ? user.user_metadata : {};
  const fullName = (meta.full_name || meta.name || "").trim();
  if (fullName) return fullName.split(/\s+/)[0];
  if (user && user.email) return user.email.split("@")[0];
  return "";
}

async function checkAuthState() {
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
  const { error } = await raicesSupabase.auth.signInWithPassword({ email, password });
  if (error) { authMessage.textContent = error.message; return; }
  authMessage.textContent = "Sesión iniciada.";
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
        data: { full_name: name },
        emailRedirectTo: "https://myraices.com/"
      }
    });

    if (error) {
      console.error("Raíces signup error:", error);
      authMessage.textContent = error.message || "No se pudo crear la cuenta.";
      return;
    }

    console.log("Raíces signup response:", data);
    signupForm.reset();
    authMessage.textContent = "Cuenta creada. Revisa tu correo para confirmar el registro.";
  } catch (err) {
    console.error("Raíces signup unexpected error:", err);
    authMessage.textContent = "Error inesperado al crear la cuenta. Revisa la consola.";
  }
});

forgotPasswordBtn.addEventListener("click", async function() {
  const email = document.getElementById("loginEmail").value;
  if (!email) { authMessage.textContent = "Escribe tu email arriba y luego pulsa recuperar contraseña."; return; }
  const { error } = await raicesSupabase.auth.resetPasswordForEmail(email, { redirectTo: "https://myraices.com" });
  authMessage.textContent = error ? error.message : "Te enviamos un correo para recuperar tu contraseña.";
});

logoutBtn.addEventListener("click", async function() {
  await raicesSupabase.auth.signOut();
  checkAuthState();
});

raicesSupabase.auth.onAuthStateChange(function() { checkAuthState(); });
checkAuthState();
