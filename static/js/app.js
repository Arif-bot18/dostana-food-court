// Dostana Multi-Vendor Food Court Application - Client Core

const APP_STATE = {
  foodCourt: {
    name: "Dostana",
    subtitle: "Your food. Your way.",
    description: "Explore food from your favourite spots at Dostana.",
    default_table: "T12"
  },
  vendors: [],
  activeVendorId: null,
  activeCategory: "All",
  searchQuery: "",
  tableNo: "T12",
  // Unified multi-vendor cart
  cart: {
    items: [] // { id, name, price, quantity, vendor_id, vendor_name, vendor_code, specialInstructions, is_veg, image }
  },
  activeDetailItem: null,
  currentOrder: null,
  trackingPollTimer: null
};

document.addEventListener("DOMContentLoaded", () => {
  initTableContext();
  loadCartFromStorage();
  loadVendors();
  setupEventListeners();
});

function initTableContext() {
  const urlParams = new URLSearchParams(window.location.search);
  const tableParam = urlParams.get("table");
  if (tableParam) {
    APP_STATE.tableNo = tableParam.trim().toUpperCase();
  } else {
    const savedTable = localStorage.getItem("dostana_table");
    if (savedTable) {
      APP_STATE.tableNo = savedTable;
    }
  }
  localStorage.setItem("dostana_table", APP_STATE.tableNo);
  updateTableBadges();
}

function updateTableBadges() {
  const tableBadges = document.querySelectorAll(".table-badge-text");
  tableBadges.forEach(el => {
    el.textContent = `Table ${APP_STATE.tableNo}`;
  });
}

function setDemoTable(table) {
  APP_STATE.tableNo = table.trim().toUpperCase();
  localStorage.setItem("dostana_table", APP_STATE.tableNo);
  updateTableBadges();
  closeModal('qr-modal');
  showToast(`Active table set to ${APP_STATE.tableNo}`);
  if (document.getElementById("screen-cart") && !document.getElementById("screen-cart").classList.contains("hidden")) {
    renderCart();
  }
}

function saveCartToStorage() {
  localStorage.setItem("dostana_cart", JSON.stringify(APP_STATE.cart));
}

function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem("dostana_cart");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.items)) {
        APP_STATE.cart = parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load cart", e);
  }
}

async function loadVendors() {
  try {
    const res = await fetch("/api/vendors");
    if (res.ok) {
      APP_STATE.vendors = await res.json();
    }
  } catch (err) {
    console.warn("API fetch error", err);
  }
  renderWelcomeScreen();
  updateStickyCartBar();
}

