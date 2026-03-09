# MCPAP Vendor Map — Product Overview

An interactive, map‑first tool for managing vendor booths at Magic City Plant‑A‑Palooza. This app shows booth locations on a map, lets event staff mark and edit vendor details, and displays small badges on booths (for example "Returning vendor" or "Event staff").

This README is written for non‑technical users: it describes what the product does, how to use it as a viewer or admin, and simple steps to run it locally.

## What this app does (features at a glance)

- Visual map of vendor booths placed on an interactive Google map.
- Click or select a booth to open an edit panel showing the vendor's logo, name, contact info and booth details.
- Two small per-booth badges:
	- Returning vendor — a small ribbon icon to mark vendors who have returned to the event.
	- Event staff — a staff ribbon + person icon for internal staff or volunteers working a booth.
- Badges appear both on the map (top-right of the booth polygon) and in the booth info panel next to the logo preview.
- Admin controls to edit vendor information, mark badges, and save changes.
- Simple built-in persistence: vendor data is stored in a JSON file on the server so edits are saved between restarts.

## Who should use this and why

- Event organizers: plan and visualize booth placements and quickly mark returning vendors or staff.
- On-site staff: use the map to locate booths and see badges that indicate vendors with special roles.
- Volunteers: reference vendor contact details directly from the vendor panel.

## Quick non-technical walkthrough

1. Open the web app (your event server or localhost).
2. The map shows vendor booths on the right and a vendor list on the left.
3. Click a booth on the map (or select it from the list) to open the vendor edit panel.
4. In the panel you can see the vendor's logo and contact info, toggle "Returning Vendor" and "Event Staff", then save changes.
5. When a badge is set, a small ribbon icon appears on the map and in the panel.

## Running the app locally (simple)

Requirements: Python 3.8+, a virtual environment, and a Google Maps JavaScript API key (for map features).

1. Create & activate a virtual environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Set environment variables (example):

```bash
export GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_KEY"
export MAP_ID=""            # optional
export ADMIN_PIN="1234"     # set an admin PIN to enable admin features
```

3. Start the app:

**Development (Flask built-in server):**
```bash
./.venv/bin/python app.py
# then open http://127.0.0.1:5000/ in a browser
```

**Production (Gunicorn):**
```bash
./.venv/bin/gunicorn -c gunicorn.conf.py app:app
```
The config reads `PORT` from `.env` (default 5000). To use another port, set `PORT=8080` in `.env` or when starting.

Notes: vendor data is stored in `data/vendors.json`. If you edit that file directly you can pre-seed the app with badges and vendor info.

## Deploy to Railway

The app is set up for one-click style deployment on [Railway](https://railway.app). The repo includes `railway.json` (start command), `Procfile`, and `runtime.txt` so Railway can build and run the app without extra config.

1. **Create a project**: Go to [railway.app/new](https://railway.app/new), then **Deploy from GitHub repo** and select this repository.
2. **Environment variables**: In your Railway service, open **Variables** and add:
   - `GOOGLE_MAPS_API_KEY` — your Google Maps JavaScript API key (required for the map).
   - `ADMIN_PIN` — PIN for admin login (e.g. `1234`).
   - `MAP_ID` — (optional) Google Map ID if you use a custom map type.
   - `SECRET_KEY` — (optional) Flask session secret; Railway can generate one, or set a random string.
3. **Deploy**: Railway will detect Python, install from `requirements.txt`, and run `gunicorn -c gunicorn.conf.py app:app`. It sets `PORT` automatically.
4. **Public URL**: In the service **Settings** → **Networking**, click **Generate Domain** to get a public URL.

Vendor data is stored in the app’s filesystem (`data/vendors.json`). For persistence across redeploys, consider adding a Railway volume or external storage later.

## Admin features

- Log in with the admin PIN to enable editing and saving vendor details.
- As admin you can edit vendor fields (name, logo URL, contact info, schedule, dimensions), toggle badges, and save changes to the server.

## Where code and data live

- Frontend code (map, overlays, UI): `static/` and `templates/index.html`
- Map & overlay logic: `static/js/draw-overlays.js`, `static/js/badges.js`
- Panel and list UI: `static/js/ui-list.js`, `static/js/controls.js`
- Server: `app.py` (Flask)
- Data file: `data/vendors.json`

## Troubleshooting (non-technical)

- Map not loading: ensure `GOOGLE_MAPS_API_KEY` is set and valid.
- Changes not saving: check server console/errors and ensure the app has write permission to `data/vendors.json`.
- Can't start the app: ensure Python and the virtual environment are set up and `requirements.txt` is installed.

## Need help or customizations?

I can help with:
- A simple user guide or step-by-step video for volunteers.
- Adding more badges or changing badge artwork.
- Setting up automated backups for `data/vendors.json`.

---

If you'd like, I can also add a short, friendly README section for event volunteers that walks them through the exact clicks to find a vendor on the map.
