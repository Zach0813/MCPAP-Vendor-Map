import os
from datetime import timedelta
from flask import Flask, render_template, request, jsonify, session, send_from_directory
from dotenv import load_dotenv
import json
from pathlib import Path

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")
app.permanent_session_lifetime = timedelta(days=7)

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
GOOGLE_MAPS_MAP_ID  = os.environ.get("MAP_ID", "")
ADMIN_PIN           = os.environ.get("ADMIN_PIN", "")

# Simple JSON storage for booths/vendors (compat with legacy frontend)
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
VENDORS_JSON = DATA_DIR / "vendors.json"

def load_booths():
    if VENDORS_JSON.exists():
        try:
            with VENDORS_JSON.open("r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
                if isinstance(data, list):
                    out = {}
                    for item in data:
                        bid = str(item.get("id") or len(out) + 1)
                        item["id"] = bid
                        out[bid] = item
                    return out
        except Exception:
            pass
    return {}

def save_booths(obj):
    try:
        with VENDORS_JSON.open("w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False

@app.route("/")
def index():
    defaults = {"center": {"lat": 45.783611, "lng": -108.542778}, "zoom": 20}
    return render_template(
        "index.html",
        google_maps_api_key=GOOGLE_MAPS_API_KEY,
        map_id=GOOGLE_MAPS_MAP_ID,
        defaults=defaults,
        cachebuster="rollback1"
    )

@app.route('/favicon.ico')
def favicon():
    # Try several candidate locations for favicon.ico so the app works
    # regardless of platform or how static_folder was configured.
    candidates = []
    try:
        if app.static_folder:
            candidates.append(Path(app.static_folder))
    except Exception:
        pass
    # common locations relative to the app root
    candidates.append(Path(app.root_path) / "static")
    # fallback: repository-local static dir next to this file
    candidates.append(Path(__file__).parent / "static")

    for candidate in candidates:
        try:
            if candidate and candidate.exists():
                ico = candidate / "favicon.ico"
                if ico.exists():
                    return send_from_directory(str(candidate), 'favicon.ico')
        except Exception:
            # ignore and try next candidate
            continue

    # If no favicon found, return a 204 No Content to avoid errors
    # (safe universal response for environments without the static dir)
    return '', 204

# Server-backed role API
@app.route("/api/who")
def api_who():
    return jsonify({"is_admin": bool(session.get("is_admin"))})

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    pin = str(data.get("pin", "")).strip()
    if ADMIN_PIN and pin == str(ADMIN_PIN):
        session["is_admin"] = True
        session.permanent = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Invalid PIN"}), 401

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.pop("is_admin", None)
    return jsonify({"ok": True})

@app.route("/whoami")
def whoami():
    # Legacy alias of /api/who used by older app-google.js builds
    return jsonify({"is_admin": bool(session.get("is_admin"))})

@app.route("/api/vendors", methods=["GET", "POST"])
def api_vendors():
    # GET returns current booths; POST replaces all booths (admin only)
    if request.method == "GET":
        booths = load_booths()
        # Return plain dict expected by legacy app-google.js (keys are booth ids)
        return jsonify(booths)
    # POST save (admin-only)
    if not session.get("is_admin"):
        return jsonify({"ok": False, "error": "Forbidden"}), 403
    payload = request.get_json(silent=True) or {}
    booths = payload.get("booths") or payload.get("vendors") or payload.get("data") or payload
    if not isinstance(booths, dict):
        return jsonify({"ok": False, "error": "Invalid payload"}), 400
    if save_booths(booths):
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Save failed"}), 500

# Aliases for legacy frontend endpoints
@app.post("/login")
def login_alias():
    return api_login()

@app.post("/logout")
def logout_alias():
    return api_logout()

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)