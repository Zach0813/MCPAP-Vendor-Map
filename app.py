import os
from datetime import timedelta
from flask import Flask, render_template, request, jsonify, session, send_from_directory, redirect
from dotenv import load_dotenv
import json
from pathlib import Path
from werkzeug.utils import secure_filename
import uuid
import requests

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key-change-me")
app.permanent_session_lifetime = timedelta(days=7)

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
GOOGLE_MAPS_MAP_ID  = os.environ.get("MAP_ID", "")
ADMIN_PIN           = os.environ.get("ADMIN_PIN", "")
PORT                = int(os.environ.get("PORT", "5000")) if str(os.environ.get("PORT", "5000")).isdigit() else 5000

# Simple JSON storage for booths/vendors (compat with legacy frontend).
# On Railway, set DATA_DIR to a volume mount path (e.g. /data) so data survives redeploys.
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
VENDORS_JSON = DATA_DIR / "vendors.json"

# Image upload directory. When DATA_DIR is set (e.g. Railway volume), store uploads there too.
if os.environ.get("DATA_DIR"):
    UPLOAD_DIR = DATA_DIR / "uploads"
else:
    UPLOAD_DIR = Path(__file__).parent / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100MB

# Allowed image extensions (common image formats)
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif', '.ico', '.heic', '.heif'}

def allowed_file(filename):
    """Check if file has an allowed extension."""
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS

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
            f.flush()
            os.fsync(f.fileno())
        return True
    except Exception:
        return False


@app.before_request
def redirect_http_to_https():
    """When behind a proxy (e.g. Railway), redirect HTTP to HTTPS so the site is always secure."""
    if request.headers.get("X-Forwarded-Proto") == "http":
        url = request.url.replace("http://", "https://", 1)
        return redirect(url, code=301)


@app.route("/health")
def health():
    """Lightweight health check for Railway and load balancers."""
    return "", 200


@app.route("/")
def index():
    defaults = {"center": {"lat": 45.783611, "lng": -108.542778}, "zoom": 20}
    return render_template(
        "index.html",
        google_maps_api_key=GOOGLE_MAPS_API_KEY,
        map_id=GOOGLE_MAPS_MAP_ID,
        defaults=defaults,
        cachebuster="v0.4.11"
    )


@app.route("/mobile")
def mobile_viewer():
    """Standalone mobile viewer: separate template and assets, no shared desktop code."""
    defaults = {"center": {"lat": 45.783611, "lng": -108.542778}, "zoom": 20}
    return render_template(
        "mobile-viewer.html",
        google_maps_api_key=GOOGLE_MAPS_API_KEY,
        map_id=GOOGLE_MAPS_MAP_ID,
        defaults=defaults,
        cachebuster="v0.4.11"
    )


@app.route("/mobile/vendors")
def mobile_vendor_list():
    """Mobile-only full-page vendor list (linked from /mobile menu)."""
    return render_template(
        "mobile-vendors.html",
        cachebuster="v0.4.11",
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

@app.route("/api/upload-logo", methods=["POST"])
def api_upload_logo():
    """Upload a vendor logo image file."""
    if not session.get("is_admin"):
        return jsonify({"ok": False, "error": "Forbidden"}), 403
    
    if 'file' not in request.files:
        return jsonify({"ok": False, "error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"ok": False, "error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"ok": False, "error": "Invalid file type. Please upload an image file."}), 400
    
    # Check file size
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)
    
    if file_size > MAX_UPLOAD_SIZE:
        return jsonify({"ok": False, "error": f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB"}), 400
    
    # Generate unique filename to avoid conflicts
    original_ext = Path(file.filename or "").suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{original_ext}"
    filepath = UPLOAD_DIR / unique_filename
    
    try:
        file.save(str(filepath))
        # Return URL path relative to static folder
        url = f"/static/uploads/{unique_filename}"
        return jsonify({"ok": True, "url": url})
    except Exception as e:
        return jsonify({"ok": False, "error": f"Upload failed: {str(e)}"}), 500


@app.route("/api/import-logo-from-url", methods=["POST"])
def api_import_logo_from_url():
    """Download an image from a URL, store it as an uploaded logo, and return the internal URL.

    This is used to convert external logo URLs into first-party uploads so they can be cropped.
    """
    if not session.get("is_admin"):
        return jsonify({"ok": False, "error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    raw_url = (data.get("url") or "").strip()
    if not raw_url:
        return jsonify({"ok": False, "error": "No URL provided"}), 400

    # Basic safety: only allow http/https
    if not (raw_url.startswith("http://") or raw_url.startswith("https://")):
        return jsonify({"ok": False, "error": "Invalid URL. Must start with http:// or https://"}), 400

    try:
        resp = requests.get(raw_url, stream=True, timeout=8)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Download failed: {e}"}), 400

    if resp.status_code != 200:
        return jsonify({"ok": False, "error": f"Download failed with status {resp.status_code}"}), 400

    content_type = (resp.headers.get("Content-Type") or "").lower()
    if not content_type.startswith("image/"):
        return jsonify({"ok": False, "error": "URL does not point to an image"}), 400

    # Infer extension from content-type if possible
    ext_map = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
        "image/svg+xml": ".svg",
        "image/tiff": ".tiff",
    }
    original_ext = ext_map.get(content_type.split(";")[0].strip(), "")
    if original_ext and original_ext.lower() not in ALLOWED_EXTENSIONS:
        return jsonify({"ok": False, "error": "Image type not allowed"}), 400

    unique_filename = f"{uuid.uuid4().hex}{original_ext or '.png'}"
    filepath = UPLOAD_DIR / unique_filename

    # Stream download to disk with size limit
    bytes_written = 0
    try:
        with filepath.open("wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                if not chunk:
                    continue
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_SIZE:
                    filepath.unlink(missing_ok=True)
                    return jsonify({"ok": False, "error": f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB"}), 400
                f.write(chunk)
    except Exception as e:
        filepath.unlink(missing_ok=True)
        return jsonify({"ok": False, "error": f"Saving image failed: {e}"}), 500

    url = f"/static/uploads/{unique_filename}"
    return jsonify({"ok": True, "url": url})

@app.route("/static/uploads/<filename>")
def serve_upload(filename):
    """Serve uploaded images."""
    try:
        # Security: ensure filename is safe and exists in upload directory
        safe_filename = secure_filename(filename)
        filepath = UPLOAD_DIR / safe_filename
        if filepath.exists() and filepath.parent == UPLOAD_DIR:
            return send_from_directory(str(UPLOAD_DIR), safe_filename)
        return jsonify({"error": "File not found"}), 404
    except Exception:
        return jsonify({"error": "Error serving file"}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=PORT)