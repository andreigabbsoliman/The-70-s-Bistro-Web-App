const TXN_METHODS = ["Cash", "Card", "E-Wallet"];
const TXN_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const txnTableEl = document.getElementById("txnTable");
const txnSearch = document.getElementById("searchInput");
const eventFilter = document.getElementById("eventFilter");
const methodFilter = document.getElementById("methodFilter");
const txnStatusFilter = document.getElementById("statusFilter");
const txnDateFilter = document.getElementById("dateFilter");

const eventName = id => { const e = DB.find("events", id); return e ? e.band : "Deleted event"; };

function fillEventFilter() {
    const chosen = eventFilter.value;
    eventFilter.innerHTML = '<option value="">All events</option>' + DB.list("events").map(e => `<option value="${e.id}">${esc(e.band)} · ${fmt.date(e.date)}</option>`).join("");
    eventFilter.value = chosen;
}
fillEventFilter();
UI.fillSelect(methodFilter, TXN_METHODS, "All methods");
UI.fillSelect(txnStatusFilter, TXN_STATUSES, "All statuses");

function renderStats() {
    const all = DB.list("transactions");
    const paid = all.filter(t => t.status === "PAID");
    const paidToday = paid.filter(t => t.date.startsWith(todayISO()));
    const cards = [
        ["Paid today", fmt.peso(paidToday.reduce((s, t) => s + t.amount, 0)), `${paidToday.length} transaction${paidToday.length === 1 ? "" : "s"}`],
        ["Tickets sold", paid.reduce((n, t) => n + t.qty, 0), `${fmt.pesoShort(paid.reduce((s, t) => s + t.amount, 0))} total revenue`],
        ["Pending", all.filter(t => t.status === "PENDING").length, "awaiting payment"],
        ["Refunded", fmt.peso(all.filter(t => t.status === "REFUNDED").reduce((s, t) => s + t.amount, 0)), `${all.filter(t => t.status === "FAILED").length} failed payments`]
    ];
    document.getElementById("txnStats").innerHTML = cards.map(([l, v, n]) => `<div class="stat"><small>${l}</small><strong>${v}</strong><span>${n}</span></div>`).join("");
}

function renderTransactions() {
    renderStats();
    const q = txnSearch.value.trim().toLowerCase();
    const rows = DB.list("transactions")
        .map(t => ({ ...t, band: eventName(t.eventId) }))
        .filter(t => (!q || [t.id, t.code, t.buyer, t.band].some(v => v.toLowerCase().includes(q))) &&
            (!eventFilter.value || t.eventId === eventFilter.value) &&
            (!methodFilter.value || t.method === methodFilter.value) &&
            (!txnStatusFilter.value || t.status === txnStatusFilter.value) &&
            (!txnDateFilter.value || t.date.startsWith(txnDateFilter.value)))
        .sort((a, b) => b.date.localeCompare(a.date));

    UI.table(txnTableEl, {
        rows, empty: "No ticket transactions found.",
        columns: [
            { key: "id", label: "Transaction ID", sortable: true, render: t => `<span class="mono">${t.id}</span>` },
            { key: "code", label: "Ticket Code", render: t => `<span class="ticket-code">${t.code}</span>` },
            { key: "band", label: "Event", sortable: true },
            { key: "buyer", label: "Buyer", sortable: true, render: t => `<div class="buyer">${esc(t.buyer)}<small>${esc(t.phone)}</small></div>` },
            { key: "qty", label: "Tickets", sortable: true },
            { key: "amount", label: "Amount", sortable: true, render: t => fmt.peso(t.amount) },
            { key: "method", label: "Payment Method", sortable: true },
            { key: "status", label: "Payment Status", sortable: true, render: t => UI.badge(t.status) },
            { key: "date", label: "Date", sortable: true, render: t => fmt.dateTime(t.date) },
            { key: "actions", label: "Actions", render: t => {
                const actions = [["view", "Details"], ["ticket", "Ticket"]];
                if (t.status === "PENDING") actions.push(["markpaid", "Mark Paid", "btn-success"], ["markfailed", "Failed"]);
                if (t.status === "PAID") actions.push(["refund", "Refund", "btn-danger"]);
                if (t.status === "FAILED") actions.push(["retry", "Retry"]);
                return UI.actions(t.id, actions);
            } }
        ]
    });
}

