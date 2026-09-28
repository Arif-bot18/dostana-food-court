// Dostana Kitchen Display System Logic
let currentVendorId = "shawarma-hub";
let pollTimer = null;

const VENDOR_NAMES = {
  "shawarma-hub": { name: "Shawarma Hub", code: "SH" },
  "dostana-tiffins": { name: "Dostana Tiffins", code: "DT" },
  "chai-adda": { name: "Chai Adda", code: "CA" }
};

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("vendor-select");
  if (select) {
    select.value = currentVendorId;
    select.addEventListener("change", (e) => {
      currentVendorId = e.target.value;
      updateHeader();
      loadVendorOrders();
    });
  }

  updateHeader();
  loadVendorOrders();

  // Auto-poll every 3 seconds for real-time kitchen updates
  pollTimer = setInterval(loadVendorOrders, 3000);
});

function updateHeader() {
  const info = VENDOR_NAMES[currentVendorId] || { name: currentVendorId, code: "VN" };
  const titleEl = document.getElementById("active-stall-title");
  const codeEl = document.getElementById("active-stall-code");
  if (titleEl) titleEl.textContent = info.name;
  if (codeEl) codeEl.textContent = `#${info.code}`;
}

async function loadVendorOrders() {
  try {
    const res = await fetch(`/api/vendors/${currentVendorId}/orders`);
    if (!res.ok) return;
    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    console.warn("Failed to load vendor orders", err);
  }
}

function renderOrders(orders) {
  const colNew = document.getElementById("col-items-new");
  const colPrep = document.getElementById("col-items-preparing");
  const colReady = document.getElementById("col-items-ready");

  const listNew = orders.filter(o => o.status === "NEW");
  const listPrep = orders.filter(o => o.status === "PREPARING");
  const listReady = orders.filter(o => o.status === "READY");

  // Update counts
  document.getElementById("count-new").textContent = listNew.length;
  document.getElementById("count-preparing").textContent = listPrep.length;
  document.getElementById("count-ready").textContent = listReady.length;

  document.getElementById("col-count-new").textContent = `${listNew.length} tickets`;
  document.getElementById("col-count-preparing").textContent = `${listPrep.length} tickets`;
  document.getElementById("col-count-ready").textContent = `${listReady.length} tickets`;

  // Render columns
  renderColumn(colNew, listNew, "NEW");
  renderColumn(colPrep, listPrep, "PREPARING");
  renderColumn(colReady, listReady, "READY");
}

function renderColumn(container, orders, stage) {
  if (!container) return;
  container.innerHTML = "";

  if (orders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 px-4 border border-dashed border-slate-800 rounded-xl">
        <p class="text-xs text-slate-500 font-medium">No ${stage.toLowerCase()} tickets</p>
      </div>
    `;
    return;
  }

  orders.forEach(sub => {
    const card = document.createElement("div");
    card.className = "bg-slate-900 border border-slate-700/80 rounded-xl p-3.5 shadow-md space-y-3 transition-all hover:border-slate-600";

    // Build items list (ONLY this vendor's items)
    let itemsHtml = "";
    (sub.items || []).forEach(item => {
      itemsHtml += `
        <div class="flex justify-between items-start text-xs py-1 border-b border-slate-800 last:border-0">
          <div class="flex-1">
            <span class="font-bold text-white">${item.quantity}x ${item.name}</span>
            ${item.special_instructions ? `
              <div class="text-[10px] text-amber-300 font-semibold bg-amber-500/10 rounded px-1.5 py-0.5 mt-0.5 inline-block border border-amber-500/20">
                Note: “${item.special_instructions}”
              </div>
            ` : ''}
          </div>
          <span class="text-slate-300 font-mono font-semibold ml-2">₹${item.price * item.quantity}</span>
        </div>
      `;
    });

    let actionBtnHtml = "";
    if (stage === "NEW") {
      actionBtnHtml = `
        <button onclick="updateSubOrderStatus('${sub.id}', 'PREPARING')" class="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5">
          <span>ACCEPT ORDER</span>
          <span>→</span>
        </button>
      `;
    } else if (stage === "PREPARING") {
      actionBtnHtml = `
        <button onclick="updateSubOrderStatus('${sub.id}', 'READY')" class="w-full bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5">
          <span>MARK READY</span>
          <span>✓</span>
        </button>
      `;
    } else if (stage === "READY") {
      actionBtnHtml = `
        <button onclick="updateSubOrderStatus('${sub.id}', 'SERVED')" class="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5">
          <span>MARK SERVED</span>
          <span>✨</span>
        </button>
      `;
    }

    card.innerHTML = `
      <!-- Ticket Header -->
      <div class="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <span class="font-mono text-sm font-extrabold text-orange-400">#${sub.id}</span>
          <span class="text-[10px] font-mono text-slate-400 block">Parent: #${sub.parent_order_id}</span>
        </div>
        <div class="text-right">
          <span class="font-bold text-xs bg-slate-800 text-white px-2 py-0.5 rounded border border-slate-700">Table ${sub.table_no}</span>
          <span class="text-[10px] text-slate-400 block mt-0.5">${sub.created_at}</span>
        </div>
      </div>

      <!-- Items Section (Strict Vendor Isolation) -->
      <div class="bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/80 space-y-1">
        ${itemsHtml}
        <div class="pt-1.5 mt-1 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
          <span class="text-slate-400">Stall Total:</span>
          <span class="text-white font-mono">₹${sub.subtotal}</span>
        </div>
      </div>

      ${sub.customer_notes ? `
        <div class="text-[11px] text-slate-400 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
          <span class="font-semibold text-slate-300">Table Note:</span> ${sub.customer_notes}
        </div>
      ` : ''}

      <!-- Action Button -->
      <div>
        ${actionBtnHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

async function updateSubOrderStatus(subOrderId, newStatus) {
  try {
    const res = await fetch(`/api/vendor-orders/${subOrderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      loadVendorOrders();
    }
  } catch (err) {
    console.error("Status update error", err);
  }
}