// SCREEN 1: DOSTANA WELCOME SCREEN
function renderWelcomeScreen() {
  const vendorGrid = document.getElementById("welcome-vendor-grid");
  if (!vendorGrid) return;
  vendorGrid.innerHTML = "";

  APP_STATE.vendors.forEach(vendor => {
    const card = document.createElement("div");
    card.className = "vendor-card bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between overflow-hidden cursor-pointer hover:shadow-md transition-all";
    
    const isInactive = !vendor.is_active;

    let stallEmoji = "🍴";
    if (vendor.id.includes("shawarma")) stallEmoji = "🌯";
    else if (vendor.id.includes("tiffin")) stallEmoji = "🥘";
    else if (vendor.id.includes("chai")) stallEmoji = "☕";
    else if (vendor.id.includes("snack")) stallEmoji = "🥪";

    card.innerHTML = `
      <div class="relative w-full h-44 rounded-xl overflow-hidden mb-3">
        <img src="${vendor.image}" alt="${vendor.name}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy">
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div class="absolute top-2.5 left-2.5">
          <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-black/50 backdrop-blur-sm text-orange-300 border border-white/10">
            Independent Stall
          </span>
        </div>
        <div class="absolute top-2.5 right-2.5">
          <span class="px-2.5 py-1 text-xs font-bold rounded-full ${isInactive ? 'bg-gray-800/90 text-gray-200' : 'bg-white/95 text-gray-900 shadow-sm'}">
            ${vendor.badge || (isInactive ? 'Opening Soon' : 'Open')}
          </span>
        </div>
        <div class="absolute bottom-2.5 left-3 right-3 flex justify-between items-end text-white">
          <div>
            <span class="text-[11px] uppercase tracking-wider font-bold text-orange-200 block">${vendor.category}</span>
            <h3 class="text-lg font-display font-extrabold leading-snug drop-shadow-sm">${stallEmoji} ${vendor.name}</h3>
          </div>
          ${!isInactive ? `
          <div class="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-semibold text-amber-300">
            <span>★</span>
            <span>${vendor.rating}</span>
          </div>` : ''}
        </div>
      </div>
      
      <p class="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed font-medium">
        ${vendor.short_desc || vendor.tagline || ''}
      </p>

      <div class="flex items-center justify-between pt-2 border-t border-gray-50">
        <div class="flex items-center text-xs text-gray-500 font-medium">
          <svg class="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          ${vendor.prep_time}
        </div>
        <button class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
          isInactive 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm'
        }">
          ${isInactive ? 'Opening Soon' : 'View Menu →'}
        </button>
      </div>
    `;

    if (!isInactive) {
      card.addEventListener("click", () => openVendorMenu(vendor.id));
    } else {
      card.addEventListener("click", () => {
        showToast("Quick Bites & Chaat is opening soon at Dostana!");
      });
    }

    vendorGrid.appendChild(card);
  });
}

function showWelcomeScreen() {
  stopTrackingPoll();
  switchScreen("screen-welcome");
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// SCREEN 2: VENDOR MENU SCREEN
function openVendorMenu(vendorId) {
  stopTrackingPoll();
  const vendor = APP_STATE.vendors.find(v => v.id === vendorId);
  if (!vendor) return;

  APP_STATE.activeVendorId = vendorId;
  APP_STATE.activeCategory = "All";
  APP_STATE.searchQuery = "";

  document.getElementById("menu-vendor-name").textContent = vendor.name;
  document.getElementById("menu-vendor-category").textContent = vendor.category;
  document.getElementById("menu-vendor-rating").textContent = vendor.rating;
  document.getElementById("menu-vendor-reviews").textContent = vendor.review_count;
  document.getElementById("menu-vendor-prep").textContent = vendor.prep_time;
  
  const bannerImg = document.getElementById("menu-vendor-banner");
  if (bannerImg) {
    bannerImg.src = vendor.banner_image || vendor.image;
    bannerImg.alt = vendor.name;
  }

  const searchInput = document.getElementById("menu-search-input");
  if (searchInput) searchInput.value = "";

  renderCategoryPills(vendor);
  renderMenuItems();
  updateStickyCartBar();
  switchScreen("screen-menu");
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCategoryPills(vendor) {
  const container = document.getElementById("menu-category-pills");
  if (!container) return;
  container.innerHTML = "";

  const categories = vendor.categories || ["All"];

  categories.forEach(cat => {
    const btn = document.createElement("button");
    const isActive = (cat === APP_STATE.activeCategory);
    btn.className = `px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
      isActive 
        ? 'bg-orange-500 text-white shadow-sm' 
        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
    }`;
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      APP_STATE.activeCategory = cat;
      renderCategoryPills(vendor);
      renderMenuItems();
    });
    container.appendChild(btn);
  });
}

function filterMenuItems() {
  const input = document.getElementById("menu-search-input");
  APP_STATE.searchQuery = (input.value || "").toLowerCase().trim();
  renderMenuItems();
}

