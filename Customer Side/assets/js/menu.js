document.addEventListener("DOMContentLoaded", async () => {
    const search = document.getElementById("menuSearch");
    const empty = document.getElementById("menuEmpty");
    const toolbar = document.querySelector(".menu-toolbar");

    let products;
    try {
        products = (await Site.load()).products;
    } catch (error) {
        empty.textContent = error.message;
        empty.classList.add("show");
        return;
    }
    Site.watch();

    const esc = Site.escape;
    const groups = Site.categories
        .map((name) => ({ name, id: Site.slug(name), dishes: products.filter((p) => p.category === name) }))
        .filter((group) => group.dishes.length);

    document.querySelector(".menu-tabs").innerHTML =
        `<button class="menu-tab active" type="button" data-filter="all">All<sup>${products.length}</sup></button>` +
        groups.map((g) => `<button class="menu-tab" type="button" data-filter="${g.id}">${esc(g.name)}<sup>${g.dishes.length}</sup></button>`).join("");

    document.getElementById("menuCategories").innerHTML = groups.map((g) => `
            <section class="menu-cat" id="${g.id}">
                <div class="menu-cat-head">
                    <h2>${esc(g.name)}</h2>
                    <span class="menu-cat-count">${g.dishes.length} ITEM${g.dishes.length === 1 ? "" : "S"}</span>
                </div>
                <div class="dish-grid">${g.dishes.map((d, i) => `
                    <article class="dish${d.available ? "" : " sold-out"}" data-search="${esc(d.name.toLowerCase())}">
                        <div class="dish-image">
                            <img src="${esc(d.image)}" alt="${esc(d.name)}" loading="lazy">
                            ${d.available ? "" : '<span class="dish-soldout">SOLD OUT</span>'}
                        </div>
                        <div class="dish-body">
                            <span class="dish-num">${String(i + 1).padStart(2, "0")}</span>
                            <h3>${esc(d.name)}</h3>
                        </div>
                        ${d.price ? `<span class="dish-price">${Site.peso(d.price)}</span>` : '<span class="dish-price na">—</span>'}
                    </article>`).join("")}
                </div>
            </section>`).join("");

    const tabs = document.querySelectorAll(".menu-tab");
    const categories = document.querySelectorAll(".menu-cat");

    let activeCategory = "all";

    const apply = () => {
        const query = search.value.trim().toLowerCase();
        let visibleDishes = 0;

        categories.forEach((cat) => {
            const inCategory = activeCategory === "all" || cat.id === activeCategory;
            let matches = 0;

            cat.querySelectorAll(".dish").forEach((dish) => {
                const text = dish.dataset.search;
                const show = inCategory && (!query || text.includes(query));
                dish.classList.toggle("hidden", !show);
                if (show) matches++;
            });

            cat.classList.toggle("hidden", matches === 0);
            visibleDishes += matches;
        });

        empty.classList.toggle("show", visibleDishes === 0);
    };

    const selectTab = (tab, scroll) => {
        activeCategory = tab.dataset.filter;
        tabs.forEach((item) => item.classList.toggle("active", item === tab));
        tab.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
        apply();

        if (scroll) {
            const top = toolbar.parentElement.querySelector(".menu-body").offsetTop - toolbar.offsetHeight;
            window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });
        }
    };

    tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab, true)));

    search.addEventListener("input", () => {

        if (search.value && activeCategory !== "all") {
            selectTab(document.querySelector('.menu-tab[data-filter="all"]'), false);
        } else {
            apply();
        }
    });

    const hash = window.location.hash.slice(1);
    const hashTab = hash && document.querySelector(`.menu-tab[data-filter="${CSS.escape(hash)}"]`);
    if (hashTab) selectTab(hashTab, false);

    window.revealOnScroll(document.querySelectorAll(".menu-cat"));
});
