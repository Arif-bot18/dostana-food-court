import json
from fastapi.testclient import TestClient
from main import app, parent_orders_db, vendor_sub_orders_db
import main

# Reset in-memory state for fresh demo verification
parent_orders_db.clear()
vendor_sub_orders_db.clear()
main.order_counter = 101

client = TestClient(app)

print("--- STEP 1 & 2 & 3: OPEN DOSTANA AT TABLE T12 ---")
res_court = client.get("/api/food-court")
assert res_court.status_code == 200
print(f"Food Court: {res_court.json()['name']} - {res_court.json()['subtitle']}")

print("\n--- STEP 4 & 6 & 8: ADD ITEMS FROM 3 VENDORS ---")
cart_items = [
    {
        "id": "sh-1",
        "name": "Chicken Shawarma",
        "price": 149.0,
        "quantity": 1,
        "vendor_id": "shawarma-hub",
        "vendor_name": "Shawarma Hub",
        "vendor_code": "SH",
        "special_instructions": "Less spicy",
        "is_veg": False
    },
    {
        "id": "dt-2",
        "name": "Masala Dosa",
        "price": 90.0,
        "quantity": 1,
        "vendor_id": "dostana-tiffins",
        "vendor_name": "Dostana Tiffins",
        "vendor_code": "DT",
        "special_instructions": "Crispy",
        "is_veg": True
    },
    {
        "id": "ca-2",
        "name": "Masala Chai",
        "price": 30.0,
        "quantity": 2,
        "vendor_id": "chai-adda",
        "vendor_name": "Chai Adda",
        "vendor_code": "CA",
        "special_instructions": "Strong kadak",
        "is_veg": True
    }
]

subtotal = sum(i["price"] * i["quantity"] for i in cart_items)
tax = round(subtotal * 0.05, 2)
total = round(subtotal + tax, 2)

print(f"Cart Summary: Subtotal = ₹{subtotal}, GST = ₹{tax}, Grand Total = ₹{total}")
assert subtotal == 299.0
assert tax == 14.95
assert total == 313.95

print("\n--- STEP 10: PLACE COMBINED ORDER ---")
order_res = client.post("/api/orders", json={
    "table_no": "T12",
    "items": cart_items,
    "customer_notes": "Extra napkins",
    "subtotal": subtotal,
    "tax": tax,
    "total": total
})
assert order_res.status_code == 200
order = order_res.json()
parent_id = order["order_id"]
print(f"Parent Order Created: #{parent_id} (Table: {order['table_no']})")
assert parent_id == "D102"
assert len(order["sub_orders"]) == 3

print("\n--- STEP 11, 12, 13: VENDOR DASHBOARD & STRICT ISOLATION ---")
# Shawarma Hub
sh_orders = client.get("/api/vendors/shawarma-hub/orders").json()
assert len(sh_orders) == 1
assert sh_orders[0]["id"] == "D102-SH"
assert sh_orders[0]["subtotal"] == 149.0
assert [i["name"] for i in sh_orders[0]["items"]] == ["Chicken Shawarma"]
print("Shawarma Hub sees ONLY #D102-SH: Chicken Shawarma (₹149)")

# Dostana Tiffins
dt_orders = client.get("/api/vendors/dostana-tiffins/orders").json()
assert len(dt_orders) == 1
assert dt_orders[0]["id"] == "D102-DT"
assert dt_orders[0]["subtotal"] == 90.0
assert [i["name"] for i in dt_orders[0]["items"]] == ["Masala Dosa"]
print("Dostana Tiffins sees ONLY #D102-DT: Masala Dosa (₹90)")

# Chai Adda
ca_orders = client.get("/api/vendors/chai-adda/orders").json()
assert len(ca_orders) == 1
assert ca_orders[0]["id"] == "D102-CA"
assert ca_orders[0]["subtotal"] == 60.0
assert [i["name"] for i in ca_orders[0]["items"]] == ["Masala Chai"]
print("Chai Adda sees ONLY #D102-CA: Masala Chai x2 (₹60)")

print("\n--- STEP 14: DEMONSTRATE INDEPENDENT STATUSES ---")
# Shawarma -> PREPARING
client.patch("/api/vendor-orders/D102-SH/status", json={"status": "PREPARING"})
# Tiffins -> READY
client.patch("/api/vendor-orders/D102-DT/status", json={"status": "READY"})
# Chai Adda -> Remains NEW

sh_now = client.get("/api/vendors/shawarma-hub/orders").json()[0]["status"]
dt_now = client.get("/api/vendors/dostana-tiffins/orders").json()[0]["status"]
ca_now = client.get("/api/vendors/chai-adda/orders").json()[0]["status"]

print(f"Shawarma Hub Status: {sh_now}")
print(f"Dostana Tiffins Status: {dt_now}")
print(f"Chai Adda Status: {ca_now}")

assert sh_now == "PREPARING"
assert dt_now == "READY"
assert ca_now == "NEW"

print("\n--- STEP 15: CUSTOMER TRACKING DYNAMIC OVERALL STATUS ---")
cust_order = client.get("/api/orders/D102").json()
print(f"Parent Order Status: {cust_order['status']} ({cust_order['status_display']})")
assert cust_order["status"] == "PREPARING"

sub_map = {s["id"]: s["status"] for s in cust_order["sub_orders"]}
print(f"Customer sees independent sub-order statuses: {sub_map}")
assert sub_map["D102-SH"] == "PREPARING"
assert sub_map["D102-DT"] == "READY"
assert sub_map["D102-CA"] == "NEW"

print("\n--- STEP 16: ADMIN FINANCIAL RECONCILIATION ---")
admin = client.get("/api/admin/overview").json()
print(f"Admin Total Orders: {admin['total_parent_orders']}")
print(f"Admin Customer Paid Total: ₹{admin['customer_total']}")
print(f"Admin Vendor Total Sales: ₹{admin['total_sales']}")
breakdown = {v["vendor_id"]: v["sales"] for v in admin["vendor_breakdown"]}
print(f"Vendor Breakdown: {breakdown}")

assert admin["total_parent_orders"] == 1
assert admin["customer_total"] == 313.95
assert admin["total_sales"] == 299.0
assert breakdown["shawarma-hub"] == 149.0
assert breakdown["dostana-tiffins"] == 90.0
assert breakdown["chai-adda"] == 60.0

print("\n==========================================")
print("ALL 16 DEMO STEPS VERIFIED WITH 100% SUCCESS!")
print("==========================================")
