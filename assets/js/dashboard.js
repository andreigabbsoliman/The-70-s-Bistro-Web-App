const currentUser = Auth.current();
const dashPrefs = () => DB.data.settings.prefs;

function renderWelcome() {
    document.getElementById("welcomeTitle").textContent = `${UI.greeting()}, ${currentUser.name}`;
}

const upcomingShows = () => DB.list("events").filter(e => e.status === "UPCOMING")
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map(e => ({ ...e, ...Flow.ticketStats(e.id) }));

function renderStats() {
    const shows = upcomingShows();
    const transactions = DB.list("transactions");
    const cards = [
        ["Upcoming Shows", shows.length, shows[0] ? `next: ${shows[0].band}` : "nothing scheduled"],
        ["Tickets Sold", shows.reduce((n, e) => n + e.sold, 0), "for upcoming shows"],
        ["Seats Remaining", shows.reduce((n, e) => n + e.remaining, 0), `of ${shows.reduce((n, e) => n + e.capacity, 0)} seats`],
        ["Pending Payments", transactions.filter(t => t.status === "PENDING").length, "waiting to be paid"]
    ];
    if (dashPrefs().showSales) {
        const salesToday = transactions.filter(t => t.status === "PAID" && t.date.startsWith(todayISO())).reduce((sum, t) => sum + t.amount, 0);
        cards.push(["Ticket Sales Today", fmt.pesoShort(salesToday), "paid transactions"]);
    }
    document.getElementById("statGrid").innerHTML = cards.map(([label, value, note]) =>
        `<div class="stat"><small>${label}</small><strong>${value}</strong><span>${esc(note)}</span></div>`).join("");
}

function renderUpcomingShows() {
    UI.table(document.getElementById("upcomingShows"), {
        rows: upcomingShows().slice(0, 6), empty: "No upcoming shows. Add one from Events.",
        columns: [
            { key: "band", label: "Band" },
            { key: "genre", label: "Genre" },
            { key: "date", label: "Date", render: e => `${fmt.date(e.date)}, ${fmt.time(e.time)}` },
            { key: "price", label: "Price", render: e => fmt.pesoShort(e.price) },
            { key: "sold", label: "Tickets", render: e => {
                const held = e.sold + e.pending;
                const pct = Math.round(held / e.capacity * 100);
                return `<div class="fill"><div class="fill-bar ${e.remaining ? "" : "full"}"><i style="width:${pct}%"></i></div><small>${e.remaining ? `${held} / ${e.capacity}` : "SOLD OUT"}</small></div>`;
            } },
            { key: "revenue", label: "Revenue", render: e => fmt.pesoShort(e.revenue) }
        ]
    });
}

function renderRecentTickets() {
    const rows = DB.list("transactions").slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    UI.table(document.getElementById("recentTickets"), {
        rows, empty: "No ticket transactions yet.",
        columns: [
            { key: "id", label: "Transaction", render: t => `<span class="mono">${t.id}</span>` },
            { key: "buyer", label: "Buyer" },
            { key: "eventId", label: "Event", render: t => { const e = DB.find("events", t.eventId); return esc(e ? e.band : "—"); } },
            { key: "qty", label: "Qty" },
            { key: "amount", label: "Amount", render: t => fmt.pesoShort(t.amount) },
            { key: "status", label: "Status", render: t => UI.badge(t.status) },
            { key: "actions", label: "Action", render: t => t.status === "PENDING" ? UI.actions(t.id, [["markpaid", "Mark Paid", "btn-success"]]) : `<a class="btn btn-sm btn-ghost" href="transactions.html">View</a>` }
        ]
    });
}

function renderSales() {
    const card = document.getElementById("salesCard");
    if (!dashPrefs().showSales) { card.style.display = "none"; return; }
    card.style.display = "";
    const paid = DB.list("transactions").filter(t => t.status === "PAID");
    const sumFrom = dayCount => {
        const from = dayOffset(-(dayCount - 1));
        return paid.filter(t => t.date.slice(0, 10) >= from).reduce((s, t) => s + t.amount, 0);
    };
    document.getElementById("salesSummary").innerHTML =
        [["Today", sumFrom(1)], ["7 days", sumFrom(7)], ["30 days", sumFrom(30)]].map(([l, v]) => `<div><small>${l}</small><strong>${fmt.pesoShort(v)}</strong></div>`).join("");

    const days = [];
    for (let i = 6; i >= 0; i--) {
        const iso = dayOffset(-i);
        const label = new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
        days.push({ label, value: paid.filter(t => t.date.startsWith(iso)).reduce((s, t) => s + t.amount, 0) });
    }
    Charts.bars(document.getElementById("salesChart"), days, { format: (v, axis) => axis ? (v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v)) : fmt.peso(v) });
}

function renderNotifications() {
    const card = document.getElementById("notifCard");
    if (!dashPrefs().showNotifications) { card.style.display = "none"; return; }
    card.style.display = "";
    const list = DB.list("notifications").slice().sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);
    document.getElementById("recentNotifications").innerHTML = list.map(n =>
        `<li class="${n.read ? "" : "unread"}"><div><strong>${esc(n.title)}</strong><span>${esc(n.message)}</span><small>${fmt.ago(n.time)}</small></div></li>`).join("");
}

function renderAll() {
    renderStats();
    renderUpcomingShows();
    renderRecentTickets();
    renderSales();
    renderNotifications();
    refreshNotificationBadges();
}

UI.onAction(document.getElementById("recentTickets"), (action, id) => {
    const result = Flow.setTicketStatus(id, "PAID");
    if (result.ok || !result.quiet) UI.toast(result.ok ? "Transaction marked as paid." : result.msg, result.ok ? "success" : "error");
    renderAll();
});

renderWelcome();
DB.onChange(renderAll);
renderAll();
