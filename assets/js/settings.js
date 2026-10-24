const settingsForm = document.getElementById("settingsForm");
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const getPath = (obj, path) => path.split(".").reduce((o, key) => o[key], obj);
function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((o, key) => o[key], obj)[last] = value;
}

function renderHours(hours) {
    document.getElementById("hoursList").innerHTML = DAYS.map(day => `
        <div class="hours-row ${hours[day].closed ? "closed" : ""}" data-day="${day}">
            <strong>${day}</strong>
            <input type="time" data-field="open" value="${hours[day].open}" aria-label="${day} opening time">
            <input type="time" data-field="close" value="${hours[day].close}" aria-label="${day} closing time">
            <label class="check"><input type="checkbox" data-field="closed" ${hours[day].closed ? "checked" : ""}> <span>Closed</span></label>
        </div>`).join("");
}

function loadForm() {
    const settings = DB.data.settings;
    settingsForm.querySelectorAll("[data-path]").forEach(input => {
        const value = getPath(settings, input.dataset.path);
        if (input.type === "checkbox") input.checked = !!value; else input.value = value;
        input.classList.remove("invalid");
    });
    settingsForm.querySelectorAll(".field-error").forEach(e => { e.textContent = ""; });
    renderHours(settings.hours);
}

function validateForm() {
    let valid = true;
    settingsForm.querySelectorAll("[data-path]").forEach(input => {
        if (input.type === "checkbox") return;
        const errorEl = input.parentElement.querySelector(".field-error");
        let error = "";
        if (input.required && !input.value.trim()) error = "This field is required.";
        else if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) error = "Enter a valid email address.";
        else if (input.type === "number" && (input.value === "" || Number(input.value) < Number(input.min) || Number(input.value) > Number(input.max))) error = `Enter a number from ${input.min} to ${input.max}.`;
        errorEl.textContent = error;
        input.classList.toggle("invalid", !!error);
        if (error) valid = false;
    });
    return valid;
}

settingsForm.addEventListener("submit", e => {
    e.preventDefault();
    if (!validateForm()) {
        UI.toast("Please fix the highlighted fields.", "error");

        const bad = settingsForm.querySelector(".invalid");
        if (bad) showTab(bad.closest("[data-panel]").dataset.panel);
        return;
    }
    const settings = DB.data.settings;
    settingsForm.querySelectorAll("[data-path]").forEach(input => {
        const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value.trim();
        setPath(settings, input.dataset.path, value);
    });
    settingsForm.querySelectorAll(".hours-row").forEach(row => {
        const day = settings.hours[row.dataset.day];
        day.open = row.querySelector('[data-field="open"]').value;
        day.close = row.querySelector('[data-field="close"]').value;
        day.closed = row.querySelector('[data-field="closed"]').checked;
    });
    if (DB.saveSettings()) UI.toast("Changes saved.");
});

settingsForm.addEventListener("change", e => {
    if (e.target.matches('[data-field="closed"]')) e.target.closest(".hours-row").classList.toggle("closed", e.target.checked);
});

document.getElementById("resetBtn").addEventListener("click", async () => {
    const ok = await UI.confirm({ title: "Reset changes", message: "Discard unsaved changes and go back to the last saved settings?", confirmText: "Reset" });
    if (ok) { loadForm(); UI.toast("Form reset to saved settings.", "info"); }
});
document.getElementById("resetDataBtn").addEventListener("click", async () => {
    const ok = await UI.confirm({ title: "Reset to website defaults", message: "This restores the menu, shows, gallery photos and settings to what the customer website originally had, and deletes every ticket transaction and notification for everyone using the system.", confirmText: "Reset Data", danger: true });
    if (!ok) return;
    DB.reset();
    loadForm();
    refreshNotificationBadges();
    UI.toast("Website defaults restored.");
});

function showTab(name) {
    document.querySelectorAll("#settingsTabs .tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".settings-panel").forEach(p => { p.hidden = p.dataset.panel !== name; });
}
document.getElementById("settingsTabs").addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]");
    if (tab) showTab(tab.dataset.tab);
});

loadForm();