function renderMenuItems() {
  const vendor = APP_STATE.vendors.find(v => v.id === APP_STATE.activeVendorId);
  const container = document.getElementById("menu-items-list");
  if (!vendor || !container) return;

  container.innerHTML = "";
  let items = vendor.menu || [];

  if (APP_STATE.activeCategory && APP_STATE.activeCategory !== "All") {
    items = items.filter(i => i.category === APP_STATE.activeCategory);
  }

  if (APP_STATE.searchQuery) {
    items = items.filter(i => 
      i.name.toLowerCase().includes(APP_STATE.searchQuery) || 
      i.description.toLowerCase().includes(APP_STATE.searchQuery)
    );
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 px-4 bg-white rounded-2xl border border-gray-100">
        <div class="w-12 h-12 mx-auto mb-2 text-gray-300">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <p class="text-sm font-semibold text-gray-700">No items found</p>
        <p class="text-xs text-gray-400 mt-1">Try another search or filter category</p>
      </div>
    `;
    return;
  }

  items.forEach(item => {
    // Check quantity of this item in the multi-vendor cart
    const cartItem = APP_STATE.cart.items.find(i => i.id === item.id);
    const qtyInCart = cartItem ? cartItem.quantity : 0;

    const card = document.createElement("div");
    card.className = "bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex gap-3.5 relative overflow-hidden transition-all hover:border-orange-100";

    card.innerHTML = `
      <div class="flex-1 flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-1.5 mb-1">
            <span class="${item.is_veg ? 'veg-icon' : 'nonveg-icon'}" title="${item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}"></span>
            ${item.is_bestseller ? '<span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Bestseller</span>' : ''}
          </div>
          <h4 class="font-bold text-gray-900 text-sm leading-tight cursor-pointer hover:text-orange-600 transition-colors item-title-trigger">
            ${item.name}
          </h4>
          <p class="text-xs text-gray-500 line-clamp-2 mt-1 leading-relaxed">
            ${item.description}
          </p>
        </div>
        
        <div class="mt-2.5 flex items-center justify-between">
          <span class="font-bold text-sm text-gray-900">₹${item.price}</span>
          <button class="text-[11px] font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 item-customize-trigger">
            <span>Customize</span>
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
      </div>

      <div class="relative w-28 h-28 flex-shrink-0 flex flex-col items-center">
        <div class="w-full h-24 rounded-xl overflow-hidden shadow-inner cursor-pointer item-image-trigger">
          <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy">
        </div>
        
        <div class="absolute -bottom-1">
          ${qtyInCart > 0 ? `
            <div class="flex items-center bg-white border border-orange-500 rounded-lg shadow-md px-1.5 py-0.5 gap-2.5">
              <button class="text-orange-600 font-black text-sm px-1.5 py-0.5 stepper-btn btn-qty-minus" data-id="${item.id}">−</button>
              <span class="font-bold text-xs text-gray-900 min-w-[12px] text-center">${qtyInCart}</span>
              <button class="text-orange-600 font-black text-sm px-1.5 py-0.5 stepper-btn btn-qty-plus" data-id="${item.id}">+</button>
            </div>
          ` : `
            <button class="bg-white hover:bg-orange-50 text-orange-600 border border-orange-200 hover:border-orange-400 font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm transition-all btn-add-direct" data-id="${item.id}">
              ADD +
            </button>
          `}
        </div>
      </div>
    `;

    const titleTrigger = card.querySelector(".item-title-trigger");
    const imgTrigger = card.querySelector(".item-image-trigger");
    const customTrigger = card.querySelector(".item-customize-trigger");
    
    [titleTrigger, imgTrigger, customTrigger].forEach(el => {
      if (el) el.addEventListener("click", () => openProductDetailModal(item, vendor));
    });

    const addBtn = card.querySelector(".btn-add-direct");
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAddItem(vendor, item, 1, "");
      });
    }

    const minusBtn = card.querySelector(".btn-qty-minus");
    if (minusBtn) {
      minusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        updateCartQuantity(item.id, -1);
      });
    }

    const plusBtn = card.querySelector(".btn-qty-plus");
    if (plusBtn) {
      plusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        updateCartQuantity(item.id, 1);
      });
    }

    container.appendChild(card);
  });
}

function openProductDetailModal(item, vendor) {
  APP_STATE.activeDetailItem = { item, vendor };
  
  const modalImg = document.getElementById("detail-modal-image");
  const modalVeg = document.getElementById("detail-modal-veg");
  const modalTitle = document.getElementById("detail-modal-title");
  const modalDesc = document.getElementById("detail-modal-desc");
  const modalPrice = document.getElementById("detail-modal-price");
  const modalNotes = document.getElementById("detail-modal-notes");
  const modalQty = document.getElementById("detail-modal-qty");
  const modalAddBtnText = document.getElementById("detail-modal-btn-text");

  if (modalImg) {
    modalImg.src = item.image;
    modalImg.alt = item.name;
  }
  if (modalVeg) {
    modalVeg.className = item.is_veg ? "veg-icon" : "nonveg-icon";
    modalVeg.title = item.is_veg ? "Vegetarian" : "Non-Vegetarian";
  }
  if (modalTitle) modalTitle.textContent = item.name;
  if (modalDesc) modalDesc.textContent = item.description;
  if (modalPrice) modalPrice.textContent = `₹${item.price}`;
  if (modalNotes) modalNotes.value = "";
  if (modalQty) modalQty.textContent = "1";
  
  if (modalAddBtnText) {
    modalAddBtnText.textContent = `Add to Cart • ₹${item.price}`;
  }

  const existing = APP_STATE.cart.items.find(i => i.id === item.id);
  if (existing) {
    if (modalQty) modalQty.textContent = existing.quantity;
    if (modalNotes) modalNotes.value = existing.specialInstructions || "";
    if (modalAddBtnText) {
      modalAddBtnText.textContent = `Update Cart • ₹${item.price * existing.quantity}`;
    }
  }

  openModal("product-detail-modal");
}

function adjustDetailModalQty(delta) {
  const qtyEl = document.getElementById("detail-modal-qty");
  const btnText = document.getElementById("detail-modal-btn-text");
  if (!qtyEl || !APP_STATE.activeDetailItem) return;

  let current = parseInt(qtyEl.textContent) || 1;
  current += delta;
  if (current < 1) current = 1;
  if (current > 20) current = 20;

  qtyEl.textContent = current;
  const totalPrice = APP_STATE.activeDetailItem.item.price * current;
  btnText.textContent = `Add to Cart • ₹${totalPrice}`;
}

function confirmDetailModalAdd() {
  if (!APP_STATE.activeDetailItem) return;
  const { item, vendor } = APP_STATE.activeDetailItem;

  const qtyEl = document.getElementById("detail-modal-qty");
  const notesEl = document.getElementById("detail-modal-notes");

  const quantity = parseInt(qtyEl.textContent) || 1;
  const specialInstructions = (notesEl.value || "").trim();

  closeModal("product-detail-modal");
  handleAddItem(vendor, item, quantity, specialInstructions);
}

// MULTI-VENDOR CART LOGIC
function handleAddItem(vendor, item, quantity = 1, specialInstructions = "") {
  if (!vendor || !item) return;

  const existingIndex = APP_STATE.cart.items.findIndex(i => i.id === item.id);
  if (existingIndex > -1) {
    APP_STATE.cart.items[existingIndex].quantity = quantity;
    if (specialInstructions) {
      APP_STATE.cart.items[existingIndex].specialInstructions = specialInstructions;
    }
  } else {
    APP_STATE.cart.items.push({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: quantity,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_code: vendor.code || vendor.id.substring(0, 2).toUpperCase(),
      specialInstructions: specialInstructions,
      is_veg: item.is_veg,
      image: item.image
    });
  }

  saveCartToStorage();
  renderMenuItems();
  updateStickyCartBar();
  showToast(`Added ${item.name} (${vendor.name}) to cart`);
}

function updateCartQuantity(itemId, delta) {
  const itemIndex = APP_STATE.cart.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return;

  APP_STATE.cart.items[itemIndex].quantity += delta;

  if (APP_STATE.cart.items[itemIndex].quantity <= 0) {
    APP_STATE.cart.items.splice(itemIndex, 1);
  }

  saveCartToStorage();
  renderMenuItems();
  updateStickyCartBar();

  if (document.getElementById("screen-cart") && !document.getElementById("screen-cart").classList.contains("hidden")) {
    renderCart();
  }
}

function updateStickyCartBar() {
  const stickyBar = document.getElementById("sticky-cart-bar");
  if (!stickyBar) return;

  const totalCount = APP_STATE.cart.items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = APP_STATE.cart.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  
  // Count unique vendors
  const vendorIds = new Set(APP_STATE.cart.items.map(i => i.vendor_id));
  const vendorCount = vendorIds.size;

  const isMenuOrWelcome = (!document.getElementById("screen-welcome").classList.contains("hidden") || 
                           !document.getElementById("screen-menu").classList.contains("hidden"));

  if (totalCount > 0 && isMenuOrWelcome) {
    stickyBar.classList.remove("hidden");
    document.getElementById("sticky-cart-count").textContent = `${totalCount} ${totalCount === 1 ? 'item' : 'items'}`;
    
    if (vendorCount > 1) {
      document.getElementById("sticky-cart-vendor").textContent = `${vendorCount} Stalls Combined`;
    } else {
      const firstItem = APP_STATE.cart.items[0];
      document.getElementById("sticky-cart-vendor").textContent = firstItem ? firstItem.vendor_name : "Dostana";
    }
    document.getElementById("sticky-cart-total").textContent = `₹${subtotal}`;
  } else {
    stickyBar.classList.add("hidden");
  }
}

function openCartScreen() {
  stopTrackingPoll();
  renderCart();
  switchScreen("screen-cart");
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// SCREEN 4: MULTI-VENDOR CART SCREEN
function renderCart() {
  const container = document.getElementById("cart-items-container");
  const emptyState = document.getElementById("cart-empty-state");
  const contentState = document.getElementById("cart-content-state");
  if (!container) return;

  const totalCount = APP_STATE.cart.items.reduce((sum, i) => sum + i.quantity, 0);

  if (totalCount === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    if (contentState) contentState.classList.add("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  if (contentState) contentState.classList.remove("hidden");

  document.getElementById("cart-table-badge").textContent = `Table ${APP_STATE.tableNo}`;

  // Group items by vendor
  const vendorGroups = {};
  APP_STATE.cart.items.forEach(item => {
    if (!vendorGroups[item.vendor_id]) {
      vendorGroups[item.vendor_id] = {
        name: item.vendor_name,
        code: item.vendor_code,
        items: []
      };
    }
    vendorGroups[item.vendor_id].items.push(item);
  });

  const stallCount = Object.keys(vendorGroups).length;
  document.getElementById("cart-vendor-title").textContent = stallCount > 1 
    ? `${stallCount} Food Stalls Combined` 
    : (APP_STATE.cart.items[0]?.vendor_name || "Dostana Food Court");

  container.innerHTML = "";
  let grandSubtotal = 0;

  // Render each vendor section
  Object.keys(vendorGroups).forEach(vId => {
    const group = vendorGroups[vId];
    const groupSubtotal = group.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    grandSubtotal += groupSubtotal;

    const groupCard = document.createElement("div");
    groupCard.className = "bg-white rounded-2xl p-4 border border-gray-100 shadow-xs space-y-3";

    // Stall Header
    let stallEmoji = "🍴";
    if (vId.includes("shawarma")) stallEmoji = "🌯";
    else if (vId.includes("tiffin")) stallEmoji = "🥘";
    else if (vId.includes("chai")) stallEmoji = "☕";

    let itemsHtml = "";
    group.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      itemsHtml += `
        <div class="py-2.5 flex items-center justify-between gap-3 border-b border-gray-50 last:border-0">
          <div class="flex items-start gap-2.5 flex-1">
            <span class="${item.is_veg ? 'veg-icon' : 'nonveg-icon'} mt-1 flex-shrink-0"></span>
            <div class="flex-1">
              <h5 class="text-sm font-bold text-gray-900 leading-tight">${item.name}</h5>
              <span class="text-xs text-gray-500 font-medium">₹${item.price} each</span>
              ${item.specialInstructions ? `
                <div class="mt-1 text-[11px] text-orange-700 bg-orange-50 rounded px-2 py-0.5 inline-block">
                  “${item.specialInstructions}”
                </div>
              ` : ''}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 gap-2.5">
              <button class="text-gray-600 hover:text-orange-600 font-bold text-xs stepper-btn btn-cart-minus" data-id="${item.id}">−</button>
              <span class="text-xs font-bold text-gray-900 min-w-[14px] text-center">${item.quantity}</span>
              <button class="text-gray-600 hover:text-orange-600 font-bold text-xs stepper-btn btn-cart-plus" data-id="${item.id}">+</button>
            </div>
            <span class="text-xs font-bold text-gray-900 min-w-[50px] text-right">₹${itemTotal}</span>
          </div>
        </div>
      `;
    });

    groupCard.innerHTML = `
      <div class="flex items-center justify-between pb-2 border-b border-gray-100">
        <div class="flex items-center gap-2">
          <span class="text-base">${stallEmoji}</span>
          <div>
            <span class="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Independent Stall</span>
            <h4 class="font-display font-bold text-sm text-gray-900 leading-none">${group.name}</h4>
          </div>
        </div>
        <span class="text-xs font-bold text-gray-600">Stall Total: ₹${groupSubtotal}</span>
      </div>
      
      <div class="space-y-1">
        ${itemsHtml}
      </div>
    `;

    groupCard.querySelectorAll(".btn-cart-minus").forEach(btn => {
      btn.addEventListener("click", () => updateCartQuantity(btn.getAttribute("data-id"), -1));
    });
    groupCard.querySelectorAll(".btn-cart-plus").forEach(btn => {
      btn.addEventListener("click", () => updateCartQuantity(btn.getAttribute("data-id"), 1));
    });

    container.appendChild(groupCard);
  });

  const tax = Number((grandSubtotal * 0.05).toFixed(2));
  const grandTotal = Number((grandSubtotal + tax).toFixed(2));
  const fmt = (n) => (Number(n) % 1 === 0 ? `₹${Number(n)}` : `₹${Number(n).toFixed(2)}`);

  document.getElementById("cart-subtotal").textContent = fmt(grandSubtotal);
  document.getElementById("cart-tax").textContent = fmt(tax);
  document.getElementById("cart-total").textContent = fmt(grandTotal);
  document.getElementById("cart-pay-btn-amount").textContent = fmt(grandTotal);
}

// SCREEN 5: ORDER PLACEMENT
async function placeOrder() {
  if (APP_STATE.cart.items.length === 0) return;

  const btn = document.getElementById("btn-place-order");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">◌</span> Placing Combined Order...`;
  }

  const subtotal = APP_STATE.cart.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const tax = Number((subtotal * 0.05).toFixed(2));
  const grandTotal = Number((subtotal + tax).toFixed(2));
  const customerNotes = (document.getElementById("cart-customer-notes")?.value || "").trim();

  const payload = {
    table_no: APP_STATE.tableNo,
    items: APP_STATE.cart.items.map(i => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      vendor_id: i.vendor_id,
      vendor_name: i.vendor_name,
      vendor_code: i.vendor_code,
      special_instructions: i.specialInstructions || "",
      is_veg: i.is_veg
    })),
    customer_notes: customerNotes,
    subtotal: subtotal,
    tax: tax,
    total: grandTotal
  };

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const order = await res.json();
      APP_STATE.currentOrder = order;
      APP_STATE.cart = { items: [] };
      saveCartToStorage();
      updateStickyCartBar();
      renderOrderStatus(order);
      switchScreen("screen-order-status");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      startTrackingPoll(order.order_id);
    } else {
      showToast("Order could not be placed. Please try again.");
    }
  } catch (err) {
    console.error("Order error", err);
    showToast("Network error. Please try again.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Place Order</span> <span id="cart-pay-btn-amount">₹${grandTotal}</span>`;
    }
  }
}

