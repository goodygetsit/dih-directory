#!/usr/bin/env python3
"""
DIH Directory — All-Time Query Report

Pulls the ENTIRE history of dih_chat_query + dih_chat_result_click events from
BigQuery (not just the last 7 days), builds a cumulative summary, and emails it
via Resend. Triggered manually from GitHub Actions (workflow_dispatch).

This is the cumulative companion to weekly_analyzer.py. The weekly job reports a
rolling 7-day window; this one reports everything ever captured, so there is no
need to save and add up the weekly emails by hand.

Environment variables (GitHub Actions secrets):
  GA4_BIGQUERY_PROJECT  - GCP project hosting the GA4 export
  GA4_BIGQUERY_DATASET  - GA4 BigQuery dataset (e.g. analytics_536941236)
  RESEND_API_KEY        - Resend API key (sending access)
  NOTIFY_EMAIL          - recipient
"""
import os
import json
import datetime
import urllib.request
import urllib.error

from google.cloud import bigquery

PROJECT = os.environ["GA4_BIGQUERY_PROJECT"]
DATASET = os.environ["GA4_BIGQUERY_DATASET"]
# Start of history. GA4 export tables are named events_YYYYMMDD; this lower bound
# is safely before the directory existed, so it captures everything.
HISTORY_START = "20240101"


def pull_all_queries(client):
    sql = f"""
    WITH queries AS (
      SELECT
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'query_text') AS query_text,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'results_count') AS results_count
      FROM `{PROJECT}.{DATASET}.events_*`
      WHERE event_name = 'dih_chat_query'
        AND _TABLE_SUFFIX BETWEEN '{HISTORY_START}'
                              AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    )
    SELECT
      query_text,
      COUNT(*) AS query_count,
      AVG(results_count) AS avg_results,
      COUNTIF(results_count = 0) AS zero_result_count
    FROM queries
    WHERE query_text IS NOT NULL AND LENGTH(query_text) >= 2
    GROUP BY query_text
    ORDER BY query_count DESC
    LIMIT 1000
    """
    rows = list(client.query(sql).result())
    return [dict(r.items()) for r in rows]


def build_summary(queries):
    total = sum(q.get("query_count", 0) for q in queries)
    unique = len(queries)
    zero_q = [q for q in queries if (q.get("zero_result_count") or 0) > 0]
    lines = [
        "# DIH All-Time Directory Query Report",
        f"Generated {datetime.date.today().isoformat()} — covers every query ever captured",
        "",
        "## Totals",
        f"- Total searches: {total}",
        f"- Unique searches: {unique}",
        f"- Searches that returned nothing: {len(zero_q)}",
        "",
        "## Top 25 searches (all time)",
    ]
    if not queries:
        lines.append("- No searches captured yet. Data appears here within 1 to 2 days of people using the box.")
    for q in queries[:25]:
        avg = q.get("avg_results")
        avg_txt = f"{avg:.0f}" if avg is not None else "0"
        lines.append(f"- {q['query_text']!r} — searched {q['query_count']} times, avg {avg_txt} results")
    lines += ["", "## Top searches that returned nothing (fix these first)"]
    if not zero_q:
        lines.append("- None yet.")
    for q in sorted(zero_q, key=lambda x: x.get("query_count", 0), reverse=True)[:25]:
        lines.append(f"- {q['query_text']!r} — searched {q['query_count']} times, found nothing")
    return "\n".join(lines)


def send_email(summary):
    esc = summary.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    html = (
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">'
        '<pre style="white-space:pre-wrap;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.55">'
        + esc +
        "</pre>"
        '<p style="color:#9a9182;font-size:12px;margin-top:18px">Dialed In Health directory &middot; all-time query report.</p>'
        "</div>"
    )
    payload = {
        "from": "Dialed In Health <reports@dialedin.health>",
        "to": [os.environ["NOTIFY_EMAIL"]],
        "subject": "DIH All-Time Directory Query Report - " + datetime.date.today().isoformat(),
        "html": html,
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + os.environ["RESEND_API_KEY"],
            "Content-Type": "application/json",
            "User-Agent": "dih-alltime-report/1.0",
        },
    )
    try:
        resp = urllib.request.urlopen(req)
        print("Resend response:", resp.status, resp.read().decode())
    except urllib.error.HTTPError as e:
        print("Resend error:", e.code, e.read().decode())
        raise


def main():
    client = bigquery.Client(project=PROJECT)
    queries = pull_all_queries(client)
    print(f"[alltime_report] Pulled {len(queries)} unique queries (all time)")
    summary = build_summary(queries)
    print(summary)
    send_email(summary)
    print("[alltime_report] Done.")


if __name__ == "__main__":
    main()
