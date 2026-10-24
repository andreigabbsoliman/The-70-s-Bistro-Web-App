const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
let activeTab = "sales";
let currentReport = null;

function setRange(days) {
    fromDate.value = dayOffset(-(days - 1));
    toDate.value = todayISO();
}
const inRange = iso => iso.slice(0, 10) >= fromDate.value && iso.slice(0, 10) <= toDate.value;

const paidTickets = () => DB.list("transactions").filter(t => t.status === "PAID");
const sumAmount = list => list.reduce((s, t) => s + t.amount, 0);
const sumTickets = list => list.reduce((n, t) => n + t.qty, 0);
const chartMoney = (v, axis) => axis ? (v >= 1000 ? Math.round(v / 1000) + "k" : Math.round(v)) : fmt.peso(v);
const bandName = id => { const e = DB.find("events", id); return e ? e.band : "Deleted event"; };

const REPORTS = {
    sales() {
        const paid = paidTickets();
        const inRangePaid = paid.filter(t => inRange(t.date));
        const since = days => sumAmount(paid.filter(t => t.date.slice(0, 10) >= dayOffset(-(days - 1))));

        const days = [];
        for (let d = new Date(fromDate.value + "T00:00:00"); toISODate(d) <= toDate.value; d.setDate(d.getDate() + 1)) {
            const iso = toISODate(d);
            const list = inRangePaid.filter(t => t.date.startsWith(iso));
            days.push({ date: iso, label: iso.slice(5), transactions: list.length, tickets: sumTickets(list), sales: sumAmount(list) });
        }
        const methods = ["Cash", "Card", "E-Wallet"].map(m => ({ label: m, value: sumAmount(inRangePaid.filter(t => t.method === m)) }));
        return {
            title: "Daily ticket sales",
            cards: [["Today's Sales", fmt.pesoShort(since(1)), "paid today"], ["Weekly Sales", fmt.pesoShort(since(7)), "last 7 days"], ["Monthly Sales", fmt.pesoShort(since(30)), "last 30 days"],
                ["Selected Range", fmt.pesoShort(sumAmount(inRangePaid)), `${sumTickets(inRangePaid)} tickets · ${inRangePaid.length} transactions`]],
            charts: [["Sales per day", el => Charts.line(el, days.map(d => ({ label: d.label, value: d.sales })), { format: chartMoney })],
                ["Payment methods", el => Charts.donut(el, methods, { format: fmt.pesoShort })]],
            columns: [{ key: "date", label: "Date", sortable: true, render: r => fmt.date(r.date) }, { key: "transactions", label: "Transactions", sortable: true },
                { key: "tickets", label: "Tickets", sortable: true }, { key: "sales", label: "Sales", sortable: true, render: r => fmt.peso(r.sales) }],
            rows: days.slice().reverse()
        };
    },

    events() {
        const paid = paidTickets().filter(t => inRange(t.date));
        const rows = DB.list("events").map(e => {
            const sales = paid.filter(t => t.eventId === e.id);
            return { band: e.band, genre: e.genre, date: e.date, status: e.status, price: e.price, capacity: e.capacity, tickets: sumTickets(sales), fill: Math.round(sumTickets(sales) / e.capacity * 100), revenue: sumAmount(sales) };
        }).sort((a, b) => b.tickets - a.tickets);
        const byGenre = {};
        rows.forEach(r => { byGenre[r.genre] = (byGenre[r.genre] || 0) + r.tickets; });
        const best = rows[0];
        return {
            title: "Ticket sales per event",
            cards: [["Tickets Sold", sumTickets(paid), "in range"], ["Ticket Revenue", fmt.pesoShort(sumAmount(paid)), "paid only"], ["Best Seller", best && best.tickets ? esc(best.band) : "—", best && best.tickets ? `${best.tickets} tickets` : ""],
                ["Shows with Sales", rows.filter(r => r.tickets).length, `of ${rows.length} events`]],
            charts: [["Tickets by genre", el => Charts.donut(el, Object.entries(byGenre).filter(([, v]) => v).map(([label, value]) => ({ label, value })))],
                ["Top 6 shows by tickets", el => Charts.bars(el, rows.slice(0, 6).map(r => ({ label: r.band.replace("Band Name ", "#"), value: r.tickets })))]],
            columns: [{ key: "band", label: "Band", sortable: true }, { key: "genre", label: "Genre", sortable: true }, { key: "date", label: "Show Date", sortable: true, render: r => fmt.date(r.date) },
                { key: "status", label: "Status", render: r => UI.badge(r.status) }, { key: "price", label: "Price", sortable: true, render: r => fmt.pesoShort(r.price) },
                { key: "capacity", label: "Capacity", sortable: true }, { key: "tickets", label: "Tickets Sold", sortable: true }, { key: "fill", label: "Sold %", sortable: true, render: r => r.fill + "%" }, { key: "revenue", label: "Revenue", sortable: true, render: r => fmt.peso(r.revenue) }],
            rows
        };
    }
};

function renderReport() {
    if (fromDate.value > toDate.value) { UI.toast("The start date must be before the end date.", "error"); return; }
    const report = REPORTS[activeTab]();
    currentReport = report;
    document.getElementById("rangeLabel").textContent = `${fmt.date(fromDate.value)} – ${fmt.date(toDate.value)}`;
    document.getElementById("reportCards").innerHTML = report.cards.map(([l, v, n]) => `<div class="stat"><small>${l}</small><strong>${v}</strong><span>${n}</span></div>`).join("");
    const chartsEl = document.getElementById("reportCharts");
    chartsEl.innerHTML = report.charts.map(([title], i) => `<div class="card chart-card"><h3>${title}</h3><div data-chart="${i}"></div></div>`).join("");
    report.charts.forEach(([, draw], i) => draw(chartsEl.querySelector(`[data-chart="${i}"]`)));
    document.getElementById("tableTitle").textContent = report.title;
    UI.table(document.getElementById("reportTable"), { columns: report.columns, rows: report.rows, empty: "No data for this date range." });
}

function exportCsv() {
    const { columns, rows, title } = currentReport;
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [columns.map(c => cell(c.label)).join(",")].concat(rows.map(r => columns.map(c => cell(r[c.key])).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `70s-bistro-${activeTab}-report-${fromDate.value}-to-${toDate.value}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    UI.toast(`${title} exported as CSV.`);
}

document.getElementById("reportTabs").addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    activeTab = tab.dataset.tab;
    document.querySelectorAll("#reportTabs .tab").forEach(t => t.classList.toggle("active", t === tab));
    renderReport();
});
document.getElementById("presetChips").addEventListener("click", e => {
    const chip = e.target.closest("[data-days]");
    if (!chip) return;
    document.querySelectorAll("#presetChips .chip").forEach(c => c.classList.toggle("active", c === chip));
    setRange(Number(chip.dataset.days));
    renderReport();
});
[fromDate, toDate].forEach(input => input.addEventListener("change", () => {
    document.querySelectorAll("#presetChips .chip").forEach(c => c.classList.remove("active"));
    renderReport();
}));
document.getElementById("printBtn").addEventListener("click", () => window.print());
document.getElementById("exportBtn").addEventListener("click", exportCsv);

setRange(30);
DB.onChange(renderReport);
renderReport();
