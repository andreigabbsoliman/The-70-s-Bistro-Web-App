"""
The 70's Bistro — back end.

One small server (Python standard library only, no installs) that
  • serves the customer website at  http://localhost:8000/
  • serves the admin dashboard at   http://localhost:8000/admin/login.html
  • keeps ONE shared database in    data/db.json   (seeded from data/seed.json)

Both sides read and write the same data through the /api/... routes, so a change made in the
admin dashboard shows up on the customer website, and a ticket reserved on the website shows
up in the dashboard.

Run:  python server.py            (or double-click start-server.bat)
"""
import base64
import binascii
import copy
import json
import mimetypes
import os
import re
import secrets
import socket
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
CUSTOMER_DIR = os.path.join(ROOT, "Customer Side")
ADMIN_DIR = os.path.join(ROOT, "Admin & Staff")
DATA_DIR = os.path.join(ROOT, "data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
DB_FILE = os.path.join(DATA_DIR, "db.json")
SEED_FILE = os.path.join(DATA_DIR, "seed.json")
SESSION_FILE = os.path.join(DATA_DIR, "sessions.json")

ADMIN_ACCOUNT = {"name": "Admin", "email": "admin@70sbistro.com", "password": "admin123"}

COLLECTIONS = {"products": ("PRD-", 3), "events": ("EVT-", 3), "transactions": ("TXN-", 4),
               "gallery": ("IMG-", 3), "notifications": ("NTF-", 3)}
IMAGE_COLLECTIONS = {"products", "events", "gallery"}
MAX_BODY = 8 * 1024 * 1024
LOCK = threading.RLock()


# ---------------------------------------------------------------- storage
class Store:
    """The JSON "database". Every change bumps `version` so open pages know to refresh."""

    def __init__(self):
        self.data = None
        self.version = 0
        self.sessions = {}
        self.load()

    def load(self):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        if os.path.exists(DB_FILE):
            with open(DB_FILE, encoding="utf-8") as f:
                self.data = json.load(f)
        else:
            self.reset(save_only=True)
        for name in COLLECTIONS:
            self.data.setdefault(name, [])
        self.version = int(time.time())  # changes on every server start, so open pages reload
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, encoding="utf-8") as f:
                    self.sessions = json.load(f)
            except (OSError, ValueError):
                self.sessions = {}

    def reset(self, save_only=False):
        with open(SEED_FILE, encoding="utf-8") as f:
            self.data = json.load(f)
        self.save(bump=not save_only)

    def save(self, bump=True):
        if bump:
            self.version += 1
        tmp = DB_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)
        os.replace(tmp, DB_FILE)

    def save_sessions(self):
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(self.sessions, f)

    def next_id(self, name):
        prefix, digits = COLLECTIONS[name]
        highest = max([int(re.sub(r"\D", "", i["id"]) or 0) for i in self.data[name]] + [0])
        return f"{prefix}{highest + 1:0{digits}d}"


STORE = Store()


# ---------------------------------------------------------------- helpers
def now_stamp():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def ticket_stats(event_id):
    """Same rules as the dashboard: PAID sold, PENDING held, FAILED/REFUNDED free the seats."""
    event = next((e for e in STORE.data["events"] if e["id"] == event_id), None)
    sales = [t for t in STORE.data["transactions"] if t["eventId"] == event_id]
    sold = sum(t["qty"] for t in sales if t["status"] == "PAID")
    pending = sum(t["qty"] for t in sales if t["status"] == "PENDING")
    capacity = event["capacity"] if event else 0
    return {"sold": sold, "pending": pending, "capacity": capacity, "remaining": max(0, capacity - sold - pending)}


def notify(kind, title, message):
    if kind == "ticket" and not STORE.data["settings"]["prefs"].get("notifyTicket", True):
        return
    STORE.data["notifications"].insert(0, {"id": STORE.next_id("notifications"), "type": kind, "title": title,
                                           "message": message, "time": now_stamp(), "read": False})


def new_ticket_code():
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "70B-" + "".join(secrets.choice(chars) for _ in range(6))


def save_image(data_url):
    """Turn an uploaded data: URL into a file under data/uploads and return its public path."""
    m = re.match(r"data:image/(png|jpe?g|gif|webp);base64,(.+)$", data_url, re.S)
    if not m:
        return ""
    try:
        raw = base64.b64decode(m.group(2), validate=False)
    except (binascii.Error, ValueError):
        return ""
    ext = "jpg" if m.group(1).startswith("jp") else m.group(1)
    name = f"{int(time.time() * 1000)}-{secrets.token_hex(3)}.{ext}"
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
        f.write(raw)
    return "/uploads/" + name


