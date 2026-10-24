const SESSION_KEY = "bistro70s_admin_session";
const SYNC_INTERVAL = 3000;

const pad2 = n => String(n).padStart(2, "0");
const toISODate = dt => `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;

function dayOffset(n) {
    const dt = new Date();
    dt.setDate(dt.getDate() + n);
    return toISODate(dt);
}

const stamp = (n, h, m = 0) => `${dayOffset(n)}T${pad2(h)}:${pad2(m)}:00`;

const nowStamp = () => stamp(0, new Date().getHours(), new Date().getMinutes()).slice(0, 17) + pad2(new Date().getSeconds());

const MENU_CATEGORIES = ["Appetizers", "Seafoods", "Vegetables", "Meat", "Others", "Meal Treats", "Pizza", "Pasta"];

const Auth = {
    login(email, password) {
        const res = apiCall("POST", "/login", { email, password });
        if (res.status === 0) return { error: "Can't reach the server. Start it with start-server.bat." };
        if (res.status !== 200) return { error: res.data.error || "Incorrect email or password." };
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...res.data.user, token: res.data.token }));
        return { user: res.data.user };
    },
    current() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
    },

    forget() { localStorage.removeItem(SESSION_KEY); },
    logout() {
        apiCall("POST", "/admin/logout");
        this.forget();
    }
};

function apiCall(method, path, body) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, "/api" + path, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    const session = Auth.current();
    if (session && session.token) xhr.setRequestHeader("Authorization", "Bearer " + session.token);
    try { xhr.send(body === undefined ? null : JSON.stringify(body)); } catch (e) { return { status: 0, data: {}, version: 0 }; }
    let data = {};
    try { data = JSON.parse(xhr.responseText); } catch (e) {  }
    return { status: xhr.status, data, version: Number(xhr.getResponseHeader("X-Version")) || 0 };
}

const emptyDb = () => ({
    products: [], events: [], transactions: [], gallery: [], notifications: [],
    settings: {
        business: { name: "", address: "", phone: "", email: "" }, hours: {},
        tickets: { maxPerPurchase: 10, defaultCapacity: 200 }, prefs: { notifyTicket: true, showSales: true, showNotifications: true }
    }
});

const DB = {
    data: emptyDb(),
    version: 0,
    lastError: "",
    listeners: [],

    load() {
        if (!Auth.current()) return;
        const res = apiCall("GET", "/admin/db");
        if (res.status === 401) { Auth.forget(); if (!/login\.html$/.test(location.pathname)) location.replace("../login.html"); return; }
        if (res.status !== 200) { this.showOffline(); return; }
        this.apply(res.data);
        this.startSync();
    },
    apply(payload) {
        const { version, ...data } = payload;
        this.data = { ...emptyDb(), ...data };
        this.version = version;
    },
    showOffline() {
        document.addEventListener("DOMContentLoaded", () => {
            const box = document.createElement("div");
            box.style.cssText = "position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#14110f;color:#f2ece2;font:16px/1.6 system-ui,sans-serif;padding:24px;text-align:center";
            box.innerHTML = "<div><h2 style='margin:0 0 8px'>Can't reach the server</h2><p>Start it with <b>start-server.bat</b> (or <code>python server.py</code>),<br>then open <b>http://localhost:8000/admin/login.html</b>.</p></div>";
            document.body.appendChild(box);
        });
    },

    onChange(fn) { this.listeners.push(fn); },
    notifyChange() {
        if (typeof refreshNotificationBadges === "function" && document.getElementById("bellMenu")) refreshNotificationBadges();
        this.listeners.forEach(fn => fn());
    },

    startSync() {
        setInterval(async () => {
            const session = Auth.current();
            if (document.hidden || !session) return;
            try {
                const { version } = await (await fetch("/api/version", { cache: "no-store" })).json();
                if (version === this.version) return;
                const res = await fetch("/api/admin/db", { cache: "no-store", headers: { Authorization: "Bearer " + session.token } });
                if (res.status === 401) { Auth.forget(); location.replace("../login.html"); return; }
                this.apply(await res.json());
                this.notifyChange();
            } catch (e) {  }
        }, SYNC_INTERVAL);
    },

    _done(res) {
        if (res.status >= 200 && res.status < 300) {
            if (res.version === this.version + 1) this.version = res.version;
            this.lastError = "";
            return true;
        }
        this.lastError = res.status === 0 ? "Can't reach the server." : (res.data.error || "Something went wrong.");
        if (res.status === 401) { Auth.forget(); location.replace("../login.html"); return false; }
        if (typeof UI !== "undefined") UI.toast(this.lastError, "error");
        if (res.status === 404 || res.status === 409) this.refresh();
        return false;
    },

    refresh() {
        const res = apiCall("GET", "/admin/db");
        if (res.status === 200) { this.apply(res.data); this.notifyChange(); }
    },

    list(name) { return this.data[name]; },
    find(name, id) { return this.data[name].find(item => item.id === id); },

    add(name, item) {
        const res = apiCall("POST", "/admin/" + name, item);
        if (!this._done(res)) return null;
        this.data[name].unshift(res.data);
        return res.data;
    },

    update(name, id, changes) {
        const res = apiCall("PUT", `/admin/${name}/${id}`, changes);
        if (!this._done(res)) return null;
        const item = this.find(name, id);
        if (item) Object.assign(item, res.data); else this.data[name].unshift(res.data);
        return item || res.data;
    },
    remove(name, id) {
        if (!this._done(apiCall("DELETE", `/admin/${name}/${id}`))) return;
        this.data[name] = this.data[name].filter(item => item.id !== id);
    },
    saveSettings() {
        return this._done(apiCall("PUT", "/admin/settings", this.data.settings));
    },
    markAllRead() {
        if (this._done(apiCall("POST", "/admin/notifications/read-all"))) this.data.notifications.forEach(n => { n.read = true; });
    },

    reset() {
        const res = apiCall("POST", "/admin/reset");
        if (this._done(res)) this.apply(res.data);
    }
};
DB.load();

const Flow = {

    notify(type, title, message) {
        if (type === "ticket" && !DB.data.settings.prefs.notifyTicket) return;
        DB.add("notifications", { type, title, message, time: nowStamp(), read: false });
    },

    ticketStats(eventId) {
        const event = DB.find("events", eventId);
        const sales = DB.list("transactions").filter(t => t.eventId === eventId);
        const byStatus = status => sales.filter(t => t.status === status);
        const sold = byStatus("PAID").reduce((n, t) => n + t.qty, 0);
        const pending = byStatus("PENDING").reduce((n, t) => n + t.qty, 0);
        const capacity = event ? event.capacity : 0;
        return { sold, pending, capacity, remaining: Math.max(0, capacity - sold - pending), revenue: byStatus("PAID").reduce((n, t) => n + t.amount, 0) };
    },

    newTicketCode() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        return "70B-" + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    },

    sellTickets({ eventId, buyer, email, phone, qty, method, status }) {
        const event = DB.find("events", eventId);
        const { remaining } = this.ticketStats(eventId);
        if (qty > remaining) return { ok: false, msg: remaining ? `Only ${remaining} ticket${remaining > 1 ? "s" : ""} left for ${event.band}.` : `${event.band} is sold out.` };
        const txn = DB.add("transactions", {
            code: this.newTicketCode(), eventId, buyer, email, phone, qty,
            amount: qty * event.price, method, status, date: nowStamp()
        });
        if (!txn) return { ok: false, msg: DB.lastError, quiet: true };
        this.notify("ticket", "Ticket Purchase", `${buyer} reserved ${qty} ticket${qty > 1 ? "s" : ""} for ${event.band}.`);
        return { ok: true, msg: `Ticket ${txn.code} created.`, txn };
    },

    setTicketStatus(id, status) {
        const txn = DB.find("transactions", id);

        if (["PENDING", "PAID"].includes(status) && ["FAILED", "REFUNDED"].includes(txn.status) && DB.find("events", txn.eventId)) {
            const { remaining } = this.ticketStats(txn.eventId);
            if (txn.qty > remaining) return { ok: false, msg: `Not enough seats left (${remaining}) to restore this sale.` };
        }
        if (!DB.update("transactions", id, { status })) return { ok: false, msg: DB.lastError, quiet: true };
        if (status === "PAID") this.notify("ticket", "Payment Completed", `Transaction #${id.replace("TXN-", "")} has been paid.`);
        if (status === "FAILED") this.notify("ticket", "Payment Failed", `Payment for ticket ${txn.code} failed.`);
        if (status === "REFUNDED") this.notify("ticket", "Refund Processed", `Transaction #${id.replace("TXN-", "")} was refunded.`);
        return { ok: true };
    }
};
