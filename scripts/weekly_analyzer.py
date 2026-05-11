#!/usr/bin/env python3
"""
DIH Directory — Weekly Query Analyzer

Runs every Sunday via GitHub Actions. Pulls last 7 days of dih_chat_query +
dih_chat_result_click events from BigQuery. Sends a structured summary to
Claude API. Receives proposed synonym/taxonomy improvements. Opens a Pull
Request on the dih-directory repo with the proposed providers.json changes.
Sends Melissa an email summary.

Environment variables required (set as GitHub Actions secrets):
  GCP_SERVICE_ACCOUNT_JSON   - Google Cloud service account with BigQuery read access
  ANTHROPIC_API_KEY          - Anthropic API key for Claude
  GITHUB_TOKEN               - Auto-provided by GitHub Actions for PR creation
  GA4_BIGQUERY_PROJECT       - GCP project ID hosting the GA4 export
  GA4_BIGQUERY_DATASET       - GA4 BigQuery dataset name (e.g., analytics_536941236)
  NOTIFY_EMAIL               - Where to send the weekly summary (melissa@vitalitygrowthlabs.com)
"""
import os
import json
import datetime as dt
from pathlib import Path

import anthropic
from google.cloud import bigquery
from google.oauth2 import service_account

# ---------- Config ----------
PROJECT = os.environ["GA4_BIGQUERY_PROJECT"]
DATASET = os.environ["GA4_BIGQUERY_DATASET"]
NOTIFY = os.environ.get("NOTIFY_EMAIL", "melissa@vitalitygrowthlabs.com")
REPO_ROOT = Path(__file__).resolve().parent.parent
PROVIDERS_JSON = REPO_ROOT / "providers.json"
CLICK_SIGNALS = REPO_ROOT / "data" / "click_signals.json"
POPULAR_QUERIES = REPO_ROOT / "data" / "popular_queries.json"
SYNONYMS_JSON = REPO_ROOT / "data" / "synonyms.json"


def bq_client():
    creds_json = None
    if not creds_json:
        # Local dev fallback — uses application default credentials
        return bigquery.Client(project=PROJECT)
    creds_info = json.loads(creds_json)
    credentials = service_account.Credentials.from_service_account_info(creds_info)
    return bigquery.Client(project=PROJECT, credentials=credentials)


def pull_weekly_queries(client):
    """Pull last 7 days of dih_chat_query events with their click outcomes."""
    sql = f"""
    WITH queries AS (
      SELECT
        event_timestamp,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'query_text') AS query_text,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'results_count') AS results_count,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'matched_categories') AS matched_categories,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'featured_count') AS featured_count,
        user_pseudo_id
      FROM `{PROJECT}.{DATASET}.events_*`
      WHERE event_name = 'dih_chat_query'
        AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
                              AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    ),
    clicks AS (
      SELECT
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'query_text') AS query_text,
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'clicked_provider_slug') AS clicked_provider_slug,
        (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'clicked_position') AS clicked_position,
        user_pseudo_id
      FROM `{PROJECT}.{DATASET}.events_*`
      WHERE event_name = 'dih_chat_result_click'
        AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
                              AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    )
    SELECT
      q.query_text,
      COUNT(*) AS query_count,
      AVG(q.results_count) AS avg_results,
      COUNTIF(q.results_count = 0) AS zero_result_count,
      SUM(CASE WHEN c.query_text IS NOT NULL THEN 1 ELSE 0 END) AS click_count,
      ARRAY_AGG(DISTINCT c.clicked_provider_slug IGNORE NULLS LIMIT 5) AS clicked_providers,
      ARRAY_AGG(DISTINCT q.matched_categories IGNORE NULLS LIMIT 3) AS matched_cats
    FROM queries q
    LEFT JOIN clicks c USING (user_pseudo_id, query_text)
    WHERE q.query_text IS NOT NULL
      AND LENGTH(q.query_text) >= 3
    GROUP BY q.query_text
    ORDER BY query_count DESC
    LIMIT 500
    """
    rows = list(client.query(sql).result())
    return [dict(r.items()) for r in rows]


def calculate_ctr_signals(queries):
    """Build CTR-by-provider signals from the week's data."""
    provider_stats = {}
    for q in queries:
        clicks = q.get("click_count") or 0
        impressions = q.get("query_count") or 0
        for slug in q.get("clicked_providers") or []:
            if not slug:
                continue
            stats = provider_stats.setdefault(slug, {"clicks": 0, "impressions": 0, "queries": []})
            stats["clicks"] += 1
            stats["impressions"] += impressions
            stats["queries"].append(q["query_text"])
    # CTR = clicks / impressions, capped + log-scaled to avoid runaway boosts
    signals = {}
    for slug, s in provider_stats.items():
        if s["impressions"] < 3:
            continue  # noise threshold
        ctr = s["clicks"] / s["impressions"]
        signals[slug] = {
            "ctr": round(ctr, 4),
            "clicks": s["clicks"],
            "impressions": s["impressions"],
            "top_queries": list(set(s["queries"]))[:5],
            "boost": min(0.4, ctr * 2)  # max boost 0.4 added to base score
        }
    return signals


def extract_popular_queries(queries, top_n=100):
    """Top queries by volume for autocomplete."""
    return [q["query_text"] for q in queries[:top_n] if q.get("query_count", 0) >= 2]


