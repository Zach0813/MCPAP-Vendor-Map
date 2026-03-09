"""Gunicorn config. Loads .env so PORT is used.
Unix/Linux/WSL/production only (Gunicorn does not run on Windows).
Run: gunicorn -c gunicorn.conf.py app:app
Or: python -m gunicorn -c gunicorn.conf.py app:app
"""
import os
from dotenv import load_dotenv

load_dotenv()

port = os.environ.get("PORT", "5000")
if not str(port).isdigit():
    port = "5000"

bind = f"0.0.0.0:{port}"
workers = 2
threads = 2
timeout = 120
