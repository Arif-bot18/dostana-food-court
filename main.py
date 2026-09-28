import os
import json
import time
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Dostana Multi-Vendor Food Court API", version="2.0.0")

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "vendors.json")

def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# In-memory stores
order_counter = 101
parent_orders_db: Dict[str, Dict[str, Any]] = {}
vendor_sub_orders_db: Dict[str, Dict[str, Any]] = {}

VALID_STATUSES = ["NEW", "PREPARING", "READY", "SERVED"]

def compute_parent_status(sub_orders: List[Dict[str, Any]]) -> tuple[str, str]:
    if not sub_orders:
        return "NEW", "Order Placed"
    
    statuses = [s.get("status", "NEW") for s in sub_orders]
    
    if all(st == "SERVED" for st in statuses):
        return "SERVED", "All Items Served"
    if all(st in ["READY", "SERVED"] for st in statuses):
        return "READY", "All Items Ready for Pickup"
    if any(st in ["PREPARING", "READY"] for st in statuses):
        return "PREPARING", "Preparing"
    return "NEW", "Order Placed"

class OrderItem(BaseModel):
    id: str
    name: str
    price: float
    quantity: int
    vendor_id: str
    vendor_name: Optional[str] = ""
    vendor_code: Optional[str] = ""
    special_instructions: Optional[str] = ""
    is_veg: Optional[bool] = True

class CreateOrderRequest(BaseModel):
    table_no: Optional[str] = "T12"
    items: List[OrderItem]
    customer_notes: Optional[str] = ""
    subtotal: float
    tax: float
    total: float

class UpdateStatusRequest(BaseModel):
    status: str

@app.get("/api/food-court")
def get_food_court_info():
    data = load_data()
    return data.get("food_court", {})

@app.get("/api/vendors")
def list_vendors():
    data = load_data()
    vendors = []
    for v in data.get("vendors", []):
        v_copy = dict(v)
        v_copy["item_count"] = len(v.get("menu", []))
        vendors.append(v_copy)
    return vendors

@app.get("/api/vendors/{vendor_id}")
def get_vendor(vendor_id: str):
    data = load_data()
    for v in data.get("vendors", []):
        if v.get("id") == vendor_id:
            return v
    raise HTTPException(status_code=404, detail="Vendor not found")

@app.post("/api/orders")
def create_order(req: CreateOrderRequest):
    global order_counter
    if not req.items:
        raise HTTPException(status_code=400, detail="Cart cannot be empty")
    
    data = load_data()
    vendors_map = {v["id"]: v for v in data.get("vendors", [])}
    
    order_counter += 1
    parent_order_id = f"D{order_counter}"
    table_no = (req.table_no or "T12").strip().upper()
    now_time = datetime.now().strftime("%I:%M %p")
    ts = time.time()

    # Group items by vendor
    items_by_vendor: Dict[str, List[OrderItem]] = {}
    for item in req.items:
        v_id = item.vendor_id
        if not v_id:
            raise HTTPException(status_code=400, detail=f"Missing vendor_id for item {item.name}")
        if v_id not in items_by_vendor:
            items_by_vendor[v_id] = []
        items_by_vendor[v_id].append(item)
    
    created_sub_orders = []

    # Create one sub-order per vendor represented in the cart
    for v_id, v_items in items_by_vendor.items():
        vendor_info = vendors_map.get(v_id, {})
        vendor_code = vendor_info.get("code") or (v_id[:2].upper())
        sub_order_id = f"{parent_order_id}-{vendor_code}"
        vendor_subtotal = sum(i.price * i.quantity for i in v_items)
        
        sub_order = {
            "id": sub_order_id,
            "parent_order_id": parent_order_id,
            "vendor_id": v_id,
            "vendor_name": vendor_info.get("name", v_id),
            "vendor_code": vendor_code,
            "table_no": table_no,
            "items": [i.model_dump() for i in v_items],
            "customer_notes": req.customer_notes,
            "subtotal": vendor_subtotal,
            "status": "NEW",
            "created_at": now_time,
            "timestamp": ts,
            "estimated_prep": vendor_info.get("prep_time", "10-15 min")
        }
        vendor_sub_orders_db[sub_order_id] = sub_order
        created_sub_orders.append(sub_order)

    status_code, status_disp = compute_parent_status(created_sub_orders)

    parent_order = {
        "order_id": parent_order_id,
        "table_no": table_no,
        "items": [item.model_dump() for item in req.items],
        "customer_notes": req.customer_notes,
        "subtotal": req.subtotal,
        "tax": req.tax,
        "total": req.total,
        "sub_order_ids": [s["id"] for s in created_sub_orders],
        "sub_orders": created_sub_orders,
        "status": status_code,
        "status_display": status_disp,
        "created_at": now_time,
        "timestamp": ts
    }

    parent_orders_db[parent_order_id] = parent_order
    return parent_order