def claude_suggest_synonyms(queries, providers):
    """Ask Claude to propose synonym/tag additions for zero-result queries."""
    zero_result_queries = [q["query_text"] for q in queries if (q.get("zero_result_count") or 0) > 0][:30]
    if not zero_result_queries:
        return []
    # Build a compact list of all current master_categories + service_tags
    categories = sorted({p.get("master_category", "") for p in providers if p.get("master_category")})
    all_tags = set()
    for p in providers:
        all_tags.update(p.get("service_tags") or [])
    tags_sample = sorted(all_tags)[:200]

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""You are analyzing a wellness provider directory's search log. Some queries returned ZERO results.
For each zero-result query, identify which existing master_category and which service_tags should be expanded so the query would match in the future.

ALL master_categories:
{json.dumps(categories, indent=2)}

A sample of existing service_tags:
{json.dumps(tags_sample, indent=2)}

ZERO-RESULT QUERIES from the last 7 days:
{json.dumps(zero_result_queries, indent=2)}

For each query, respond with JSON ONLY in this format:
[
  {{
    "query": "the original query",
    "interpretation": "what the user probably meant",
    "suggested_synonyms": ["term1", "term2"],
    "target_master_category": "exact match from category list",
    "target_service_tags": ["tag1", "tag2"]
  }}
]

Only include queries where you're confident in the suggestion. Skip ambiguous or nonsense queries."""
        }]
    )
    raw = msg.content[0].text
    # Extract JSON from response
    start = raw.find("[")
    end = raw.rfind("]") + 1
    if start < 0 or end <= 0:
        return []
    try:
        return json.loads(raw[start:end])
    except json.JSONDecodeError:
        print(f"Claude returned malformed JSON: {raw[:500]}")
        return []


def write_signals(signals, queries_popular, synonym_suggestions):
    """Write updated signal files to repo."""
    CLICK_SIGNALS.parent.mkdir(parents=True, exist_ok=True)
    CLICK_SIGNALS.write_text(json.dumps({
        "updated": dt.datetime.utcnow().isoformat() + "Z",
        "signals": signals
    }, indent=2))

    POPULAR_QUERIES.write_text(json.dumps({
        "updated": dt.datetime.utcnow().isoformat() + "Z",
        "queries": queries_popular
    }, indent=2))

    # Synonym suggestions are written to a staging file, not auto-merged.
    # The GitHub Action turns this into a PR for human approval.
    SYNONYMS_JSON.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if SYNONYMS_JSON.exists():
        existing = json.loads(SYNONYMS_JSON.read_text())
    existing.setdefault("approved_synonyms", {})
    existing.setdefault("pending_suggestions", [])
    # Add new suggestions tagged with this week
    existing["pending_suggestions"] = synonym_suggestions
    existing["last_run"] = dt.datetime.utcnow().isoformat() + "Z"
    SYNONYMS_JSON.write_text(json.dumps(existing, indent=2))


def build_summary(queries, signals, synonym_suggestions):
    total = sum(q.get("query_count", 0) for q in queries)
    zero_results = sum(1 for q in queries if (q.get("zero_result_count") or 0) > 0)
    top10 = queries[:10]
    summary_lines = [
        f"# DIH Weekly Query Summary",
        f"Period: last 7 days ending {dt.date.today().isoformat()}",
        f"",
        f"## Headline numbers",
        f"- Total queries: {total}",
        f"- Unique queries: {len(queries)}",
        f"- Zero-result queries: {zero_results}",
        f"- Providers with CTR signals: {len(signals)}",
        f"",
        f"## Top 10 queries",
    ]
    for q in top10:
        summary_lines.append(f"- {q['query_text']!r} — {q['query_count']} times, {q.get('click_count', 0)} clicks")
    summary_lines.extend([
        f"",
        f"## Synonym suggestions ({len(synonym_suggestions)})",
    ])
    for s in synonym_suggestions:
        summary_lines.append(f"- {s.get('query')!r} → {s.get('target_master_category')} (tags: {', '.join(s.get('target_service_tags', []))})")
    return "\n".join(summary_lines)


def main():
    print("[weekly_analyzer] Starting…")
    client = bq_client()
    queries = pull_weekly_queries(client)
    print(f"[weekly_analyzer] Pulled {len(queries)} unique queries from BigQuery")

    # Calculate ranking signals (no human approval needed — pure math)
    signals = calculate_ctr_signals(queries)
    popular = extract_popular_queries(queries)
    print(f"[weekly_analyzer] CTR signals for {len(signals)} providers, {len(popular)} popular queries")

    # Ask Claude to suggest synonyms for zero-result queries
    providers_data = json.loads(PROVIDERS_JSON.read_text())
    providers = providers_data.get("providers", [])
    synonym_suggestions = claude_suggest_synonyms(queries, providers)
    print(f"[weekly_analyzer] Claude proposed {len(synonym_suggestions)} synonym additions")

    # Write everything to repo
    write_signals(signals, popular, synonym_suggestions)

    # Build human-readable summary for email + PR description
    summary = build_summary(queries, signals, synonym_suggestions)
    Path("data/weekly_summary.md").write_text(summary)
    print("[weekly_analyzer] Summary written to data/weekly_summary.md")

    # Note: the GitHub Action handles git commit, PR creation, and email send
    # from here using the files we wrote.
    print("[weekly_analyzer] Done.")


if __name__ == "__main__":
    main()
