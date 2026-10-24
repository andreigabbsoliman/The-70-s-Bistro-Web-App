const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorBox = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

if (Auth.current()) location.replace("pages/dashboard.html");

const flash = sessionStorage.getItem("flash");
if (flash) { sessionStorage.removeItem("flash"); UI.toast(flash); }

const toggleBtn = document.getElementById("togglePassword");
toggleBtn.addEventListener("click", () => {
    const hidden = passwordInput.type === "password";
    passwordInput.type = hidden ? "text" : "password";
    toggleBtn.textContent = hidden ? "Hide" : "Show";
    toggleBtn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
});

document.querySelectorAll(".demo-account").forEach(btn => btn.addEventListener("click", () => {
    emailInput.value = btn.dataset.email;
    passwordInput.value = btn.dataset.password;
    errorBox.hidden = true;
}));

document.getElementById("forgotLink").addEventListener("click", e => {
    e.preventDefault();
    UI.toast("Please ask an administrator to reset your password.", "info");
});

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.querySelector(".btn-label").textContent = isLoading ? "Signing in…" : "Log In";
    loginBtn.querySelector(".spinner").hidden = !isLoading;
}

form.addEventListener("submit", e => {
    e.preventDefault();
    errorBox.hidden = true;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim());
    document.getElementById("emailError").textContent = emailInput.value.trim() ? (emailOk ? "" : "Enter a valid email address.") : "Email is required.";
    document.getElementById("passwordError").textContent = passwordInput.value ? "" : "Password is required.";
    if (!emailOk || !passwordInput.value) return;

    setLoading(true);
    setTimeout(() => {
        const result = Auth.login(emailInput.value, passwordInput.value);
        if (result.error) {
            setLoading(false);
            errorBox.textContent = result.error;
            errorBox.hidden = false;
            return;
        }
        sessionStorage.setItem("flash", `Welcome, ${result.user.name}!`);
        location.href = "pages/dashboard.html";
    }, 700);
});
