#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const providersPath = path.join(root, "providers.json");
const enrichedPath = path.join(root, "data", "enriched.json");
const summaryPath = path.join(root, "data", "enriched-claude-summary.json");

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args["dry-run"]);
const limit = args.limit ? Number(args.limit) : Infinity;
const only = args.only ? new Set(String(args.only).split(",").map((s) => s.trim()).filter(Boolean)) : null;
const refreshMatched = Boolean(args["refresh-matched"]);
const missingAbout = Boolean(args["missing-about"]);
const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const apiKey = process.env.ANTHROPIC_API_KEY;

const providersData = readJson(providersPath);
const providers = Array.isArray(providersData) ? providersData : providersData.providers || [];
const taxonomy = providersData.taxonomy?.master_categories || [];
const categoryNames = new Map(taxonomy.map((cat) => [cat.slug, cat.name || titleize(cat.slug)]));
const enriched = readJson(enrichedPath);
const bySlug = new Map(providers.map((provider) => [provider.slug, provider]));

if (!providers.length) throw new Error(`No providers found in ${providersPath}`);
if (!dryRun && !apiKey) throw new Error("Set ANTHROPIC_API_KEY or run with --dry-run.");

const candidates = providers.filter((provider) => {
  if (only && !only.has(provider.slug)) return false;
  if (missingAbout) return !Array.isArray(enriched[provider.slug]?.practice?.about) || !enriched[provider.slug].practice.about.length;
  const status = enriched[provider.slug]?._enrichment?.status || "missing";
  if (refreshMatched) return true;
  return status === "missing" || status === "locally_generated";
}).slice(0, limit);

if (!candidates.length) {
  console.log(JSON.stringify({ candidates: 0, message: "No missing/local entries to enrich." }, null, 2));
  process.exit(0);
}

const generatedAt = new Date().toISOString();
const results = [];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  for (const provider of candidates) {
    const current = enriched[provider.slug] || {};
    const prompt = buildPrompt(provider, current);

    if (dryRun) {
      results.push({ slug: provider.slug, status: "dry-run", prompt });
      continue;
    }

    const generated = await callClaude(prompt);
    const normalized = normalizeGenerated(generated, provider);
    enriched[provider.slug] = mergeEntry(provider, current, normalized);
    results.push({ slug: provider.slug, status: "claude_generated" });
    console.log(`enriched ${provider.slug}`);
  }

  if (!dryRun) {
    fs.writeFileSync(enrichedPath, `${JSON.stringify(orderByProviders(enriched), null, 2)}\n`);
  }

  fs.writeFileSync(summaryPath, `${JSON.stringify({
    generatedAt,
    dryRun,
    model,
    candidates: candidates.length,
    refreshedMatched: refreshMatched,
    results: dryRun ? results.map((r) => ({ slug: r.slug, status: r.status })) : results,
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    dryRun,
    model,
    candidates: candidates.length,
    updated: dryRun ? 0 : results.length,
    summaryPath: path.relative(root, summaryPath),
    samplePrompt: dryRun ? results[0]?.prompt : undefined,
  }, null, 2));
}

function buildPrompt(provider, current) {
  const examples = examplesFor(provider)
    .slice(0, 3)
    .map((entry) => ({
      name: entry.name,
      category: entry.category,
      practiceDescription: entry.practice?.description,
      specialtyTags: entry.specialtyTags,
      services: entry.services,
    }));

  const facts = {
    name: provider.name,
    slug: provider.slug,
    category: provider.category_slug,
    categoryName: categoryNames.get(provider.category_slug) || provider.master_category || "",
    subcategory: provider.subcategory || "",
    market: provider.market || provider.market_label || "",
    address: provider.address || "",
    phone: provider.phone || "",
    website: provider.website || "",
    googleRating: provider.google_rating ?? null,
    reviewCount: provider.reviews ?? null,
    serviceTags: Array.isArray(provider.service_tags) ? provider.service_tags : [],
    currentLocalDescription: current.practice?.description || "",
  };

  return [
    {
      role: "user",
      content: `Generate conservative enrichment JSON for a Dialed In Health directory provider.

Use ONLY the facts provided below. Do not invent clinicians, certifications, insurance, outcomes, hours, awards, review quotes, or specific treatments not implied by the category/subcategory/tags.

The text should be useful for search and provider matching, not marketing fluff. It should sound natural, plain, and specific enough for a health directory.
Accuracy is more important than coverage. If the provided facts are too thin to support a useful sentence or paragraph, return a shorter value or an empty array item set instead of guessing. It is better to write nothing than to hallucinate.

Return ONLY valid JSON with exactly these keys:
{
  "practiceDescription": "1-2 sentences, 45-90 words total",
  "about": ["4-7 short paragraphs for the provider page About section"],
  "googleDescription": "1 sentence using factual listing/rating/category/address info only",
  "specialtyTags": ["4-8 short searchable tags"],
  "services": ["4-8 short service/search phrases"]
}

Rules:
- Never hallucinate. Do not add claims that cannot be traced to the provided provider facts or clearly implied category/subcategory/search tags.
- If you are uncertain whether a claim is supported, omit it.
- Do not infer specific services from the provider name alone unless the category/subcategory/tags also support them.
- If reviewCount/rating exist, you may mention them as listing metadata, but never say what reviewers praised.
- If address is missing, do not imply a physical clinic.
- Keep tags and services as strings, no objects.
- Keep about paragraphs factual, useful, and grounded in the provided listing details. Do not mention Vitality Growth Labs.
- Avoid medical advice.
- Prefer terms a user might search for.

Provider facts:
${JSON.stringify(facts, null, 2)}

Good examples from existing enriched entries in similar categories:
${JSON.stringify(examples, null, 2)}
`,
    },
  ];
}

async function callClaude(messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0.2,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Anthropic error ${response.status}: ${text.slice(0, 1000)}`);
  }

  const data = await response.json();
  const text = data.content?.find((part) => part.type === "text")?.text || "";
  return parseJsonFromText(text);
}

