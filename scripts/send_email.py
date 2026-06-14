#!/usr/bin/env python3
"""
Send the weekly DIH directory digest by email via Resend.

Reads data/weekly_summary.md (written by weekly_analyzer.py) and emails it.
Env vars (GitHub Actions secrets):
  RESEND_API_KEY - Resend API key (sending access)
  NOTIFY_EMAIL   - recipient (must be the Resend account email until a domain is verified)
"""
import os
import json
import datetime
import urllib.request
import urllib.error

SUMMARY_PATH = "data/weekly_summary.md"


def main():
    summary = "No summary was generated this run."
    if os.path.exists(SUMMARY_PATH):
        with open(SUMMARY_PATH) as f:
            summary = f.read().strip() or summary

    esc = summary.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">'
        '<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55">'
        + esc
        + "</pre>"
        '<p style="color:#9a9182;font-size:12px;margin-top:18px">Dialed In Health directory &middot; automated weekly digest.</p>'
        "</div>"
    )

    payload = {
        "from": "Dialed In Health <reports@dialedin.health>",
        "to": [os.environ["NOTIFY_EMAIL"]],
        "subject": "DIH Weekly Directory Query Summary - " + datetime.date.today().isoformat(),
        "html": html,
    }

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + os.environ["RESEND_API_KEY"],
            "Content-Type": "application/json",
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        print("Resend response:", resp.status, resp.read().decode())
    except urllib.error.HTTPError as e:
        print("Resend error:", e.code, e.read().decode())
        raise


if __name__ == "__main__":
    main()