// SCREEN 5: ORDER TRACKING WITH MULTI-VENDOR SUB-ORDERS
function renderOrderStatus(order) {
  if (!order) return;

  document.getElementById("track-order-id").textContent = `#${order.order_id}`;
  document.getElementById("track-table-no").textContent = `Table ${order.table_no}`;
  document.getElementById("track-created-time").textContent = order.created_at;
  const fmt = (n) => (Number(n) % 1 === 0 ? `₹${Number(n)}` : `₹${Number(n).toFixed(2)}`);
  document.getElementById("track-grand-total").textContent = fmt(order.total);

  // Overall status banner
  const statusBanner = document.getElementById("track-current-status-banner");
  if (statusBanner) {
    statusBanner.textContent = order.status_display || "Order Placed";
  }

  // Render sub-orders per vendor
  const subOrdersContainer = document.getElementById("track-status-timeline");
  if (!subOrdersContainer) return;
  subOrdersContainer.innerHTML = "";

  const subOrders = order.sub_orders || [];

  if (subOrders.length === 0) {
    subOrdersContainer.innerHTML = `<p class="text-xs text-gray-500 py-3">No active sub-orders</p>`;
    return;
  }

  subOrders.forEach(sub => {
    const card = document.createElement("div");
    card.className = "p-3.5 bg-gray-50 rounded-2xl border border-gray-100 space-y-2.5 mb-3 last:mb-0 shadow-xs";

    let stallEmoji = "🍴";
    if (sub.vendor_id.includes("shawarma")) stallEmoji = "🌯";
    else if (sub.vendor_id.includes("tiffin")) stallEmoji = "🥘";
    else if (sub.vendor_id.includes("chai")) stallEmoji = "☕";

    let statusBadgeClass = "bg-orange-100 text-orange-800 border-orange-200";
    let statusText = "Order Placed";
    
    if (sub.status === "NEW") {
      statusBadgeClass = "bg-blue-100 text-blue-800 border-blue-200";
      statusText = "NEW • Ticket Received";
    } else if (sub.status === "PREPARING") {
      statusBadgeClass = "bg-amber-100 text-amber-800 border-amber-200";
      statusText = "🍳 PREPARING in Kitchen";
    } else if (sub.status === "READY") {
      statusBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200 font-extrabold animate-pulse";
      statusText = "🔔 READY for Pickup!";
    } else if (sub.status === "SERVED") {
      statusBadgeClass = "bg-gray-100 text-gray-700 border-gray-200";
      statusText = "✓ SERVED";
    }

    let itemsHtml = "";
    (sub.items || []).forEach(item => {
      itemsHtml += `
        <div class="flex justify-between items-center text-xs py-1 border-b border-gray-100/80 last:border-0">
          <span class="text-gray-800 font-medium">${item.quantity}x ${item.name}</span>
          <span class="text-gray-600 font-semibold">${fmt(item.price * item.quantity)}</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wide">Sub-Order #${sub.id}</span>
          <h5 class="text-sm font-extrabold text-gray-900">${stallEmoji} ${sub.vendor_name}</h5>
        </div>
        <span class="text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadgeClass}">
          ${statusText}
        </span>
      </div>

      <div class="bg-white rounded-xl p-2.5 border border-gray-100 space-y-1">
        ${itemsHtml}
        <div class="pt-1.5 border-t border-gray-100 flex justify-between items-center text-xs font-bold text-gray-800">
          <span>Stall Subtotal:</span>
          <span>${fmt(sub.subtotal)}</span>
        </div>
      </div>
    `;

    subOrdersContainer.appendChild(card);
  });

  // Items Summary
  const summaryContainer = document.getElementById("track-items-summary");
  if (summaryContainer) {
    summaryContainer.innerHTML = order.items.map(i => `
      <div class="flex justify-between items-center py-1.5 text-xs border-b border-gray-50 last:border-0">
        <span class="text-gray-700 font-medium">${i.quantity}x ${i.name}</span>
        <span class="text-gray-900 font-bold">₹${i.price * i.quantity}</span>
      </div>
    `).join("");
  }
}

// Live polling for customer tracking
function startTrackingPoll(orderId) {
  stopTrackingPoll();
  APP_STATE.trackingPollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const updated = await res.json();
        APP_STATE.currentOrder = updated;
        renderOrderStatus(updated);
      }
    } catch (e) {
      console.warn("Poll error", e);
    }
  }, 2500);
}

