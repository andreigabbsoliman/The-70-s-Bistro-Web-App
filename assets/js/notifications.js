const NOTIF_EMOJI = { ticket: "🎟️", system: "⚙️" };
const notifFeed = document.getElementById("notifFeed");
const typeFilter = document.getElementById("typeFilter");
let readFilter = "";

function renderNotifications() {
    const all = DB.list("notifications");
    const list = all.filter(n => (!readFilter || (readFilter === "read") === n.read) && (!typeFilter.value || n.type === typeFilter.value))
        .sort((a, b) => b.time.localeCompare(a.time));

    const unread = all.filter(n => !n.read).length;
    document.getElementById("unreadSummary").textContent = unread ? `You have ${unread} unread notification${unread > 1 ? "s" : ""}.` : "You're all caught up.";
    document.getElementById("markAllBtn").disabled = !unread;

    notifFeed.innerHTML = list.length ? list.map(n => `
        <li class="notif-item ${n.read ? "" : "unread"}">
            <span class="notif-icon ${n.type}">${NOTIF_EMOJI[n.type] || "🔔"}</span>
            <div class="notif-text"><strong>${esc(n.title)}</strong><p>${esc(n.message)}</p><small>${fmt.ago(n.time)} · ${fmt.dateTime(n.time)}</small></div>
            ${UI.actions(n.id, [[n.read ? "unread" : "read", n.read ? "Mark as unread" : "Mark as read"], ["delete", "Delete", "btn-danger"]])}
        </li>`).join("") : '<li class="empty-state">No notifications to show.</li>';
    refreshNotificationBadges();
}

UI.onAction(notifFeed, (action, id) => {
    if (action === "read" && DB.update("notifications", id, { read: true })) UI.toast("Notification marked as read.");
    if (action === "unread" && DB.update("notifications", id, { read: false })) UI.toast("Notification marked as unread.");
    if (action === "delete") { DB.remove("notifications", id); UI.toast("Notification deleted."); }
    renderNotifications();
});

document.getElementById("markAllBtn").addEventListener("click", () => {
    DB.markAllRead();
    UI.toast("All notifications marked as read.");
    renderNotifications();
});
document.getElementById("readTabs").addEventListener("click", e => {
    const tab = e.target.closest("[data-read]");
    if (!tab) return;
    readFilter = tab.dataset.read;
    document.querySelectorAll("#readTabs .tab").forEach(t => t.classList.toggle("active", t === tab));
    renderNotifications();
});
typeFilter.addEventListener("change", renderNotifications);

DB.onChange(renderNotifications);
renderNotifications();