function normalizeGenerated(value, provider) {
  const practiceDescription = cleanSentence(value.practiceDescription);
  const googleDescription = cleanSentence(value.googleDescription);
  const about = cleanParagraphs(value.about).slice(0, 7);
  const specialtyTags = cleanList(value.specialtyTags).slice(0, 8);
  const services = cleanList(value.services).slice(0, 8);

  if (!practiceDescription || practiceDescription.length < 40) {
    throw new Error(`Claude returned weak practiceDescription for ${provider.slug}`);
  }
  if (about.length < 3) {
    throw new Error(`Claude returned too few about paragraphs for ${provider.slug}`);
  }
  if (specialtyTags.length < 3 || services.length < 3) {
    throw new Error(`Claude returned too few tags/services for ${provider.slug}`);
  }

  return { practiceDescription, about, googleDescription, specialtyTags, services };
}

function mergeEntry(provider, current, generated) {
  const category = provider.category_slug;
  const profileUrl = `https://www.dialedin.health/directory/${category}/${provider.slug}`;
  return {
    ...current,
    name: provider.name,
    slug: provider.slug,
    tier: current.tier || publicTier(provider),
    category,
    categoryName: categoryNames.get(category) || provider.master_category || current.categoryName || "",
    location: current.location || {
      city: provider.market_label || "Sioux Falls",
      state: "SD",
      zip: String(provider.address || "").match(/\b\d{5}\b/)?.[0] || "",
      virtual: /virtual/i.test([provider.market, provider.market_label, provider.service_area].filter(Boolean).join(" ")),
    },
    google: {
      ...(current.google || {}),
      rating: provider.google_rating ?? current.google?.rating ?? null,
      reviewCount: provider.reviews ?? current.google?.reviewCount ?? null,
      description: generated.googleDescription,
    },
    practice: {
      ...(current.practice || {}),
      description: generated.practiceDescription,
      about: generated.about,
      newPatients: current.practice?.newPatients ?? true,
    },
    specialtyTags: generated.specialtyTags,
    services: generated.services,
    contact: {
      ...(current.contact || {}),
      phone: provider.phone || current.contact?.phone || null,
      website: provider.website || current.contact?.website || null,
      profileUrl,
    },
    profileUrl,
    _enrichment: {
      ...(current._enrichment || {}),
      status: "claude_generated",
      source: "claude-provider-facts-no-google-api",
      model,
      previousStatus: current._enrichment?.status || null,
      generatedAt,
      aboutSource: "claude-provider-facts-no-google-api",
      aboutSyncedAt: generatedAt,
    },
  };
}

function sameCategoryExamples(provider) {
  return Object.values(enriched).filter((entry) =>
    entry.category === provider.category_slug &&
    entry._enrichment?.status === "matched" &&
    entry.practice?.description &&
    Array.isArray(entry.specialtyTags) &&
    Array.isArray(entry.services)
  );
}

function examplesFor(provider) {
  const sameCategory = sameCategoryExamples(provider);
  if (sameCategory.length) return sameCategory;
  return Object.values(enriched).filter((entry) =>
    entry._enrichment?.status === "matched" &&
    entry.practice?.description &&
    Array.isArray(entry.specialtyTags) &&
    Array.isArray(entry.services)
  );
}

function orderByProviders(entries) {
  const ordered = {};
  for (const provider of providers) {
    ordered[provider.slug] = entries[provider.slug];
  }
  return ordered;
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Claude did not return JSON: ${text.slice(0, 500)}`);
    return JSON.parse(match[0]);
  }
}

function cleanList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => !/POINT_OF_INTEREST|ESTABLISHMENT/i.test(item))));
}

function cleanSentence(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanParagraphs(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(cleanSentence)
    .filter((item) => item.length >= 60)
    .filter((item) => !/Vitality Growth Labs|vitalitygrowthlabs/i.test(item))));
}

function publicTier(provider) {
  const tier = String(provider.tier || "").toLowerCase();
  if (provider.is_featured) return "claimed";
  if (tier.includes("authority")) return "authority";
  if (tier.includes("premium")) return "premium";
  if (tier.includes("claim")) return "claimed";
  return "listed";
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

function titleize(value) {
  return String(value || "").replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
