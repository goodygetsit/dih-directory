#!/usr/bin/env python3
"""
DIH Directory — Build Semantic Embeddings for Providers (Phase 6)

One-time (and on-update) script. Generates vector embeddings for every
provider's combined text (name + master_category + service_tags +
subcategory). Stores the vectors in data/embeddings.json.

The hub Code Block can then use these vectors to do semantic similarity
search alongside keyword matching. Lets queries like "I'm exhausted"
match providers tagged with "chronic fatigue" without exact word match.

Run when:
  - First-time setup (after BigQuery + weekly analyzer are working)
  - After meaningful providers.json updates (new providers, big tag changes)

Environment:
  OPENAI_API_KEY  — for embedding API. ~$0.50 to vectorize all 492 providers once.
"""
import os
import json
import time
from pathlib import Path
from openai import OpenAI

REPO_ROOT = Path(__file__).resolve().parent.parent
PROVIDERS_JSON = REPO_ROOT / "providers.json"
EMBEDDINGS_OUT = REPO_ROOT / "data" / "embeddings.json"

MODEL = "text-embedding-3-small"  # 1536-dim, $0.02 per 1M tokens — very cheap
BATCH_SIZE = 100  # OpenAI accepts up to 2048 per request; 100 is comfy


def provider_text(p):
    """Build the searchable text blob for embedding."""
    parts = [
        p.get("name", ""),
        p.get("master_category", ""),
        p.get("subcategory", ""),
        " ".join(p.get("service_tags") or []),
    ]
    return " | ".join(filter(None, parts))


def main():
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    data = json.loads(PROVIDERS_JSON.read_text())
    providers = data.get("providers", [])
    print(f"[build_embeddings] {len(providers)} providers to embed")

    texts = [provider_text(p) for p in providers]
    slugs = [p["slug"] for p in providers]

    all_vectors = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        print(f"  Batch {i // BATCH_SIZE + 1}: {len(batch)} providers…")
        resp = client.embeddings.create(model=MODEL, input=batch)
        all_vectors.extend([d.embedding for d in resp.data])
        time.sleep(0.5)  # be polite to the API

    out = {
        "model": MODEL,
        "dimensions": len(all_vectors[0]) if all_vectors else 0,
        "vectors": {slugs[i]: all_vectors[i] for i in range(len(slugs))}
    }
    EMBEDDINGS_OUT.parent.mkdir(parents=True, exist_ok=True)
    EMBEDDINGS_OUT.write_text(json.dumps(out))
    print(f"[build_embeddings] Wrote {EMBEDDINGS_OUT} ({len(all_vectors)} vectors, {out['dimensions']} dims each)")
    print(f"[build_embeddings] File size: {EMBEDDINGS_OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