function openSellTickets() {

    const upcoming = DB.list("events").filter(e => e.status === "UPCOMING" && Flow.ticketStats(e.id).remaining > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (!upcoming.length) { UI.toast("No upcoming show has tickets left to sell.", "info"); return; }
    const maxTickets = DB.data.settings.tickets.maxPerPurchase;
    const fields = [
        { name: "eventId", label: "Event", type: "select", required: true, full: true, options: upcoming.map(e => ({ value: e.id, label: `${e.band} · ${fmt.date(e.date)} · ${fmt.pesoShort(e.price)} · ${Flow.ticketStats(e.id).remaining} left` })) },
        { name: "buyer", label: "Buyer Name", type: "text", required: true, full: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone", type: "tel", required: true, pattern: /^[0-9+()\-\s]{7,20}$/, patternMessage: "Enter a valid phone number." },
        { name: "qty", label: "Number of Tickets", type: "number", required: true, min: 1, max: maxTickets, default: 1, help: `Up to ${maxTickets} tickets per purchase.` },
        { name: "method", label: "Payment Method", type: "select", options: TXN_METHODS },
        { name: "status", label: "Payment Status", type: "select", options: ["PAID", "PENDING"], full: true }
    ];
    const modal = UI.formModal({
        title: "Sell Tickets", fields, submitText: "Create Ticket", values: { qty: 1, status: "PAID" },
        extraHtml: '<div class="sell-total"><span>Total</span><strong id="sellTotal">₱0.00</strong></div>',
        onSubmit: data => {
            const result = Flow.sellTickets(data);
            if (!result.ok) { if (!result.quiet) UI.toast(result.msg, "error"); return false; }
            UI.toast(result.msg);
            refreshNotificationBadges();
            renderTransactions();
            openTicket(result.txn.id);
        }
    });

    const form = modal.body.querySelector("form");
    const updateTotal = () => {
        const event = DB.find("events", form.eventId.value);
        modal.body.querySelector("#sellTotal").textContent = fmt.peso((Number(form.qty.value) || 0) * event.price);
    };
    form.addEventListener("input", updateTotal);
    updateTotal();
}

function openDetails(id) {
    const t = DB.find("transactions", id);
    UI.modal({
        title: `Transaction ${t.id}`,
        body: UI.details([
            ["Ticket code", `<span class="ticket-code">${t.code}</span>`], ["Event", esc(eventName(t.eventId))],
            ["Buyer", esc(t.buyer)], ["Email", esc(t.email)], ["Phone", esc(t.phone)], ["Tickets", t.qty],
            ["Amount", fmt.peso(t.amount)], ["Method", t.method],
            ["Payment status", UI.badge(t.status)], ["Date", fmt.dateTime(t.date)]
        ]),
        footer: [{ label: "Close", cls: "btn-ghost" }, { label: "View Ticket", cls: "btn-primary", onClick: () => { openTicket(id); } }]
    });
}

function openTicket(id) {
    const t = DB.find("transactions", id);
    const event = DB.find("events", t.eventId);
    const biz = DB.data.settings.business;
    UI.modal({
        title: "Ticket", size: "sm",
        body: `<div class="ticket">
            <h4>${esc(biz.name)}</h4>
            <p class="center">${esc(biz.address)}</p><hr>
            <p class="center">LIVE BAND NIGHT</p>
            <p class="band">${esc(eventName(t.eventId))}</p>
            ${event ? `<p class="center">${esc(event.genre)} · ${fmt.date(event.date)} · ${fmt.time(event.time)}</p>` : ""}
            <div class="code">${t.code}</div>
            <div class="line"><span>Buyer</span><span>${esc(t.buyer)}</span></div>
            <div class="line"><span>Tickets</span><span>${t.qty}</span></div>
            <div class="line"><span>Price each</span><span>${fmt.peso(t.amount / t.qty)}</span></div>
            <div class="line grand"><span>TOTAL</span><span>${fmt.peso(t.amount)}</span></div>
            <div class="line"><span>Paid via</span><span>${t.method}</span></div>
            <div class="line"><span>Reference</span><span>${t.id}</span></div>
            <div class="stamp ${t.status.toLowerCase()}">${t.status}</div>
            <hr><p class="center">Present this code at the door.</p>
        </div>`,
        footer: [
            { label: "Close", cls: "btn-ghost" },
            { label: "Print", cls: "btn-primary", keepOpen: true, onClick: () => { document.body.classList.add("print-ticket"); window.print(); } }
        ],
        onClose: () => document.body.classList.remove("print-ticket")
    });
}

function changeStatus(id, status, message) {
    const result = Flow.setTicketStatus(id, status);
    if (!result.ok) { if (!result.quiet) UI.toast(result.msg, "error"); return; }
    UI.toast(message);
    refreshNotificationBadges();
    renderTransactions();
}

UI.onAction(txnTableEl, async (action, id) => {
    if (action === "view") openDetails(id);
    if (action === "ticket") openTicket(id);
    if (action === "markpaid") changeStatus(id, "PAID", "Transaction marked as paid.");
    if (action === "markfailed") changeStatus(id, "FAILED", "Transaction marked as failed.");
    if (action === "retry") changeStatus(id, "PENDING", "Transaction set back to pending.");
    if (action === "refund") {
        const ok = await UI.confirm({ title: "Refund transaction", message: `Refund <strong>${id}</strong>? The amount will be marked as refunded and the tickets no longer count as sold.`, confirmText: "Refund", danger: true });
        if (ok) changeStatus(id, "REFUNDED", "Transaction refunded.");
    }
});

txnSearch.addEventListener("input", debounce(renderTransactions, 150));
[eventFilter, methodFilter, txnStatusFilter, txnDateFilter].forEach(el => el.addEventListener("change", renderTransactions));
document.getElementById("clearFilters").addEventListener("click", () => {
    txnSearch.value = ""; eventFilter.value = ""; methodFilter.value = ""; txnStatusFilter.value = ""; txnDateFilter.value = "";
    renderTransactions();
});
document.getElementById("sellTicketsBtn").addEventListener("click", openSellTickets);

DB.onChange(() => { fillEventFilter(); renderTransactions(); });
renderTransactions();
UI.openFromQuery(openSellTickets);