function stopTrackingPoll() {
  if (APP_STATE.trackingPollTimer) {
    clearInterval(APP_STATE.trackingPollTimer);
    APP_STATE.trackingPollTimer = null;
  }
}

function switchScreen(screenId) {
  const screens = ["screen-welcome", "screen-menu", "screen-cart", "screen-order-status"];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === screenId) {
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    }
  });
  updateStickyCartBar();
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

function showToast(message) {
  let toast = document.getElementById("dostana-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "dostana-toast";
    toast.className = "fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg transition-opacity duration-300 pointer-events-none backdrop-blur-sm flex items-center gap-2 border border-gray-700";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2200);
}

function setupEventListeners() {
  const backToWelcome = document.getElementById("btn-back-to-welcome");
  if (backToWelcome) backToWelcome.addEventListener("click", showWelcomeScreen);

  const backFromCart = document.getElementById("btn-back-from-cart");
  if (backFromCart) {
    backFromCart.addEventListener("click", () => {
      if (APP_STATE.activeVendorId) {
        openVendorMenu(APP_STATE.activeVendorId);
      } else {
        showWelcomeScreen();
      }
    });
  }

  const stickyCartBtn = document.getElementById("sticky-cart-bar");
  if (stickyCartBtn) stickyCartBtn.addEventListener("click", openCartScreen);

  const searchInput = document.getElementById("menu-search-input");
  if (searchInput) searchInput.addEventListener("input", filterMenuItems);

  const btnQtyMinus = document.getElementById("btn-modal-qty-minus");
  const btnQtyPlus = document.getElementById("btn-modal-qty-plus");
  const btnConfirmAdd = document.getElementById("btn-modal-confirm-add");
  const btnCloseModal = document.getElementById("btn-modal-close");

  if (btnQtyMinus) btnQtyMinus.addEventListener("click", () => adjustDetailModalQty(-1));
  if (btnQtyPlus) btnQtyPlus.addEventListener("click", () => adjustDetailModalQty(1));
  if (btnConfirmAdd) btnConfirmAdd.addEventListener("click", confirmDetailModalAdd);
  if (btnCloseModal) btnCloseModal.addEventListener("click", () => closeModal("product-detail-modal"));

  const btnPlaceOrder = document.getElementById("btn-place-order");
  if (btnPlaceOrder) btnPlaceOrder.addEventListener("click", placeOrder);

  const btnOrderMore = document.getElementById("btn-order-more");
  if (btnOrderMore) btnOrderMore.addEventListener("click", showWelcomeScreen);

  const btnShowQR = document.getElementById("btn-show-qr");
  if (btnShowQR) btnShowQR.addEventListener("click", () => openModal("qr-modal"));
  
  const btnCloseQR = document.getElementById("btn-close-qr");
  if (btnCloseQR) btnCloseQR.addEventListener("click", () => closeModal("qr-modal"));

  document.querySelectorAll(".demo-table-select").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const table = e.target.getAttribute("data-table");
      if (table) setDemoTable(table);
    });
  });
}
