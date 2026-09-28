# Dostana Multi-Vendor Food Court — QR Ordering & Kitchen System

A full-stack, mobile-first web application for **Dostana**, a multi-vendor food court featuring independent food stalls (**Shawarma Hub**, **Dostana Tiffins**, and **Chai Adda**).

The customer can add dishes across multiple stalls into **one unified cart** and checkout once. The backend automatically splits the checkout into independent **vendor sub-orders**, dispatches them to the respective **kitchen dashboards**, and synchronizes live statuses back to customer tracking and food court admin.

---

## 🚀 Quick Start (1 Command)

Ensure you are in the project folder and run:

```bash
python main.py
```

The application starts immediately on:
👉 **[http://localhost:8000](http://localhost:8000)** (or `http://127.0.0.1:8000`)

### Direct Access URLs:
- **Customer App**: [http://localhost:8000/](http://localhost:8000/) (or `http://<your-ip>:8000/?table=T12` on phone)
- **Kitchen Dashboard**: [http://localhost:8000/vendor](http://localhost:8000/vendor)
- **Food Court Admin**: [http://localhost:8000/admin](http://localhost:8000/admin)

*(Use the top switcher bar on desktop to toggle between Customer, Kitchen, and Admin seamlessly during your demo!)*

---

## 📱 Tomorrow's Complete Demo Script

### 1. Multi-Vendor Shopping (Customer View)
1. Open **[http://localhost:8000](http://localhost:8000)** (Table T12 is identified).
2. Click **Shawarma Hub** → Add **Chicken Shawarma** (₹149) with note *"Less spicy"*.
3. Go back to Dostana Hub → Click **Dostana Tiffins** → Add **Masala Dosa** (₹90).
4. Go back to Dostana Hub → Click **Chai Adda** → Add 2x **Masala Chai** (₹60).
5. Open Cart:
   - Notice the cart **visually groups items by vendor**:
     - 🌯 **Shawarma Hub**: Chicken Shawarma (₹149)
     - 🥘 **Dostana Tiffins**: Masala Dosa (₹90)
     - ☕ **Chai Adda**: Masala Chai x2 (₹60)
   - Combined Subtotal: **₹299** (+ 5% GST = ₹314).
6. Tap **"Place Combined Order"** → Confirmed as Parent Order **#D102**!
7. The Customer Tracking page immediately displays 3 independent stall kitchen tickets:
   - `#D102-SH` (Shawarma Hub): `NEW`
   - `#D102-DT` (Dostana Tiffins): `NEW`
   - `#D102-CA` (Chai Adda): `NEW`
   - Overall status: *"Order Placed"*.

### 2. Kitchen Order Management (Vendor View)
1. Open **[http://localhost:8000/vendor](http://localhost:8000/vendor)** in a new tab.
2. Select **Shawarma Hub** in the stall dropdown:
   - It sees **ONLY** `#D102-SH` (Chicken Shawarma, ₹149). It does **NOT** see dosas or chai!
   - Click **[ ACCEPT ORDER → ]** → moves to `PREPARING`.
   - Click **[ MARK READY ✓ ]** → moves to `READY`.
3. Select **Dostana Tiffins** in the stall dropdown:
   - Shows **ONLY** `#D102-DT` (Masala Dosa, ₹90). Still in `NEW`.
4. Select **Chai Adda** in the stall dropdown:
   - Shows **ONLY** `#D102-CA` (Masala Chai x2, ₹60). Still in `NEW`.

### 3. Real-Time Customer Status Reflection
1. Switch back to the Customer tab (no refresh needed; updates live via auto-polling):
   - Shawarma Hub shows **`🔔 READY for Pickup!`**.
   - Dostana Tiffins shows **`NEW • Ticket Received`**.
   - Chai Adda shows **`NEW • Ticket Received`**.
   - Overall Order Status dynamically displays: **"Preparing"**.

### 4. Food Court Admin Financial Reconciliation
1. Open **[http://localhost:8000/admin](http://localhost:8000/admin)**:
   - Total Parent Orders: **1**
   - Total Food Court Sales: **₹299**
   - Transparent Vendor Revenue Breakdown:
     - Shawarma Hub: **₹149**
     - Dostana Tiffins: **₹90**
     - Chai Adda: **₹60**
     - Total Reconciled: **₹299** (No double counting of parent order total).

---

## 🛠️ Architecture & Data Model

```
Parent Order: #D102 (Table T12, Total ₹299 + GST)
   │
   ├── Sub-Order: #D102-SH (Shawarma Hub) ──> Chicken Shawarma × 1  (₹149)
   ├── Sub-Order: #D102-DT (Dostana Tiffins) ──> Masala Dosa × 1     (₹90)
   └── Sub-Order: #D102-CA (Chai Adda) ──> Masala Chai × 2         (₹60)
```

- Each vendor sub-order possesses its own independent lifecycle:
  `NEW` → `PREPARING` → `READY` → `SERVED`.
- Parent order status is dynamically computed from its active sub-orders.