@app.get("/api/orders/{order_id}")
def get_order(order_id: str):
    order_id = order_id.upper()
    if order_id not in parent_orders_db:
        raise HTTPException(status_code=404, detail="Order not found")
    
    parent = parent_orders_db[order_id]
    # Refresh sub-orders with latest live statuses
    latest_sub_orders = []
    for sub_id in parent.get("sub_order_ids", []):
        if sub_id in vendor_sub_orders_db:
            latest_sub_orders.append(vendor_sub_orders_db[sub_id])
    
    parent["sub_orders"] = latest_sub_orders
    status_code, status_disp = compute_parent_status(latest_sub_orders)
    parent["status"] = status_code
    parent["status_display"] = status_disp
    return parent

@app.get("/api/vendors/{vendor_id}/orders")
def get_vendor_orders(vendor_id: str):
    # Returns ONLY this vendor's sub-orders
    orders = [
        s for s in vendor_sub_orders_db.values()
        if s.get("vendor_id") == vendor_id
    ]
    # Sort newest first
    orders.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
    return orders

@app.patch("/api/vendor-orders/{sub_order_id}/status")
def update_sub_order_status(sub_order_id: str, req: UpdateStatusRequest):
    sub_order_id = sub_order_id.upper()
    if sub_order_id not in vendor_sub_orders_db:
        raise HTTPException(status_code=404, detail="Vendor sub-order not found")
    
    new_status = req.status.strip().upper()
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {VALID_STATUSES}")
    
    sub = vendor_sub_orders_db[sub_order_id]
    sub["status"] = new_status

    # Recalculate parent order status
    parent_id = sub.get("parent_order_id")
    if parent_id and parent_id in parent_orders_db:
        parent = parent_orders_db[parent_id]
        all_subs = [vendor_sub_orders_db[sid] for sid in parent.get("sub_order_ids", []) if sid in vendor_sub_orders_db]
        status_code, status_disp = compute_parent_status(all_subs)
        parent["status"] = status_code
        parent["status_display"] = status_disp

    return sub

@app.get("/api/admin/overview")
def get_admin_overview():
    data = load_data()
    vendors = data.get("vendors", [])
    
    total_parent_orders = len(parent_orders_db)
    total_sales = sum(p.get("subtotal", 0) for p in parent_orders_db.values())
    customer_total = sum(p.get("total", 0) for p in parent_orders_db.values())
    
    vendor_breakdown = []
    for v in vendors:
        v_id = v["id"]
        v_sub_orders = [s for s in vendor_sub_orders_db.values() if s.get("vendor_id") == v_id]
        v_sales = sum(s.get("subtotal", 0) for s in v_sub_orders)
        active_count = sum(1 for s in v_sub_orders if s.get("status") in ["NEW", "PREPARING"])
        
        vendor_breakdown.append({
            "vendor_id": v_id,
            "vendor_name": v["name"],
            "vendor_code": v.get("code", v_id[:2].upper()),
            "category": v.get("category", ""),
            "orders_count": len(v_sub_orders),
            "sales": v_sales,
            "active_orders": active_count,
            "is_active": v.get("is_active", True)
        })

    return {
        "total_vendors": len([v for v in vendors if v.get("is_active", True)]),
        "total_parent_orders": total_parent_orders,
        "customer_total": customer_total,
        "total_sales": total_sales,
        "vendor_breakdown": vendor_breakdown
    }

# Static files and page routes
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")

@app.get("/vendor")
def serve_vendor():
    return FileResponse("static/vendor.html")

@app.get("/admin")
def serve_admin():
    return FileResponse("static/admin.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
