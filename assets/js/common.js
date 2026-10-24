const fmt = {
    peso: n => "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    pesoShort: n => "₱" + Math.round(n || 0).toLocaleString("en-PH"),
    date: iso => iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
    time: hhmm => {
        if (!hhmm) return "—";
        const [h, m] = hhmm.split(":").map(Number);
        return `${h % 12 || 12}:${pad2(m)} ${h >= 12 ? "PM" : "AM"}`;
    },
    dateTime: iso => iso ? `${fmt.date(iso)}, ${fmt.time(iso.slice(11, 16))}` : "—",

    ago: iso => {
        const mins = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins} min ago`;
        if (mins < 1440) return `${Math.floor(mins / 60)} h ago`;
        return `${Math.floor(mins / 1440)} d ago`;
    }
};

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const debounce = (fn, wait = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };
const todayISO = () => toISODate(new Date());

const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    transactions: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    menu: '<path d="M3 2v7a3 3 0 0 0 3 3v10M9 2v7a3 3 0 0 1-3 3M6 2v20M19 2c-2 1-3 4-3 8h3v12"/>',
    events: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    gallery: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    reports: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    burger: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    collapse: '<path d="M15 18l-6-6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>'
};
const icon = (name, size = 18) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

const UI = {

    badge(status) {
        return `<span class="badge s-${String(status).toLowerCase().replace(/[^a-z]/g, "")}">${esc(status)}</span>`;
    },

    greeting() {
        const h = new Date().getHours();
        return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    },

    toast(message, type = "success") {
        let stack = document.getElementById("toastStack");
        if (!stack) {
            stack = document.createElement("div");
            stack.id = "toastStack";
            stack.className = "toast-stack";
            document.body.appendChild(stack);
        }
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${type === "error" ? "!" : type === "info" ? "i" : "✓"}</span><span>${esc(message)}</span>`;
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3200);
    },

    modal({ title, body = "", footer = [], size = "md", onOpen, onClose }) {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Close">${icon("close")}</button></div>
                <div class="modal-body"></div>
                ${footer.length ? '<div class="modal-foot"></div>' : ""}
            </div>`;
        const bodyEl = overlay.querySelector(".modal-body");
        if (typeof body === "string") bodyEl.innerHTML = body; else bodyEl.appendChild(body);

        let closed = false;
        const api = {
            el: overlay, body: bodyEl,
            close() {
                if (closed) return;
                closed = true;
                document.removeEventListener("keydown", onKey);
                overlay.classList.remove("show");
                setTimeout(() => overlay.remove(), 200);
                if (onClose) onClose();
            }
        };
        const onKey = e => { if (e.key === "Escape") api.close(); };

        footer.forEach(btn => {
            const el = document.createElement("button");
            el.type = "button";
            el.className = `btn ${btn.cls || "btn-ghost"}`;
            el.textContent = btn.label;
            el.addEventListener("click", () => {
                const result = btn.onClick ? btn.onClick(api) : undefined;
                if (result !== false && !btn.keepOpen) api.close();
            });
            overlay.querySelector(".modal-foot").appendChild(el);
        });

        overlay.addEventListener("mousedown", e => { if (e.target === overlay) api.close(); });
        overlay.querySelector("[data-close]").addEventListener("click", api.close);
        document.addEventListener("keydown", onKey);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("show"));
        if (onOpen) onOpen(api);
        return api;
    },

    confirm({ title = "Are you sure?", message, confirmText = "Confirm", danger = false }) {
        return new Promise(resolve => {
            let answered = false;
            const done = value => { if (!answered) { answered = true; resolve(value); } };
            UI.modal({
                title, size: "sm", onClose: () => done(false),
                body: `<p class="confirm-text">${message}</p>`,
                footer: [
                    { label: "Cancel", cls: "btn-ghost", onClick: () => done(false) },
                    { label: confirmText, cls: danger ? "btn-danger" : "btn-primary", onClick: () => done(true) }
                ]
            });
        });
    },

    formHtml(fields, values = {}) {
        const rows = fields.map(f => {
            const v = values[f.name] ?? f.default ?? "";
            const id = `f_${f.name}`;
            let control;
            if (f.type === "select") {
                const opts = (typeof f.options === "function" ? f.options(values) : f.options).map(o => typeof o === "string" ? { value: o, label: o } : o);
                control = `<select id="${id}" name="${f.name}">${opts.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
            } else if (f.type === "textarea") {
                control = `<textarea id="${id}" name="${f.name}" rows="3" placeholder="${esc(f.placeholder || "")}">${esc(v)}</textarea>`;
            } else if (f.type === "checkbox") {
                return `<div class="field ${f.full ? "full" : ""}"><label class="check"><input type="checkbox" id="${id}" name="${f.name}" ${v ? "checked" : ""}> <span>${esc(f.label)}</span></label></div>`;
            } else if (f.type === "image") {
                control = `<div class="image-field"><div class="image-preview" id="${id}_preview">${v ? `<img src="${esc(v)}" alt="">` : "<span>No image</span>"}</div>
                    <div><input type="file" accept="image/*" data-image-for="${f.name}"><input type="hidden" id="${id}" name="${f.name}" value="${esc(v)}"><small>Optional. Small images work best.</small></div></div>`;
            } else {
                const attrs = [f.min !== undefined ? `min="${f.min}"` : "", f.max !== undefined ? `max="${f.max}"` : "", f.type === "number" ? 'step="any"' : ""].join(" ");
                control = `<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(v)}" placeholder="${esc(f.placeholder || "")}" ${attrs}>`;
            }
            return `<div class="field ${f.full || ["textarea", "image"].includes(f.type) ? "full" : ""}">
                <label for="${id}">${esc(f.label)}${f.required ? ' <i>*</i>' : ""}</label>${control}
                ${f.help ? `<small>${esc(f.help)}</small>` : ""}<span class="field-error" data-error-for="${f.name}"></span></div>`;
        });
        return `<form class="form-grid" novalidate>${rows.join("")}</form>`;
    },

    bindForm(form) {
        form.querySelectorAll("[data-image-for]").forEach(input => {
            input.addEventListener("change", () => {
                const file = input.files[0];
                if (!file) return;
                if (file.size > 600 * 1024) { UI.toast("Image is too large (max 600 KB).", "error"); input.value = ""; return; }
                const reader = new FileReader();
                reader.onload = () => {
                    form.querySelector(`[name="${input.dataset.imageFor}"]`).value = reader.result;
                    form.querySelector(`#f_${input.dataset.imageFor}_preview`).innerHTML = `<img src="${reader.result}" alt="">`;
                };
                reader.readAsDataURL(file);
            });
        });
    },

    readForm(form, fields) {
        const data = {};
        let valid = true;
        fields.forEach(f => {
            const el = form.elements[f.name];
            const errorEl = form.querySelector(`[data-error-for="${f.name}"]`);
            let value = f.type === "checkbox" ? el.checked : el.value.trim();
            let error = "";
            if (f.type === "number" && value !== "") value = Number(value);
            if (f.required && (value === "" || value === null)) error = `${f.label} is required.`;
            else if (f.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = "Enter a valid email address.";
            else if (f.type === "number" && value !== "" && (isNaN(value) || (f.min !== undefined && value < f.min) || (f.max !== undefined && value > f.max))) error = `Enter a number${f.min !== undefined ? ` from ${f.min}` : ""}${f.max !== undefined ? ` to ${f.max}` : ""}.`;
            else if (f.type === "date" && value && f.min && value < f.min) error = "The date cannot be in the past.";
            else if (f.pattern && value && !f.pattern.test(value)) error = f.patternMessage || "Invalid format.";
            if (errorEl) errorEl.textContent = error;
            if (el.classList) el.classList.toggle("invalid", !!error);
            if (error) valid = false;
            data[f.name] = value;
        });
        return valid ? data : null;
    },

    formModal({ title, fields, values = {}, submitText = "Save", size = "md", onSubmit, extraHtml = "" }) {
        return UI.modal({
            title, size,
            body: UI.formHtml(fields, values) + extraHtml,
            footer: [
                { label: "Cancel", cls: "btn-ghost" },
                {
                    label: submitText, cls: "btn-primary", onClick: api => {
                        const form = api.body.querySelector("form");
                        const data = UI.readForm(form, fields);
                        if (!data) return false;
                        return onSubmit(data, api);
                    }
                }
            ],
            onOpen: api => {
                const form = api.body.querySelector("form");
                UI.bindForm(form);
                form.addEventListener("submit", e => { e.preventDefault(); api.el.querySelector(".btn-primary").click(); });
                const first = form.querySelector("input:not([type=hidden]):not([type=file]), select, textarea");
                if (first) first.focus();
            }
        });
    },

    details(rows) {
        return `<dl class="details">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v === "" || v == null ? "—" : v}</dd></div>`).join("")}</dl>`;
    },

    table(container, { columns, rows, empty = "Nothing to show.", sortKey = null, sortDir = 1 }) {
        container._tableState = container._tableState || { key: sortKey, dir: sortDir };
        const state = container._tableState;
        let sorted = rows.slice();
        if (state.key) {
            sorted.sort((a, b) => {
                const x = a[state.key], y = b[state.key];
                return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true })) * state.dir;
            });
        }
        container.innerHTML = `<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(c => `
            <th class="${c.cls || ""} ${c.sortable ? "sortable" : ""}" ${c.sortable ? `data-sort="${c.key}"` : ""}>${esc(c.label)}${c.sortable && state.key === c.key ? (state.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
            <tbody>${sorted.length ? sorted.map(r => `<tr>${columns.map(c => `<td class="${c.cls || ""}" data-label="${esc(c.label)}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join("")}</tr>`).join("")
                : `<tr><td colspan="${columns.length}" class="empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;
        container.querySelectorAll("[data-sort]").forEach(th => th.addEventListener("click", () => {
            state.dir = state.key === th.dataset.sort ? -state.dir : 1;
            state.key = th.dataset.sort;
            UI.table(container, { columns, rows, empty });
        }));
    },

    onAction(container, handler) {
        container.addEventListener("click", e => {
            const btn = e.target.closest("[data-action]");
            if (btn && container.contains(btn)) handler(btn.dataset.action, btn.dataset.id, btn);
        });
    },

    actions(id, actions) {
        return `<div class="row-actions">${actions.map(([a, label, cls]) => `<button class="btn btn-sm ${cls || "btn-ghost"}" data-action="${a}" data-id="${esc(id)}">${esc(label)}</button>`).join("")}</div>`;
    },

    fillSelect(select, options, allLabel) {
        select.innerHTML = (allLabel ? `<option value="">${esc(allLabel)}</option>` : "") + options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
    },

    openFromQuery(callback) {
        const params = new URLSearchParams(location.search);
        if (params.get("new")) { callback(); history.replaceState(null, "", location.pathname); }
    }
};

const NAV = [
    { section: "MAIN", items: [["dashboard", "Dashboard"]] },
    { section: "OPERATIONS", items: [["transactions", "Ticket Transactions"]] },
    { section: "MANAGEMENT", items: [["menu", "Menu"], ["events", "Events"], ["gallery", "Gallery"]] },
    { section: "REPORTS", items: [["reports", "Reports"]] },
    { section: "SYSTEM", items: [["notifications", "Notifications"], ["settings", "Settings"]] }
];

function buildShell() {
    const user = Auth.current();
    const page = document.getElementById("page");
    const pageId = document.body.dataset.page;

    if (!user) { location.replace("../login.html"); return false; }

    const navHtml = NAV.map(s => {
        const links = s.items.map(([id, label]) => `
            <a class="nav-link ${id === pageId ? "active" : ""}" href="${id}.html" title="${label}">${icon(id)}<span>${label}</span>${id === "notifications" ? '<em class="nav-count" id="navCount"></em>' : ""}</a>`).join("");
        return `<div class="nav-section"><p class="nav-title">${s.section}</p>${links}</div>`;
    }).join("");

    const roleLabel = "Administrator";
    const wrapper = document.createElement("div");
    wrapper.className = "app";
    wrapper.innerHTML = `
        <aside class="sidebar" id="sidebar">
            <a class="brand" href="dashboard.html"><img src="../assets/images/logo/logo.png" alt=""><span>THE 70'S BISTRO</span></a>
            <nav class="nav">${navHtml}</nav>
            <button class="nav-link logout-link" data-logout>${icon("logout")}<span>Logout</span></button>
        </aside>
        <div class="sidebar-overlay" id="sidebarOverlay"></div>
        <div class="main">
            <header class="topbar">
                <button class="icon-btn" id="menuToggle" aria-label="Toggle navigation">${icon("burger", 22)}</button>
                <span class="topbar-brand">THE 70'S BISTRO</span>
                <h1 class="topbar-title">${esc(document.body.dataset.title || "")}</h1>
                <div class="topbar-right">
                    <button class="icon-btn theme-toggle" id="themeToggle" type="button"><span class="i-sun">${icon("sun", 20)}</span><span class="i-moon">${icon("moon", 20)}</span></button>
                    <div class="dropdown" id="bellDropdown">
                        <button class="icon-btn bell" id="bellBtn" aria-label="Notifications">${icon("notifications", 20)}<span class="bell-count" id="bellCount"></span></button>
                        <div class="dropdown-menu bell-menu" id="bellMenu"></div>
                    </div>
                    <div class="dropdown" id="userDropdown">
                        <button class="user-chip" id="userBtn">
                            <span class="avatar">${esc(user.name.charAt(0).toUpperCase())}</span>
                            <span class="user-meta"><strong>${esc(user.name)}</strong><small>${roleLabel}</small></span>
                        </button>
                        <div class="dropdown-menu user-menu">
                            <div class="user-menu-head"><strong>${esc(user.name)}</strong><small>${esc(user.email)}</small><span class="badge s-admin">${roleLabel}</span></div>
                            <button class="menu-item" data-logout>${icon("logout", 16)} Logout</button>
                        </div>
                    </div>
                </div>
            </header>
            <div class="content" id="content"></div>
        </div>`;
    document.body.prepend(wrapper);
    wrapper.querySelector("#content").appendChild(page);

    const sidebar = wrapper.querySelector("#sidebar");
    const mobile = () => window.matchMedia("(max-width: 900px)").matches;
    try { if (localStorage.getItem("bistro70s_sidebar") === "collapsed") wrapper.classList.add("collapsed"); } catch (e) { }
    wrapper.querySelector("#menuToggle").addEventListener("click", () => {
        if (mobile()) { wrapper.classList.toggle("nav-open"); return; }
        wrapper.classList.toggle("collapsed");
        try { localStorage.setItem("bistro70s_sidebar", wrapper.classList.contains("collapsed") ? "collapsed" : "open"); } catch (e) { }
    });
    wrapper.querySelector("#sidebarOverlay").addEventListener("click", () => wrapper.classList.remove("nav-open"));
    sidebar.querySelectorAll("a.nav-link").forEach(a => a.addEventListener("click", () => wrapper.classList.remove("nav-open")));

    wrapper.querySelectorAll(".dropdown").forEach(dd => {
        dd.querySelector("button").addEventListener("click", e => {
            e.stopPropagation();
            const open = dd.classList.contains("open");
            wrapper.querySelectorAll(".dropdown.open").forEach(x => x.classList.remove("open"));
            if (!open) dd.classList.add("open");
        });
    });
    document.addEventListener("click", e => { if (!e.target.closest(".dropdown")) wrapper.querySelectorAll(".dropdown.open").forEach(x => x.classList.remove("open")); });

    document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", async () => {
        const ok = await UI.confirm({ title: "Log out", message: "Are you sure you want to log out?", confirmText: "Log Out", danger: true });
        if (ok) { Auth.logout(); sessionStorage.setItem("flash", "Successfully logged out."); location.href = "../login.html"; }
    }));

    refreshNotificationBadges();
    return true;
}

function refreshNotificationBadges() {
    const list = DB.list("notifications").slice().sort((a, b) => b.time.localeCompare(a.time));
    const unread = list.filter(n => !n.read).length;
    const setCount = (el, n) => { if (el) { el.textContent = n > 9 ? "9+" : n; el.style.display = n ? "" : "none"; } };
    setCount(document.getElementById("bellCount"), unread);
    setCount(document.getElementById("navCount"), unread);
    const menu = document.getElementById("bellMenu");
    if (menu) {
        menu.innerHTML = `<div class="menu-head"><strong>Notifications</strong><span>${unread} unread</span></div>
            ${list.slice(0, 5).map(n => `<a class="menu-notif ${n.read ? "" : "unread"}" href="notifications.html"><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><small>${fmt.ago(n.time)}</small></a>`).join("")}
            <a class="menu-foot" href="notifications.html">View all notifications</a>`;
    }
}

const Theme = {
    KEY: "bistro70s_theme",
    current() { return document.documentElement.dataset.theme === "light" ? "light" : "dark"; },
    set(theme) {
        document.documentElement.dataset.theme = theme;
        try { localStorage.setItem(this.KEY, theme); } catch (e) { }
        this.updateButton();
    },
    updateButton() {
        const btn = document.getElementById("themeToggle");
        if (!btn) return;
        const next = this.current() === "light" ? "dark" : "light";
        btn.title = `Switch to ${next} mode`;
        btn.setAttribute("aria-label", btn.title);
    },

    init() {
        const btn = document.getElementById("themeToggle");
        if (btn) btn.addEventListener("click", () => this.set(this.current() === "light" ? "dark" : "light"));
        this.updateButton();
    }
};

const SHELL_READY = document.body.dataset.page ? buildShell() : false;
(function showFlash() {
    const flash = sessionStorage.getItem("flash");
    if (flash && SHELL_READY) { sessionStorage.removeItem("flash"); UI.toast(flash); }
})();
Theme.init();
