const PRODUCT_CATEGORIES = MENU_CATEGORIES;
const CATEGORY_EMOJI = { "Appetizers": "🍤", "Seafoods": "🦐", "Vegetables": "🥗", "Meat": "🥩", "Others": "🍽️", "Meal Treats": "🍛", "Pizza": "🍕", "Pasta": "🍝" };

const productGrid = document.getElementById("productGrid");
const productSearch = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const availabilityFilter = document.getElementById("availabilityFilter");

UI.fillSelect(categoryFilter, PRODUCT_CATEGORIES, "All categories");

const productFields = [
    { name: "name", label: "Dish Name", type: "text", required: true, full: true },
    { name: "category", label: "Category", type: "select", options: PRODUCT_CATEGORIES, required: true },
    { name: "price", label: "Price (₱)", type: "number", required: true, min: 1 },
    { name: "image", label: "Image", type: "image" },
    { name: "available", label: "Available for ordering", type: "checkbox", full: true, default: true }
];

function renderProducts() {
    const q = productSearch.value.trim().toLowerCase();
    const list = DB.list("products").filter(p =>
        (!q || p.name.toLowerCase().includes(q)) &&
        (!categoryFilter.value || p.category === categoryFilter.value) &&
        (!availabilityFilter.value || (availabilityFilter.value === "yes") === p.available));

    if (!list.length) { productGrid.innerHTML = '<p class="empty-state">No dishes match your filters.</p>'; return; }
    productGrid.innerHTML = list.map(p => `
        <article class="product-card ${p.available ? "" : "sold-out"}">
            <div class="product-media">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}">` : CATEGORY_EMOJI[p.category] || "🍽️"}</div>
            <div class="product-body">
                <span class="product-cat">${esc(p.category)}</span>
                <div class="product-top"><h3>${esc(p.name)}</h3><span class="product-price">${p.price ? fmt.peso(p.price) : "Price TBC"}</span></div>
                <div class="product-foot">
                    <label class="avail"><span class="switch"><input type="checkbox" data-toggle="${p.id}" ${p.available ? "checked" : ""}><span></span></span>${p.available ? "Available" : "Sold out"}</label>
                    ${UI.actions(p.id, [["price", "Price"], ["edit", "Edit"], ["delete", "Delete", "btn-danger"]])}
                </div>
            </div>
        </article>`).join("");
}

function openAddProduct() {
    UI.formModal({
        title: "Add Dish", fields: productFields, values: { available: true }, submitText: "Add Dish",
        onSubmit: data => {
            if (!DB.add("products", data)) return false;
            UI.toast("Dish added.");
            renderProducts();
        }
    });
}

function openEditProduct(id) {
    UI.formModal({
        title: "Edit Dish", fields: productFields, values: DB.find("products", id),
        onSubmit: data => {
            if (!DB.update("products", id, data)) return false;
            UI.toast("Dish updated.");
            renderProducts();
        }
    });
}

function openChangePrice(id) {
    const p = DB.find("products", id);
    UI.formModal({
        title: `Change Price — ${p.name}`, size: "sm", submitText: "Update Price", values: { price: p.price },
        fields: [{ name: "price", label: `New price (currently ${p.price ? fmt.peso(p.price) : "to be confirmed"})`, type: "number", required: true, min: 1, full: true }],
        onSubmit: data => {
            if (!DB.update("products", id, { price: data.price })) return false;
            UI.toast("Dish updated.");
            renderProducts();
        }
    });
}

UI.onAction(productGrid, async (action, id) => {
    if (action === "edit") openEditProduct(id);
    if (action === "price") openChangePrice(id);
    if (action === "delete") {
        const p = DB.find("products", id);
        const ok = await UI.confirm({ title: "Delete dish", message: `Delete <strong>${esc(p.name)}</strong> from the menu?`, confirmText: "Delete", danger: true });
        if (ok) { DB.remove("products", id); UI.toast("Dish deleted."); renderProducts(); }
    }
});
productGrid.addEventListener("change", e => {
    const toggle = e.target.closest("[data-toggle]");
    if (!toggle) return;
    if (DB.update("products", toggle.dataset.toggle, { available: toggle.checked })) UI.toast(toggle.checked ? "Dish is now available." : "Dish marked as sold out.");
    renderProducts();
});
productSearch.addEventListener("input", debounce(renderProducts, 150));
categoryFilter.addEventListener("change", renderProducts);
availabilityFilter.addEventListener("change", renderProducts);
document.getElementById("addProductBtn").addEventListener("click", openAddProduct);

DB.onChange(renderProducts);
renderProducts();
