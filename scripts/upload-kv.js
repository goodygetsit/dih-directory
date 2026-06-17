#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const root = path.resolve(__dirname, "..");
const outDir = path.resolve(process.env.DIH_STATIC_OUT || path.join(root, "dist-kv"));
const manifestPath = path.join(outDir, "kv-manifest.json");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!fs.existsSync(manifestPath)) {
  throw new Error(`Missing manifest: ${manifestPath}. Run npm run build:static first.`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
console.log(`Manifest: ${manifest.keys.length} keys from ${manifestPath}`);

if (dryRun) {
  for (const entry of manifest.keys.slice(0, 25)) {
    console.log(`[dry-run] ${entry.key} <- ${entry.file} (${entry.contentType}, ${entry.bytes} bytes)`);
  }
  if (manifest.keys.length > 25) console.log(`[dry-run] ... ${manifest.keys.length - 25} more keys`);
  process.exit(0);
}

if (!accountId || !namespaceId || !token) {
  throw new Error("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, and CLOUDFLARE_API_TOKEN.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  for (const entry of manifest.keys) {
    const file = path.join(outDir, entry.file);
    const body = fs.readFileSync(file);
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(entry.key)}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": entry.contentType || "text/plain; charset=utf-8",
      },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to upload ${entry.key}: ${response.status} ${text}`);
    }
    console.log(`uploaded ${entry.key}`);
  }
}
