# Enrichment Safety

Provider enrichment must prioritize factual accuracy over coverage.

If Claude cannot generate useful copy from the provider facts already present in the repo, it should leave the field empty or generate shorter copy instead of guessing. It is better to publish no enrichment than to publish hallucinated services, credentials, insurance details, clinician names, hours, awards, review claims, outcomes, or treatments.

Allowed sources for non-API enrichment:

- Existing `providers.json` fields.
- Existing `data/enriched.json` fields.
- VGL provider-page About text already copied into `practice.about`.
- Conservative category/subcategory/tag implications.

Do not invent facts from a provider name alone. When a claim is uncertain, omit it.
