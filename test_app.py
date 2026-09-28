import unittest
from fastapi.testclient import TestClient
from main import app

class DostanaMultiVendorTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_multi_vendor_order_flow(self):
        # 1. Place multi-vendor order: Shawarma + Dosa + Chai
        payload = {
            "table_no": "T12",
            "items": [
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
            ],
            "customer_notes": "All items to Table T12",
            "subtotal": 299.0,
            "tax": 14.95,
            "total": 313.95
        }

        res = self.client.post("/api/orders", json=payload)
        self.assertEqual(res.status_code, 200)
        order = res.json()
        
        # Verify parent order
        parent_id = order["order_id"]
        self.assertTrue(parent_id.startswith("D"))
        self.assertEqual(order["table_no"], "T12")
        self.assertEqual(order["subtotal"], 299.0)
        self.assertEqual(len(order["sub_orders"]), 3)

        sub_ids = [s["id"] for s in order["sub_orders"]]
        expected_sh = f"{parent_id}-SH"
        expected_dt = f"{parent_id}-DT"
        expected_ca = f"{parent_id}-CA"
        self.assertIn(expected_sh, sub_ids)
        self.assertIn(expected_dt, sub_ids)
        self.assertIn(expected_ca, sub_ids)

        # 2. Verify strict vendor isolation
        # Shawarma Hub should see ONLY D102-SH
        sh_res = self.client.get("/api/vendors/shawarma-hub/orders")
        self.assertEqual(sh_res.status_code, 200)
        sh_orders = sh_res.json()
        sh_ticket = next((o for o in sh_orders if o["id"] == expected_sh), None)
        self.assertIsNotNone(sh_ticket)
        self.assertEqual(sh_ticket["subtotal"], 149.0)
        self.assertEqual(len(sh_ticket["items"]), 1)
        self.assertEqual(sh_ticket["items"][0]["name"], "Chicken Shawarma")

        # Dostana Tiffins should see ONLY D102-DT
        dt_res = self.client.get("/api/vendors/dostana-tiffins/orders")
        dt_orders = dt_res.json()
        dt_ticket = next((o for o in dt_orders if o["id"] == expected_dt), None)
        self.assertIsNotNone(dt_ticket)
        self.assertEqual(dt_ticket["subtotal"], 90.0)
        self.assertEqual(len(dt_ticket["items"]), 1)
        self.assertEqual(dt_ticket["items"][0]["name"], "Masala Dosa")

        # Chai Adda should see ONLY D102-CA
        ca_res = self.client.get("/api/vendors/chai-adda/orders")
        ca_orders = ca_res.json()
        ca_ticket = next((o for o in ca_orders if o["id"] == expected_ca), None)
        self.assertIsNotNone(ca_ticket)
        self.assertEqual(ca_ticket["subtotal"], 60.0)
        self.assertEqual(ca_ticket["items"][0]["quantity"], 2)

        # 3. Test independent status transitions
        # Update Shawarma to PREPARING
        p_res = self.client.patch(f"/api/vendor-orders/{expected_sh}/status", json={"status": "PREPARING"})
        self.assertEqual(p_res.status_code, 200)
        self.assertEqual(p_res.json()["status"], "PREPARING")

        # Other vendors remain NEW
        dt_check = self.client.get("/api/vendors/dostana-tiffins/orders").json()
        self.assertEqual(next(o for o in dt_check if o["id"] == expected_dt)["status"], "NEW")

        # Customer parent status should be PREPARING
        parent_check1 = self.client.get(f"/api/orders/{parent_id}").json()
        self.assertEqual(parent_check1["status"], "PREPARING")

        # Update Shawarma to READY, Tiffins to READY, Chai to READY
        self.client.patch(f"/api/vendor-orders/{expected_sh}/status", json={"status": "READY"})
        self.client.patch(f"/api/vendor-orders/{expected_dt}/status", json={"status": "READY"})
        self.client.patch(f"/api/vendor-orders/{expected_ca}/status", json={"status": "READY"})

        # Customer parent status should be READY
        parent_check2 = self.client.get(f"/api/orders/{parent_id}").json()
        self.assertEqual(parent_check2["status"], "READY")

        # Update all to SERVED
        self.client.patch(f"/api/vendor-orders/{expected_sh}/status", json={"status": "SERVED"})
        self.client.patch(f"/api/vendor-orders/{expected_dt}/status", json={"status": "SERVED"})
        self.client.patch(f"/api/vendor-orders/{expected_ca}/status", json={"status": "SERVED"})

        parent_check3 = self.client.get(f"/api/orders/{parent_id}").json()
        self.assertEqual(parent_check3["status"], "SERVED")

        # 4. Verify Admin Revenue Breakdown
        admin_res = self.client.get("/api/admin/overview")
        self.assertEqual(admin_res.status_code, 200)
        admin = admin_res.json()
        self.assertGreaterEqual(admin["total_parent_orders"], 1)
        self.assertGreaterEqual(admin["total_sales"], 299.0)
        self.assertAlmostEqual(admin["customer_total"], 313.95, places=2)

        breakdown = {v["vendor_id"]: v["sales"] for v in admin["vendor_breakdown"]}
        self.assertGreaterEqual(breakdown.get("shawarma-hub", 0), 149.0)
        self.assertGreaterEqual(breakdown.get("dostana-tiffins", 0), 90.0)
        self.assertGreaterEqual(breakdown.get("chai-adda", 0), 60.0)

if __name__ == "__main__":
    unittest.main()