def clean_images(name, item):
    if name in IMAGE_COLLECTIONS and isinstance(item.get("image"), str) and item["image"].startswith("data:"):
        item["image"] = save_image(item["image"])


def public_view():
    """Everything the customer website may see (no buyers' details, no notifications)."""
    d = STORE.data
    events = []
    for e in d["events"]:
        stats = ticket_stats(e["id"])
        events.append({**e, "remaining": stats["remaining"]})
    s = d["settings"]
    return {"version": STORE.version, "products": d["products"], "events": events, "gallery": d["gallery"],
            "settings": {"business": s["business"], "hours": s["hours"], "tickets": s["tickets"]}}


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


# ---------------------------------------------------------------- customer actions
def create_ticket(body):
    event_id = str(body.get("eventId", ""))
    name, email, phone = (str(body.get(k, "")).strip() for k in ("name", "email", "phone"))
    try:
        qty = int(body.get("qty", 0))
    except (TypeError, ValueError):
        qty = 0
    event = next((e for e in STORE.data["events"] if e["id"] == event_id), None)
    max_qty = STORE.data["settings"]["tickets"]["maxPerPurchase"]
    if not event or event["status"] != "UPCOMING":
        raise ApiError(400, "This show is no longer open for tickets.")
    if not name or not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email) or not re.match(r"^[0-9+()\-\s]{7,20}$", phone):
        raise ApiError(400, "Please enter a valid name, email and mobile number.")
    if qty < 1 or qty > max_qty:
        raise ApiError(400, f"You can reserve 1 to {max_qty} tickets at a time.")
    left = ticket_stats(event_id)["remaining"]
    if qty > left:
        raise ApiError(409, f"Only {left} ticket{'s' if left != 1 else ''} left for {event['band']}." if left else f"{event['band']} is sold out.")
    txn = {"id": STORE.next_id("transactions"), "code": new_ticket_code(), "eventId": event_id, "buyer": name, "email": email,
           "phone": phone, "qty": qty, "amount": qty * event["price"], "method": "Cash", "status": "PENDING", "date": now_stamp()}
    STORE.data["transactions"].insert(0, txn)
    notify("ticket", "Ticket Purchase", f"{name} reserved {qty} ticket{'s' if qty > 1 else ''} for {event['band']}.")
    STORE.save()
    return {"code": txn["code"], "id": txn["id"], "band": event["band"], "qty": qty, "amount": txn["amount"]}


def create_reservation(body):
    name = str(body.get("name", "")).strip()
    date = str(body.get("date", "")).strip()
    guests = str(body.get("guests", "")).strip()
    if not name or not re.match(r"^\d{4}-\d{2}-\d{2}$", date) or not guests:
        raise ApiError(400, "Please fill in your name, the date and the number of guests.")
    notify("system", "Table Reservation Request", f"{name} asked for a table for {guests} on {date}.")
    STORE.save()
    return {"ok": True}


# ---------------------------------------------------------------- admin actions
def admin_add(name, body):
    item = {k: v for k, v in body.items() if k != "id"}
    clean_images(name, item)
    item = {"id": STORE.next_id(name), **item}
    if name == "transactions":
        check_capacity(item)
        item.setdefault("code", new_ticket_code())
        item.setdefault("date", now_stamp())
    STORE.data[name].insert(0, item)
    STORE.save()
    return item


def admin_update(name, item_id, body):
    item = next((i for i in STORE.data[name] if i["id"] == item_id), None)
    if not item:
        raise ApiError(404, "Not found.")
    changes = {k: v for k, v in body.items() if k != "id"}
    clean_images(name, changes)
    if name == "transactions":
        check_capacity({**item, **changes}, existing=item)
    item.update(changes)
    STORE.save()
    return item


def check_capacity(txn, existing=None):
    """A sale that holds seats (PENDING/PAID) may not push an event over its capacity."""
    if txn.get("status") not in ("PENDING", "PAID"):
        return
    event = next((e for e in STORE.data["events"] if e["id"] == txn.get("eventId")), None)
    if not event:
        return
    left = ticket_stats(event["id"])["remaining"]
    if existing and existing.get("status") in ("PENDING", "PAID") and existing.get("eventId") == event["id"]:
        left += existing["qty"]  # its own seats are already counted
    if txn["qty"] > left:
        raise ApiError(409, f"Only {left} ticket{'s' if left != 1 else ''} left for {event['band']}." if left else f"{event['band']} is sold out.")


def admin_delete(name, item_id):
    STORE.data[name] = [i for i in STORE.data[name] if i["id"] != item_id]
    STORE.save()
    return {"ok": True}


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "Bistro70s/1.0"

    def log_message(self, fmt, *args):  # quieter console
        if "/api/version" not in (args[0] if args else ""):
            sys.stderr.write("  %s\n" % (fmt % args))

    # ----- response helpers
    def send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Version", str(STORE.version))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(raw)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "That upload is too large.")
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            raise ApiError(400, "Invalid JSON.")
        return body if isinstance(body, dict) else {}

    def admin_user(self):
        token = (self.headers.get("Authorization") or "").replace("Bearer ", "", 1)
        user = STORE.sessions.get(token)
        if not user:
            raise ApiError(401, "Please log in again.")
        return user

    # ----- routing
    def do_GET(self):
        self.route()

    do_HEAD = do_GET

    def do_POST(self):
        self.route()

    do_PUT = do_POST
    do_DELETE = do_POST

    def route(self):
        path = unquote(urlparse(self.path).path)
        try:
            if path.startswith("/api/"):
                with LOCK:
                    self.send_json(200, self.api(path[5:].strip("/").split("/")))
            else:
                self.static(path)
        except ApiError as e:
            self.send_json(e.status, {"error": e.message})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # keep the server alive; report to the page
            self.send_json(500, {"error": f"Server error: {e}"})

    def api(self, parts):
        method = self.command
        if parts == ["version"] and method in ("GET", "HEAD"):
            return {"version": STORE.version}
        if parts == ["public"] and method in ("GET", "HEAD"):
            return public_view()
        if parts == ["tickets"] and method == "POST":
            return create_ticket(self.read_body())
        if parts == ["reservations"] and method == "POST":
            return create_reservation(self.read_body())
        if parts == ["login"] and method == "POST":
            body = self.read_body()
            if str(body.get("email", "")).strip().lower() != ADMIN_ACCOUNT["email"] or body.get("password") != ADMIN_ACCOUNT["password"]:
                raise ApiError(401, "Incorrect email or password.")
            token = secrets.token_hex(24)
            user = {"name": ADMIN_ACCOUNT["name"], "email": ADMIN_ACCOUNT["email"]}
            STORE.sessions[token] = user
            STORE.save_sessions()
            return {"token": token, "user": user}

        if parts[0] != "admin":
            raise ApiError(404, "Unknown API route.")
        self.admin_user()
        rest = parts[1:]
        if rest == ["logout"] and method == "POST":
            STORE.sessions.pop((self.headers.get("Authorization") or "").replace("Bearer ", "", 1), None)
            STORE.save_sessions()
            return {"ok": True}
        if rest == ["db"] and method in ("GET", "HEAD"):
            return {"version": STORE.version, **STORE.data}
        if rest == ["reset"] and method == "POST":
            STORE.reset()
            return {"version": STORE.version, **STORE.data}
        if rest == ["settings"] and method == "PUT":
            STORE.data["settings"] = self.read_body()
            STORE.save()
            return {"ok": True, "version": STORE.version}
        if rest == ["notifications", "read-all"] and method == "POST":
            for n in STORE.data["notifications"]:
                n["read"] = True
            STORE.save()
            return {"ok": True}
        if rest and rest[0] in COLLECTIONS:
            name = rest[0]
            if len(rest) == 1 and method == "POST":
                return admin_add(name, self.read_body())
            if len(rest) == 2 and method == "PUT":
                return admin_update(name, rest[1], self.read_body())
            if len(rest) == 2 and method == "DELETE":
                return admin_delete(name, rest[1])
        raise ApiError(404, "Unknown API route.")

    # ----- static files
    def static(self, path):
        if path.startswith("/uploads/"):
            base, rel = UPLOAD_DIR, path[len("/uploads/"):]
        elif path == "/admin":
            self.send_response(301)
            self.send_header("Location", "/admin/login.html")
            self.end_headers()
            return
        elif path.startswith("/admin/"):
            base, rel = ADMIN_DIR, path[len("/admin/"):] or "login.html"
        else:
            base, rel = CUSTOMER_DIR, path.lstrip("/") or "index.html"
        full = os.path.realpath(os.path.join(base, rel))
        if not full.startswith(os.path.realpath(base) + os.sep) or not os.path.isfile(full):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Not found")
            return
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        size = os.path.getsize(full)
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-cache")  # always pick up edited files
        self.end_headers()
        if self.command != "HEAD":
            with open(full, "rb") as f:
                self.wfile.write(f.read())


def lan_address():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return None


def main():
    port = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8000))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    lan = lan_address()
    print("\n  The 70's Bistro is running.\n")
    print(f"  Customer website : http://localhost:{port}/")
    print(f"  Admin dashboard  : http://localhost:{port}/admin/login.html   (admin@70sbistro.com / admin123)")
    if lan:
        print(f"\n  Other devices on the same Wi-Fi can open  http://{lan}:{port}/")
    print("\n  Press Ctrl+C to stop.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.")


if __name__ == "__main__":
    main()
