#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const PROVIDERS_PATH = path.join(REPO_ROOT, "providers.json");
const ENRICHED_PATH = path.join(REPO_ROOT, "data", "enriched.json");
const OUT_DIR = path.resolve(process.env.DIH_STATIC_OUT || path.join(REPO_ROOT, "dist-kv"));
const SITE_ORIGIN = (process.env.DIH_SITE_ORIGIN || "https://www.dialedin.health").replace(/\/$/, "");
const DIRECTORY_BASE = normalizeBase(process.env.DIH_DIRECTORY_BASE || "/directory");
const GENERATED_AT = new Date().toISOString();

const data = readJson(PROVIDERS_PATH);
const providers = Array.isArray(data) ? data : data.providers || [];
const enrichedProviders = readOptionalJson(ENRICHED_PATH) || {};
const taxonomy = (data.taxonomy && data.taxonomy.master_categories) || [];
const marketChips = (data.taxonomy && data.taxonomy.market_chip_order) || [
  "All Locations",
  "Sioux Falls",
  "Minneapolis",
  "Omaha",
  "Virtual",
];
const OLD_CATEGORY_ALIASES = {
  "hormone-therapy-optimization": "hormone-therapy",
  "performance-biohacking": "sports-medicine",
  "specialty-medical": "primary-care",
  "energy-medicine": "energy-medicine-alternative-healing",
  "mind-body": "wellness-coaching",
  "spiritual-wellness": "spiritual-health-sacred-wellness",
};
const CATEGORY_META = {
  "chiropractic-care": { name: "Chiropractic Care", icon: "🙌", description: "Find trusted chiropractors and spinal health specialists in Sioux Falls." },
  "physical-therapy": { name: "Physical Therapy & Rehabilitation", icon: "🏃", description: "Physical therapists, rehab clinics, and movement specialists." },
  "sports-medicine": { name: "Sports Medicine & Performance", icon: "⚡", description: "Sports medicine providers, athletic trainers, and performance coaches." },
  "mental-health": { name: "Mental Health & Counseling", icon: "🧠", description: "Therapists, counselors, and mental health professionals." },
  "behavioral-health": { name: "Behavioral Health & Addiction", icon: "💬", description: "Addiction counselors, behavioral health services, and recovery support." },
  "neurofeedback": { name: "Neurofeedback & Brain Health", icon: "🔬", description: "Neurofeedback providers, brain mapping, and cognitive optimization." },
  "functional-medicine": { name: "Functional Medicine", icon: "🔎", description: "Functional medicine practitioners focused on root-cause healing." },
  "integrative-naturopathic": { name: "Integrative & Naturopathic Medicine", icon: "🌿", description: "Integrative, naturopathic, holistic, and alternative medicine providers." },
  "primary-care": { name: "Primary Care & Family Medicine", icon: "🏥", description: "Primary care physicians, family medicine, and urgent care clinics." },
  "pediatric-wellness": { name: "Pediatric & Family Wellness", icon: "👶", description: "Pediatricians, family wellness, and child health specialists." },
  "dermatology": { name: "Dermatology & Skin Health", icon: "✨", description: "Dermatologists, skin care specialists, and medical aesthetics." },
  "dental": { name: "Dental & Oral Health", icon: "🦷", description: "Dentists, orthodontists, and oral health providers." },
  "vision": { name: "Vision & Eye Care", icon: "👁️", description: "Optometrists, ophthalmologists, and vision care providers." },
  "ent-allergy": { name: "ENT & Allergy", icon: "👂", description: "Ear, nose, and throat specialists, allergy and immunology providers." },
  "orthopedic": { name: "Orthopedic & Joint Care", icon: "🦿", description: "Orthopedic surgeons, joint specialists, and musculoskeletal care." },
  "womens-health": { name: "Women's Health & Fertility", icon: "♀️", description: "Women's health, OB/GYN, fertility, midwifery, and reproductive care." },
  "hyperbaric-therapy": { name: "Hyperbaric Therapy (HBOT)", icon: "🫁", description: "Hyperbaric oxygen therapy clinics and wound care centers." },
  "iv-therapy": { name: "IV Therapy & Regenerative Medicine", icon: "💉", description: "IV vitamin drips, NAD+, ozone therapy, and regenerative treatments." },
  "hormone-therapy": { name: "Hormone Therapy & Optimization", icon: "⚗️", description: "Hormone replacement, testosterone, thyroid, and endocrine optimization." },
  "pain-management": { name: "Pain Management & Recovery", icon: "🩹", description: "Pain management clinics, cryotherapy, float therapy, and recovery services." },
  "nutrition": { name: "Nutrition & Dietetics", icon: "🥗", description: "Registered dietitians, nutritionists, and meal planning services." },
  "weight-metabolic": { name: "Weight & Metabolic Health", icon: "⚖️", description: "Medical weight loss, GLP-1 programs, and metabolic health." },
  "wellness-coaching": { name: "Health & Wellness Coaching", icon: "🧘", description: "Wellness coaches, yoga studios, meditation, fitness, and lifestyle providers." },
  "wellness-retail": { name: "Health & Wellness Retail", icon: "🛒", description: "Health stores, supplement shops, pharmacies, and wellness retail." },
  "public-health": { icon: "🏛️", description: "Community health resources, prevention programs, and public health services." },
  "animal-health": { icon: "🐾", description: "Veterinary, pet wellness, and animal health providers." },
  "massage": { icon: "🤲", description: "Massage therapists, bodywork providers, and hands-on recovery services." },
  "home-health-caregiving": { icon: "🏠", description: "Home health, caregiving, senior support, and in-home care services." },
  "fitness-studios": { icon: "💪", description: "Fitness studios, personal training, strength, and movement providers." },
  "beauty-grooming": { icon: "💇", description: "Beauty, grooming, spa, and personal care providers." },
  "medical-aesthetics": { icon: "💠", description: "Medical aesthetics, injectables, skin treatments, and cosmetic wellness." },
  "plastic-surgery": { icon: "🩺", description: "Plastic surgery and surgical aesthetics providers." },
  "hair-restoration-pmu": { icon: "✍️", description: "Hair restoration, permanent makeup, and cosmetic tattoo services." },
  "supplements": { icon: "💊", description: "Supplement brands, wellness products, and targeted nutrition support." },
  "herbal-apothecary": { icon: "🌱", description: "Herbal medicine, apothecary products, teas, tinctures, and natural remedies." },
  "non-toxic-home": { icon: "🧼", description: "Non-toxic home products, clean living supplies, and safer household goods." },
  "pharmacy": { icon: "⚕️", description: "Pharmacies, compounding services, and medication support." },
  "natural-grocery": { icon: "🛍️", description: "Natural grocery, specialty foods, and better-for-you local shopping." },
  "energy-medicine-alternative-healing": { icon: "🌟", description: "Energy medicine, alternative healing, and holistic wellness practitioners." },
  "acupuncture-tcm": { icon: "🪷", description: "Acupuncture, traditional Chinese medicine, cupping, and herbal care." },
  "sleep-medicine": { icon: "🌙", description: "Sleep medicine, sleep testing, apnea care, and restorative sleep support." },
  "spiritual-health-sacred-wellness": { icon: "🕯️", description: "Spiritual health, sacred wellness, mindfulness, and soul-centered care." },
  "hearing": { icon: "🎧", description: "Audiology, hearing tests, hearing aids, and hearing health providers." },
};

// Symptom / treatment synonyms used only to power the client-side search index.
// Keyed by taxonomy slug. Seeded from the live /the-directory hub's SYMPTOM_AUGMENT.
const SYMPTOM_AUGMENT = {
  "chiropractic-care": "back pain neck pain shoulder pain knee pain joint pain sciatica adjustment chiropractor chiropractic dc",
  "physical-therapy": "back pain neck pain shoulder pain knee pain joint pain sciatica mobility stiffness recovery rehab sports injury posture pt physical therapy dry needling",
  "sports-medicine": "sports medicine performance recovery hyperbaric red light cryo recovery athlete performance optimization biohacking",
  "fitness-studios": "gym crossfit yoga pilates strength training cardio personal training group fitness barre spin cycle climb martial arts",
  "mental-health": "anxiety depression stress trauma counseling therapy therapist emdr cbt dbt psychologist",
  "behavioral-health": "addiction substance use recovery alcohol drug aa narcotics anonymous suboxone naltrexone ketamine",
  "neurofeedback": "neurofeedback brain health tms spravato concussion brain injury neurology",
  "energy-medicine-alternative-healing": "reiki energy healing energy work shamanic chakra sound bath sound healing somatic craniosacral reflexology quantum energetics ceremony breathwork",
  "spiritual-health-sacred-wellness": "meditation mindfulness buddhist church faith based spiritual sacred prayer chaplaincy retreat",
  "functional-medicine": "functional medicine root cause hormone imbalance gut autoimmune chronic fatigue brain fog",
  "integrative-naturopathic": "naturopathic integrative herbalism alternative holistic",
  "primary-care": "primary care family medicine internist annual physical wellness exam",
  "pediatric-wellness": "pediatric peds children family well-child childhood adolescent kids baby newborn",
  "public-health": "street medicine harm reduction homelessness free clinic community nonprofit",
  "dermatology": "acne rosacea eczema psoriasis skin cancer mole removal medical dermatologist clinical derm",
  "plastic-surgery": "plastic surgery breast augmentation rhinoplasty facelift tummy tuck mommy makeover liposuction reconstructive surgery",
  "medical-aesthetics": "botox filler injectables laser microneedling prp body sculpting emsculpt emsella emface biote hydrafacial medspa cosmetic derm",
  "hair-restoration-pmu": "hair restoration hair loss fue pmu permanent makeup microblading cosmetic tattoo medical tattoo tattoo removal scalp micropigmentation",
  "dental": "cavities braces invisalign implants tooth pain whitening tmj gum disease root canal dentist orthodontist",
  "vision": "vision eye exam glasses contacts eye care optometry ophthalmology",
  "hearing": "audiology audiologist hearing aid hearing test hearing loss tinnitus auditory processing apd musician earplugs in-ear monitors iem va hearing exam cochlear",
  "ent-allergy": "sinus allergies asthma sleep apnea cpap ear infection ent",
  "orthopedic": "orthopedic joint replacement shoulder knee hip ankle sports injury surgery podiatry foot",
  "womens-health": "obgyn obstetrician gynecologist women health pelvic pregnancy menopause perimenopause",
  "sleep-medicine": "sleep lab sleep apnea cpap insomnia polysomnography snoring restless legs sleep study",
  "hyperbaric-therapy": "hyperbaric oxygen hbot wound healing tbi concussion altitude",
  "iv-therapy": "iv hydration vitamin infusion nad nad+ ozone wellness drip",
  "hormone-therapy": "hormone replacement hrt bhrt trt testosterone estrogen progesterone bioidentical pellet thyroid",
  "pain-management": "pain management chronic pain spine injection nerve block",
  "acupuncture-tcm": "acupuncture chinese medicine tcm needling cupping moxibustion qi gong herbal protocols",
  "nutrition": "nutrition diet nutritionist dietitian meal plan rd weight loss metabolism diabetes insulin resistance glp1 glp-1 semaglutide tirzepatide ozempic wegovy mounjaro",
  "wellness-coaching": "life coach wellness coach corporate wellness mindset accountability",
  "natural-grocery": "natural grocery organic produce co-op food coop pomegranate natural grocers bulk foods clean ingredients",
  "animal-health": "pet care veterinary vet dog cat animal wellness pet health dvm",
  "massage": "tension knots relaxation stress relief sore muscles deep tissue sports massage lymphatic lmt cupping facials spa day pampering day spa float floatation sensory deprivation",
  "beauty-grooming": "hair salon barber barbershop men's grooming haircut color highlights blowout salon suites stylist beauty",
  "home-health-caregiving": "caregiving senior care hospice in-home home health elderly aging memory care alzheimers companion doula death doula",
  "supplements": "supplements vitamins protein nutrition support nootropics minerals omega magnesium creatine wellness products",
  "herbal-apothecary": "herbal apothecary tinctures teas botanicals adaptogens tonics salves natural remedies",
  "non-toxic-home": "non-toxic home clean living water filtration air purifier safer household low-tox products",
  "pharmacy": "pharmacy compounding prescriptions medication bioidentical compounded meds",
};

if (!providers.length) {
  throw new Error(`No providers found in ${PROVIDERS_PATH}`);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT_DIR, "site"), { recursive: true });

const categories = buildCategories();
const manifest = [];

writeKey(`${DIRECTORY_BASE}/assets/style.css`, renderDihCss(), "text/css; charset=utf-8");
writeKey(DIRECTORY_BASE, renderDirectoryIndex(), "text/html; charset=utf-8");

for (const category of categories) {
  writeKey(`${DIRECTORY_BASE}/${category.slug}`, renderCategoryPage(category), "text/html; charset=utf-8");
}

for (const provider of providers) {
  writeKey(providerPath(provider), renderProviderPage(provider), "text/html; charset=utf-8");
}

writeKey(`${DIRECTORY_BASE}/search-index.json`, JSON.stringify(buildSearchIndex()), "application/json; charset=utf-8");
writeKey("/sitemap-directory.xml", renderDirectorySitemap(), "application/xml; charset=utf-8");
writeKey("/sitemap.xml", renderSitemapIndex(), "application/xml; charset=utf-8");
writeKey("/llms.txt", renderLlmsTxt(), "text/plain; charset=utf-8");
writeKey("enriched_providers", JSON.stringify(buildEnrichedProviders(), null, 2), "application/json; charset=utf-8");
writeKey("redirects", JSON.stringify(buildRedirectMap(), null, 2), "application/json; charset=utf-8");

fs.writeFileSync(path.join(OUT_DIR, "kv-manifest.json"), JSON.stringify({
  generatedAt: GENERATED_AT,
  siteOrigin: SITE_ORIGIN,
  directoryBase: DIRECTORY_BASE,
  providerCount: providers.length,
  categoryCount: categories.length,
  keys: manifest,
}, null, 2));

console.log(`Generated ${manifest.length} KV entries in ${OUT_DIR}`);
console.log(`Providers: ${providers.length}`);
console.log(`Categories: ${categories.length}`);

function buildCategories() {
  const bySlug = new Map();
  for (const cat of taxonomy) {
    if (!cat.slug) continue;
    const meta = categoryMeta(cat.slug);
    bySlug.set(cat.slug, {
      slug: cat.slug,
      ...meta,
      name: meta.name || cat.name || titleize(cat.slug),
      group: cat.group || "Other",
      providers: [],
    });
  }

  for (const p of providers) {
    const slug = p.category_slug || slugify(p.master_category || "other");
    if (!bySlug.has(slug)) {
      const meta = categoryMeta(slug);
      bySlug.set(slug, {
        slug,
        ...meta,
        name: meta.name || p.master_category || titleize(slug),
        group: "Other",
        providers: [],
      });
    }
    bySlug.get(slug).providers.push(p);
  }

  return Array.from(bySlug.values())
    .filter((cat) => cat.providers.length > 0)
    .map((cat) => ({ ...cat, providers: sortProviders(cat.providers, cat.slug) }))
    .sort((a, b) => {
      const ai = taxonomy.findIndex((cat) => cat.slug === a.slug);
      const bi = taxonomy.findIndex((cat) => cat.slug === b.slug);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.name.localeCompare(b.name);
    });
}

function categoryMeta(slug) {
  const meta = CATEGORY_META[slug] || {};
  return {
    name: meta.name || "",
    icon: meta.icon || "✚",
    description: meta.description || "",
  };
}

function buildSearchIndex() {
  const cats = categories.map((cat) => ({
    name: cat.name,
    slug: cat.slug,
    url: `${DIRECTORY_BASE}/${cat.slug}`,
    icon: cat.icon || "✚",
    count: cat.providers.length,
    kw: `${cat.name} ${SYMPTOM_AUGMENT[cat.slug] || ""}`.toLowerCase(),
  }));
  const provs = [];
  for (const cat of categories) {
    const symptoms = SYMPTOM_AUGMENT[cat.slug] || "";
    for (const p of cat.providers) {
      const tags = Array.isArray(p.service_tags) ? p.service_tags.join(" ") : "";
      const hay = [p.name, cat.name, p.subcategory, locationLine(p), tags, symptoms]
        .filter(Boolean).join(" ").toLowerCase();
      provs.push({
        n: p.name,
        u: providerPath(p),
        c: cat.name,
        m: locationLine(p),
        r: p.google_rating ? String(p.google_rating) : "",
        tier: publicTier(p),
        h: hay,
      });
    }
  }
  return { generatedAt: GENERATED_AT, categories: cats, providers: provs };
}

function sortProviders(items, categorySlug) {
  return [...items].sort((a, b) => {
    const tierDelta = tierRank(a, categorySlug) - tierRank(b, categorySlug);
    if (tierDelta) return tierDelta;
    const reviewsDelta = number(b.reviews) - number(a.reviews);
    if (reviewsDelta) return reviewsDelta;
    const ratingDelta = number(b.google_rating) - number(a.google_rating);
    if (ratingDelta) return ratingDelta;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function tierRank(provider, categorySlug) {
  const tier = tierOf(provider, categorySlug);
  if (tier === "featured") return 0;
  if (tier === "select") return 1;
  return 2;
}

function tierOf(provider, categorySlug) {
  const primary = !categorySlug || provider.category_slug === categorySlug;
  if (primary && (provider.is_featured || provider.tier === "Featured")) return "featured";
  if (primary && (provider.tier === "Select" || provider.tier === "Activated")) return "select";
  return "listed";
}

function renderDirectoryIndex() {
  const title = "The Directory";
  const description = `Find vetted health & wellness providers in Sioux Falls and surrounding areas. ${providers.length} providers across ${categories.length} categories.`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Dialed In Health Directory Categories",
    numberOfItems: categories.length,
    itemListElement: categories.map((cat, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: abs(`${DIRECTORY_BASE}/${cat.slug}`),
      name: cat.name,
    })),
  };
  const chips = ["chronic fatigue", "back pain", "anxiety", "TRT", "weight loss", "pediatric dentist"];
  const groups = groupCategories(categories);
  return layout({
    title,
    description,
    canonicalPath: DIRECTORY_BASE,
    schema: [webPageSchema(title, description, DIRECTORY_BASE), breadcrumbSchema([
      ["Home", "/"],
      ["Directory", DIRECTORY_BASE],
    ]), itemList],
    body: `
      <div class="hub-hero">
        <div class="hub-hero-inner">
          <p class="hub-eyebrow">The Directory</p>
          <h1 class="hub-title">Just <em>ask</em><span class="hub-title-dot">.</span></h1>
          <p class="hub-subtitle">Search by symptom, treatment, or category. We&rsquo;ll point you to the right providers.</p>
          <form id="dih-hub-form" class="hub-form" autocomplete="off">
            <div class="hub-search-wrap">
              <input id="dih-hub-search" type="text" class="hub-search" placeholder="Tell me what you&rsquo;re looking for&hellip;" autocomplete="off">
              <button id="dih-hub-clear" type="button" class="hub-clear" aria-label="Clear search" style="display:none">&times;</button>
            </div>
            <button id="dih-hub-ask" type="submit" class="hub-ask">Ask</button>
          </form>
          <div class="hub-chips">
            <span class="hub-chips-label">Try:</span>
            ${chips.map((c, i) => `${i ? '<span class="hub-chip-sep">&middot;</span>' : ''}<button type="button" class="hub-chip" data-q="${esc(c)}">${esc(c)}</button>`).join("")}
          </div>
          <p class="hub-disclosure"><strong>Not medical advice.</strong> For emergencies call 911.</p>
        </div>
      </div>
      <div class="hub-body">
        <div class="hub-body-inner">
          <div id="dih-hub-results" aria-live="polite" hidden></div>
          <div id="dih-hub-browse">
            <div class="hub-summary"><strong>${providers.length}</strong> providers &middot; <strong>${categories.length}</strong> categories</div>
            ${groups.map(([group, cats]) => `
              <div class="hub-section">
                <div class="hub-section-head">
                  <h2 class="hub-section-title">${esc(group)}</h2>
                </div>
                <div class="hub-section-grid">
                  ${cats.map((cat) => `
                    <a class="hub-cat-card" href="${esc(`${DIRECTORY_BASE}/${cat.slug}`)}">
                      <div class="hub-cat-icon" aria-hidden="true">${esc(cat.icon || "✚")}</div>
                      <div class="hub-cat-name">${esc(cat.name)}</div>
                      <p class="hub-cat-count"><strong>${cat.providers.length}</strong> provider${cat.providers.length === 1 ? "" : "s"}</p>
                    </a>`).join("")}
                </div>
              </div>`).join("")}
          </div>
        </div>
      </div>
      ${renderHubSearchScript()}
    `,
  });
}

function renderHubSearchScript() {
  return `
    <script>
    (function(){
      var BASE = ${JSON.stringify(DIRECTORY_BASE)};
      var form = document.getElementById('dih-hub-form');
      var input = document.getElementById('dih-hub-search');
      var clearBtn = document.getElementById('dih-hub-clear');
      var results = document.getElementById('dih-hub-results');
      var browse = document.getElementById('dih-hub-browse');
      var INDEX=null, loading=false, pending=null;
      function load(cb){ if(INDEX){cb();return;} if(loading){pending=cb;return;} loading=true;
        fetch(BASE+'/search-index.json').then(function(r){return r.json();}).then(function(d){INDEX=d;loading=false;cb();if(pending){var p=pending;pending=null;p();}}).catch(function(){loading=false;}); }
      function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
      function tokenize(s){return (s||'').toLowerCase().split(/[^a-z0-9+]+/).filter(function(w){return w.length>1;});}
      function matchWord(term,word){ if(!term||!word)return false; if(word.indexOf(term)!==-1)return true; if(term.indexOf(word)!==-1&&word.length>=4)return true; var min=Math.min(term.length,word.length); if(min<5)return false; var c=0; for(var i=0;i<min;i++){if(term.charAt(i)!==word.charAt(i))break;c++;} return c>=5; }
      function score(hay,name,terms){ var total=0,matched=0; for(var i=0;i<terms.length;i++){ var t=terms[i],hit=false,j; for(j=0;j<name.length;j++){if(matchWord(t,name[j])){total+=5;hit=true;break;}} if(!hit){for(j=0;j<hay.length;j++){if(matchWord(t,hay[j])){total+=1;hit=true;break;}}} if(hit)matched++; } return matched===terms.length?total:0; }
      function setBrowse(v){ if(browse) browse.style.display = v ? '' : 'none'; }
      function card(p){ var badge = p.tier==='Featured'?'<span class="hub-badge featured">Featured</span>':(p.tier==='Select'?'<span class="hub-badge select">Select</span>':'');
        return '<a class="hub-result-card'+(p.tier==='Featured'?' is-featured':'')+'" href="'+esc(p.u)+'">'+badge
          +'<div class="hub-result-name">'+esc(p.n)+'</div>'
          +(p.m?'<div class="hub-result-meta">'+esc(p.m)+'</div>':'')
          +(p.r?'<div class="hub-result-rating"><strong>'+esc(p.r)+'</strong> &#9733;</div>':'')
          +'<div class="hub-result-cat">'+esc(p.c)+'</div></a>'; }
      function render(q,cats,provs){ setBrowse(false); var html='';
        if(!cats.length && !provs.length){ results.innerHTML='<div class="hub-results"><div class="hub-empty"><strong>No matches for &ldquo;'+esc(q)+'&rdquo;</strong>Try a symptom or treatment, or browse all categories below.</div></div>'; results.hidden=false; setBrowse(true); return; }
        html+='<div class="hub-summary"><strong>'+provs.length+'</strong> result'+(provs.length===1?'':'s')+' for &ldquo;'+esc(q)+'&rdquo;</div>';
        if(cats.length){ html+='<div class="hub-suggestions">'+cats.map(function(o){return '<a class="hub-suggest-card" href="'+esc(o.c.url)+'">'+esc(o.c.name)+' ('+o.c.count+')</a>';}).join('')+'</div>'; }
        if(provs.length){ html+='<div class="hub-results" style="margin-top:1.5rem">'+provs.map(function(o){return card(o.p);}).join('')+'</div>'; }
        results.innerHTML=html; results.hidden=false;
      }
      function run(q){ q=(q||'').trim(); if(!q){ results.hidden=true; results.innerHTML=''; setBrowse(true); return; }
        load(function(){ if(!INDEX){return;} var terms=tokenize(q); if(!terms.length){results.hidden=true;setBrowse(true);return;}
          var cats=INDEX.categories.map(function(c){ if(!c._h){c._h=tokenize(c.kw);c._n=tokenize(c.name);} var s=score(c._h,c._n,terms); return s>0?{c:c,s:s}:null; }).filter(Boolean).sort(function(a,b){return b.s-a.s;}).slice(0,6);
          var provs=INDEX.providers.map(function(p){ if(!p._h){p._h=tokenize(p.h);p._n=tokenize(p.n);} var s=score(p._h,p._n,terms); if(s>0){var tb=p.tier==='Featured'?2:(p.tier==='Select'?1:0);return {p:p,s:s*10+tb};} return null; }).filter(Boolean).sort(function(a,b){return b.s-a.s;}).slice(0,30);
          render(q,cats,provs); });
      }
      function sync(){ clearBtn.style.display = input.value ? 'block' : 'none'; }
      var t;
      form.addEventListener('submit', function(e){ e.preventDefault(); sync(); run(input.value); });
      input.addEventListener('input', function(){ sync(); clearTimeout(t); t=setTimeout(function(){ run(input.value); }, 140); });
      clearBtn.addEventListener('click', function(){ input.value=''; sync(); run(''); input.focus(); });
      document.querySelectorAll('.hub-chip').forEach(function(ch){ ch.addEventListener('click', function(){ input.value=ch.getAttribute('data-q'); sync(); run(input.value); input.focus(); }); });
      var qp=new URLSearchParams(location.search).get('q'); if(qp){ input.value=qp; sync(); run(qp); }
    })();
    </script>
  `;
}

function renderCategoryCard(category) {
  return `
    <a href="${esc(`${DIRECTORY_BASE}/${category.slug}`)}" class="dir-cat-card">
      <div class="cat-icon" aria-hidden="true">${esc(category.icon || "✚")}</div>
      <div class="cat-name">${esc(category.name)}</div>
      <div class="cat-desc">${esc(category.description || `Browse ${category.name.toLowerCase()} providers in the directory.`)}</div>
      <div class="cat-count">${category.providers.length} provider${category.providers.length === 1 ? "" : "s"}</div>
      <span class="pcard-cta">Browse Category &rarr;</span>
    </a>
  `;
}

function groupCategories(cats) {
  const order = [
    "Body & Movement",
    "Mind & Behavior",
    "Medicine & Primary Care",
    "Specialty & Surgical",
    "Recovery & Regenerative",
    "Nutrition & Lifestyle",
    "Retail & Products",
    "Other",
  ];
  const grouped = new Map();
  for (const cat of cats) {
    const group = cat.group || "Other";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(cat);
  }
  return Array.from(grouped.entries()).sort((a, b) => {
    const ai = order.indexOf(a[0]);
    const bi = order.indexOf(b[0]);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function renderChatBox() {
  return `
    <section class="dih-chat" id="dih-chat" role="region" aria-label="Ask the directory">
      <div class="dih-chat-log" id="dih-chat-log" aria-live="polite"></div>
      <div class="dih-chat-greeting" id="dih-chat-greeting">
        <strong>Ask the Directory</strong>
        <span>Tell us what kind of provider you need.</span>
        <div class="dih-chat-suggest">
          <button class="dih-chat-chip" type="button" data-q="I need a chiropractor near 57104">chiropractor near 57104</button>
          <button class="dih-chat-chip" type="button" data-q="Functional medicine for chronic fatigue">chronic fatigue</button>
          <button class="dih-chat-chip" type="button" data-q="Testosterone replacement therapy in Sioux Falls">TRT in Sioux Falls</button>
          <button class="dih-chat-chip" type="button" data-q="Pediatric dentist for my toddler">pediatric dentist</button>
          <button class="dih-chat-chip" type="button" data-q="Therapist for anxiety">therapist for anxiety</button>
        </div>
      </div>
      <form class="dih-chat-form" id="dih-chat-form" autocomplete="off">
        <input class="dih-chat-input" id="dih-chat-input" type="text" maxlength="1000" placeholder="Ask about any health or wellness provider..." aria-label="Ask about any health or wellness provider">
        <button type="submit" class="dih-chat-send" id="dih-chat-send">Ask</button>
      </form>
      <div class="dih-chat-disclaimer">Not medical advice. For emergencies call 911. Your search is logged for improving the directory.</div>
    </section>
    <script>
    (function(){
      var API = '/directory-api/';
      var logEl = document.getElementById('dih-chat-log');
      var greetingEl = document.getElementById('dih-chat-greeting');
      var formEl = document.getElementById('dih-chat-form');
      var inputEl = document.getElementById('dih-chat-input');
      var sendBtn = document.getElementById('dih-chat-send');
      var history = [];
      var isSending = false;
      var source = new URLSearchParams(window.location.search).get('src') || 'native';

      function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
      function renderMarkdown(text){
        var safe = escapeHtml(text || '');
        safe = safe.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
        safe = safe.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(_, label, url){
          var clean = url.trim();
          if (clean.indexOf('https://www.dialedin.health/') !== 0 && clean.indexOf('/directory/') !== 0) return label;
          return '<a href="'+clean+'" target="_self" rel="noopener">'+label+'</a>';
        });
        return safe.split(/\\n\\n+/).map(function(p){return '<p>'+p.replace(/\\n/g,'<br>')+'</p>';}).join('');
      }
      function addBubble(role, content, md){
        if (greetingEl) greetingEl.style.display = 'none';
        var b = document.createElement('div');
        b.className = 'dih-chat-bubble ' + role;
        if (md) b.innerHTML = renderMarkdown(content); else b.textContent = content;
        logEl.appendChild(b);
        logEl.scrollTop = logEl.scrollHeight;
        return b;
      }
      function addTyping(){
        var b = document.createElement('div');
        b.className = 'dih-chat-bubble bot';
        b.innerHTML = '<div class="dih-chat-typing"><span></span><span></span><span></span></div>';
        logEl.appendChild(b);
        logEl.scrollTop = logEl.scrollHeight;
        return b;
      }
      async function sendQuestion(q){
        if (!q || isSending) return;
        isSending = true; sendBtn.disabled = true; inputEl.value = '';
        addBubble('user', q, false);
        var typing = addTyping();
        try {
          var resp = await fetch(API, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({question:q, history:history.slice(-6), source:source})});
          var data = await resp.json();
          typing.remove();
          if (data.answer) {
            addBubble('bot', data.answer, true);
            history.push({role:'user', content:q});
            history.push({role:'assistant', content:data.answer});
          } else {
            addBubble('error', data.error || 'Something went wrong. Try again?', false);
          }
        } catch(e) {
          typing.remove();
          addBubble('error', "Can't reach the directory right now - please try again in a moment.", false);
        } finally {
          isSending = false; sendBtn.disabled = false; inputEl.focus(); source = 'native';
        }
      }
      formEl.addEventListener('submit', function(e){e.preventDefault(); sendQuestion(inputEl.value.trim());});
      document.querySelectorAll('.dih-chat-chip').forEach(function(chip){chip.addEventListener('click', function(){sendQuestion(chip.getAttribute('data-q'));});});
    })();
    </script>
  `;
}

function renderCategoryPage(category) {
  const title = `${category.name} Providers`;
  const description = category.description || `Find ${category.name.toLowerCase()} providers in the Dialed In Health directory.`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: category.providers.length,
    itemListElement: category.providers.map((p, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: abs(providerPath(p)),
      item: localBusinessSchema(p, providerPath(p)),
    })),
  };
  return layout({
    title: `${title} | Dialed In Health`,
    description,
    canonicalPath: `${DIRECTORY_BASE}/${category.slug}`,
    schema: [breadcrumbSchema([
      ["Home", "/"],
      ["Directory", DIRECTORY_BASE],
      [category.name, `${DIRECTORY_BASE}/${category.slug}`],
    ]), itemList, faqSchema(categoryFaq(category))],
    body: `
      <div class="hub-hero is-page">
        <div class="hub-hero-inner">
          <div class="crumbs"><a href="/">Home</a> &rsaquo; <a href="${esc(DIRECTORY_BASE)}/">The Directory</a> &rsaquo; ${esc(category.name)}</div>
          <div class="hub-page-icon" aria-hidden="true">${esc(category.icon || "✚")}</div>
          <p class="hub-eyebrow">${esc(category.group)}</p>
          <h1 class="hub-title">${esc(category.name)}</h1>
          <p class="hub-subtitle">${esc(description)}</p>
        </div>
      </div>
      <div class="hub-body">
        <div class="hub-body-inner">
          <div class="hub-summary"><strong>${category.providers.length}</strong> provider${category.providers.length === 1 ? "" : "s"}</div>
          <div class="hub-results">
            ${category.providers.map((p) => renderProviderCard(p, category.slug)).join("\n")}
          </div>
        </div>
      </div>
    `,
  });
}

function renderProviderSection() { return ""; }

function renderProviderCard(provider, categorySlug) {
  const tier = tierOf(provider, categorySlug);
  const badge = tier === "featured" ? '<span class="hub-badge featured">Featured</span>'
    : tier === "select" ? '<span class="hub-badge select">Select</span>' : "";
  const reviews = provider.reviews ? ` <span>(${esc(String(provider.reviews))})</span>` : "";
  return `
    <a class="hub-result-card${tier === "featured" ? " is-featured" : ""}" href="${esc(providerPath(provider))}">
      ${badge}
      <div class="hub-result-name">${esc(provider.name)}</div>
      ${locationLine(provider) ? `<div class="hub-result-meta">${esc(locationLine(provider))}</div>` : ""}
      ${provider.google_rating ? `<div class="hub-result-rating"><strong>${esc(String(provider.google_rating))}</strong> &#9733;${reviews}</div>` : ""}
      <div class="hub-result-cat">${esc(provider.subcategory || provider.master_category || "")}</div>
    </a>
  `;
}

function renderProviderPage(provider) {
  const category = categories.find((cat) => cat.slug === provider.category_slug) || {
    name: provider.master_category || titleize(provider.category_slug || "directory"),
    slug: provider.category_slug || "directory",
    description: "",
  };
  const pagePath = providerPath(provider);
  const enriched = enrichedFor(provider);
  const title = `${provider.name} | ${category.name} | Dialed In Health`;
  const description = enrichedDescription(enriched) || provider.description || providerAbout(provider, category);
  const faq = providerFaq(provider, category);
  const tags = mergeUnique(enrichedList(enriched, "specialtyTags"), provider.service_tags || []);
  const services = enrichedList(enriched, "services");
  return layout({
    title,
    description,
    canonicalPath: pagePath,
    ogImage: null,
    schema: [
      localBusinessSchema(provider, pagePath),
      breadcrumbSchema([
        ["Home", "/"],
        ["Directory", DIRECTORY_BASE],
        [category.name, `${DIRECTORY_BASE}/${category.slug}`],
        [provider.name, pagePath],
      ]),
      faqSchema(faq),
    ],
    body: `
      <div class="dih-detail">
        <div class="crumbs"><a href="/">Home</a> &rsaquo; <a href="${esc(DIRECTORY_BASE)}/">The Directory</a> &rsaquo; <a href="${esc(`${DIRECTORY_BASE}/${category.slug}`)}">${esc(category.name)}</a> &rsaquo; ${esc(provider.name)}</div>
        <div class="dih-detail-cat">${esc(category.name)}</div>
        <h1>${esc(provider.name)}</h1>
        ${ratingText(provider) ? `<p class="dih-detail-rating"><strong>${esc(String(provider.google_rating))}</strong> &#9733;${provider.reviews ? ` &middot; ${esc(String(provider.reviews))} reviews` : ""}</p>` : ""}
        <div class="dih-detail-grid">
          <div>
            <p class="dih-detail-about">${esc(description)}</p>
            ${services.length ? `<div class="dih-detail-section"><h2>What they offer</h2><ul class="dih-tags">${services.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
            ${tags.length ? `<div class="dih-detail-section"><h2>Services &amp; Focus</h2><ul class="dih-tags">${tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
            <div class="dih-detail-section dih-faq">
              <h2>Frequently asked</h2>
              ${faq.map((item) => `<details><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join("")}
            </div>
          </div>
          <aside class="dih-side">
            ${detailRow("Tier", publicTier(provider))}
            ${detailRow("Location", locationLine(provider))}
            ${detailRow("Address", provider.address)}
            ${detailRow("Phone", provider.phone)}
            ${detailRow("Rating", ratingText(provider))}
            ${provider.website ? `<a class="dih-btn" href="${esc(normalizeWebsite(provider.website))}" rel="nofollow noopener" target="_blank">Visit website</a>` : ""}
            ${provider.phone ? `<a class="dih-btn secondary" href="tel:${esc(tel(provider.phone))}">Call ${esc(provider.phone)}</a>` : ""}
          </aside>
        </div>
      </div>
    `,
  });
}

function layout({ title, description, canonicalPath, body, schema = [], ogImage = null }) {
  const canonical = abs(canonicalPath);
  const schemaBlocks = schema.filter(Boolean).map((obj) =>
    `<script type="application/ld+json">${JSON.stringify(obj, null, 2).replace(/</g, "\\u003c")}</script>`
  ).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="dih-static-generator">
  <meta name="generated-at" content="${esc(GENERATED_AT)}">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  ${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Instrument+Serif:ital,wght@0,400;1,400&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${DIRECTORY_BASE}/assets/style.css">
  ${schemaBlocks}
</head>
<body>
  ${renderNav()}
  <div class="dih-hub">${body}</div>
</body>
</html>`;
}

function renderNav() {
  return `
  <nav class="vgl-nav">
    <div class="vgl-nav-inner">
      <a href="/" class="vgl-nav-logo">
        <span class="vgl-nav-logo-text">Dialed In <em>Health</em></span>
      </a>
      <button class="vgl-nav-toggle" type="button" aria-label="Toggle menu" aria-expanded="false">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      <div class="vgl-nav-menu">
        <ul class="vgl-nav-links">
          <li><a href="/">Podcast</a></li>
          <li><a href="${DIRECTORY_BASE}/" class="nav-directory-link">The Directory</a></li>
          <li><a href="/be-a-guest">Be a Guest</a></li>
          <li><a href="/guides">Guides</a></li>
        </ul>
      </div>
    </div>
  </nav>
  <script>
  (function(){
    var toggle = document.querySelector('.vgl-nav-toggle');
    var menu = document.querySelector('.vgl-nav-menu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', function(){
      var active = menu.classList.toggle('active');
      toggle.setAttribute('aria-expanded', active ? 'true' : 'false');
    });
  })();
  </script>`;
}

function renderCss() {
  return `:root{--black:#0d0d0d;--dark:#1a1a1a;--ink:#202020;--muted:#666;--dim:#999;--line:#dedede;--soft:#f7f7f7;--teal:#00bfb2;--teal-dark:#008c82;--white:#fff}*{box-sizing:border-box}body{margin:0;font-family:'DM Sans',system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--soft);line-height:1.55}a{color:inherit}.site-header{height:88px;display:flex;align-items:center;justify-content:space-between;padding:0 52px;border-bottom:1px solid #e5e3de;background:rgba(245,245,240,.97);position:sticky;top:0;z-index:20;backdrop-filter:blur(12px)}.brand{font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.12em;font-size:18px;text-decoration:none;white-space:nowrap}.site-header nav{display:flex;gap:44px;align-items:center}.site-header nav a{text-decoration:none;text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:15px;color:#2b2b2b}.site-header nav a:hover{color:var(--teal-dark)}.shell{max-width:1280px;margin:0 auto;padding:0 24px 80px}.hero{padding:24px 0 42px}.hero--directory{text-align:center}.hero.compact{text-align:left;padding-top:42px;padding-bottom:28px}.eyebrow{font-family:'DM Mono',monospace;color:var(--teal-dark);text-transform:uppercase;letter-spacing:.08em;font-size:12px;margin:0 0 10px}.hero h1{font-family:'Playfair Display',Georgia,serif;font-size:clamp(60px,7vw,96px);line-height:.96;margin:0 0 18px;letter-spacing:0;font-weight:700}.hero h1 em{font-style:italic;color:var(--teal);font-weight:600}.hero p{font-size:22px;max-width:980px;color:var(--muted);margin:0 auto}.hero.compact p{margin:0;max-width:760px;font-size:18px}.dih-chat{max-width:1060px;margin:50px auto 0;padding:32px 38px;background:#ededed;border:1px solid #d2d2d2;border-radius:24px}.dih-chat-log{max-height:420px;overflow:auto;display:flex;flex-direction:column;gap:14px}.dih-chat-log:empty{display:none}.dih-chat-greeting{font-size:18px;color:var(--muted);margin-bottom:20px}.dih-chat-greeting strong{display:block;color:var(--dark);font-family:'Playfair Display',Georgia,serif;font-size:30px;margin-bottom:4px}.dih-chat-suggest{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px}.dih-chat-chip{border:1px solid rgba(0,191,178,.35);background:rgba(0,191,178,.08);border-radius:999px;padding:8px 12px;color:var(--teal-dark);font-weight:700;cursor:pointer}.dih-chat-chip:hover{background:rgba(0,191,178,.18)}.dih-chat-form{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:16px;margin-top:24px}.dih-chat-input{height:74px;border-radius:999px;border:2px solid var(--teal);background:#fff;padding:0 28px;font-size:18px;color:var(--dark)}.dih-chat-input:focus{outline:none;box-shadow:0 0 0 4px rgba(0,191,178,.12)}.dih-chat-send{border:0;border-radius:999px;background:var(--teal);font-weight:800;text-transform:uppercase;font-size:16px;cursor:pointer}.dih-chat-send:disabled{opacity:.55;cursor:wait}.dih-chat-disclaimer{font-size:14px;color:var(--dim);margin-top:18px}.dih-chat-bubble{max-width:86%;border-radius:18px;padding:18px 22px;font-size:18px;line-height:1.55}.dih-chat-bubble.user{align-self:flex-end;background:#d7efed}.dih-chat-bubble.bot{align-self:center;background:#fff;border:1px solid #ddd;box-shadow:0 1px 3px rgba(0,0,0,.06)}.dih-chat-bubble.error{background:#fff2f2;border:1px solid #ffd0d0}.dih-chat-bubble p{margin:0 0 12px}.dih-chat-bubble p:last-child{margin-bottom:0}.dih-chat-bubble a{color:var(--teal-dark);font-weight:800}.dih-chat-typing{display:flex;gap:6px}.dih-chat-typing span{width:8px;height:8px;border-radius:50%;background:var(--teal);animation:dihPulse 1s infinite ease-in-out}.dih-chat-typing span:nth-child(2){animation-delay:.15s}.dih-chat-typing span:nth-child(3){animation-delay:.3s}@keyframes dihPulse{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}.category-group-section{margin-top:48px}.category-group-section h2{font-family:'DM Mono',monospace;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--teal-dark);margin:0 0 18px}.category-grid,.provider-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.category-card,.provider-card{display:flex;flex-direction:column;gap:8px;min-height:142px;text-decoration:none;border:1px solid var(--line);background:#fff;padding:22px;border-radius:8px;transition:.15s ease}.category-card:hover,.provider-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.08)}.category-card strong,.provider-card strong{font-family:'Playfair Display',Georgia,serif;font-size:25px;line-height:1.05}.category-card span,.sub,.meta,.tags{color:var(--muted);font-size:14px}.badge{font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:var(--teal-dark);align-self:flex-start;border:1px solid rgba(0,191,178,.35);border-radius:999px;padding:3px 8px}.provider-section{margin-top:34px}.provider-section h2{font-family:'Playfair Display',Georgia,serif;font-size:30px;margin:0 0 14px}.provider-section h2 span{font-family:'DM Sans',sans-serif;font-size:16px;color:var(--muted);font-weight:500}.provider-card.is-featured{border:2px solid var(--teal);box-shadow:0 4px 16px rgba(0,191,178,.14)}.provider-card.is-featured .badge{background:var(--teal);color:#071818}.provider-card.is-select{border-left:5px solid var(--teal)}.rating{color:#b47a00;font-weight:700;font-size:14px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.chips span{border:1px solid var(--line);border-radius:999px;padding:7px 12px;font-size:13px;color:var(--muted);background:#fff}.breadcrumbs{font-size:13px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.breadcrumbs a{text-decoration:none;color:var(--teal-dark)}.detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}.detail-main,.detail-side,.faq-block{border-top:1px solid var(--line);padding-top:22px}.detail-main h2,.faq-block h2{font-family:'Playfair Display',Georgia,serif;font-size:28px;margin:0 0 10px}.detail-main ul{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:8px 0 28px;list-style:none}.detail-main li{background:#fff;border:1px solid var(--line);border-radius:999px;padding:7px 11px;font-size:14px}.detail-side{background:#fff;border:1px solid var(--line);border-radius:8px;padding:18px}.row{padding:12px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}.row span{display:block;font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px}.button{display:inline-flex;margin:18px 10px 0 0;align-items:center;border-radius:999px;background:var(--dark);color:#fff;text-decoration:none;padding:10px 16px;font-weight:700}.button.secondary{background:#fff;color:var(--dark);border:1px solid var(--line)}details{border-top:1px solid var(--line);padding:14px 0}summary{cursor:pointer;font-weight:700}@media(max-width:860px){.site-header{padding:0 18px;height:70px}.site-header nav{display:none}.brand{font-size:14px}.shell{padding:0 16px 56px}.hero h1{font-size:54px}.hero p{font-size:18px}.dih-chat{margin-top:30px;padding:18px 14px;border-radius:18px}.dih-chat-form{grid-template-columns:1fr;gap:10px}.dih-chat-send{height:56px}.dih-chat-input{height:60px;font-size:16px}.dih-chat-bubble{max-width:100%;font-size:15px}.detail-grid{grid-template-columns:1fr}.provider-card,.category-card{min-height:auto}}`;
}

function renderDesignCss() {
  return `:root{--bg:#f7f7f4;--paper:#fff;--text:#1a1a1a;--muted:#666;--dim:#999;--border:#e0e0e0;--line:#d8d8d4;--teal:#00bfb2;--teal-dark:#00a89f;--black:#0d0d0d;--cream:#f2f1ec}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:'DM Sans',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--text);background:var(--bg);line-height:1.55}a{color:inherit}.vgl-nav{height:88px;background:rgba(247,247,244,.98);border-bottom:1px solid #dedbd4;position:sticky;top:0;z-index:50;backdrop-filter:blur(14px)}.vgl-nav-inner{height:100%;display:flex;align-items:center;justify-content:space-between;gap:28px;padding:0 48px;max-width:1600px;margin:0 auto}.vgl-nav-logo{display:flex;align-items:center;gap:14px;text-decoration:none;min-width:270px}.vgl-nav-logo-mark{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:999px;background:var(--teal);color:#071818;font-family:'DM Mono',monospace;font-weight:700;font-size:13px;letter-spacing:.04em}.vgl-nav-logo-text{font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.12em;font-size:18px;line-height:1.1;color:#2b2b2b;white-space:nowrap}.vgl-nav-logo-text span{display:block}.vgl-nav-menu{display:flex;align-items:center;gap:28px}.vgl-nav-links{display:flex;align-items:center;gap:42px;list-style:none;margin:0;padding:0}.vgl-nav-links a{text-decoration:none;text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:15px;color:#2b2b2b}.vgl-nav-links a:hover,.vgl-nav-links .nav-directory-link{color:var(--teal-dark)}.vgl-nav-cta{display:inline-flex;align-items:center;justify-content:center;min-height:42px;border-radius:999px;background:var(--teal);color:#081817;text-decoration:none;text-transform:uppercase;font-weight:800;letter-spacing:.06em;font-size:13px;padding:0 18px;white-space:nowrap}.vgl-nav-cta:hover{background:#09d2c5}.vgl-nav-toggle{display:none;background:transparent;border:0;color:#222;padding:8px;cursor:pointer}.hero--light{background:var(--bg);color:var(--text);text-align:center;padding:42px 24px 52px;border-bottom:1px solid #e5e2dc}.hero-content{max-width:980px;margin:0 auto}.hero-eyebrow{font-family:'DM Mono',monospace;color:var(--teal-dark);text-transform:uppercase;letter-spacing:.12em;font-size:13px;margin-bottom:12px}.hero-name{font-family:'Playfair Display',Georgia,serif;font-size:clamp(54px,6vw,86px);line-height:.96;margin:0;color:var(--text);font-weight:600;letter-spacing:0}.hero-name em{color:var(--teal);font-style:italic;font-weight:400}.hero-subtitle{font-size:clamp(20px,2.1vw,28px);line-height:1.45;color:var(--muted);max-width:980px;margin:24px auto 0}.dih-chat{max-width:1120px;margin:46px auto 0;padding:32px 38px;background:rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.12);border-radius:24px;text-align:center}.dih-chat-log{max-height:430px;overflow:auto;display:flex;flex-direction:column;gap:14px;margin-bottom:18px}.dih-chat-log:empty{display:none}.dih-chat-greeting{font-size:18px;color:var(--text);margin-bottom:22px}.dih-chat-greeting strong{display:block;color:var(--teal-dark);font-family:'Playfair Display',Georgia,serif;font-size:32px;line-height:1.1;margin-bottom:4px}.dih-chat-suggest{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px}.dih-chat-chip{border:1px solid rgba(0,191,178,.4);background:rgba(0,191,178,.08);border-radius:999px;padding:8px 12px;color:var(--teal-dark);font-weight:700;cursor:pointer}.dih-chat-chip:hover{background:rgba(0,191,178,.18);color:#007a73}.dih-chat-form{display:grid;grid-template-columns:minmax(0,1fr) 116px;gap:16px;align-items:center;margin-top:24px}.dih-chat-input{width:100%;height:74px;border-radius:999px;border:2px solid var(--teal);background:#fff;padding:0 30px;font-size:18px;color:var(--text)}.dih-chat-input::placeholder{color:#777}.dih-chat-input:focus{outline:none;box-shadow:0 0 0 4px rgba(0,191,178,.12)}.dih-chat-send{height:74px;border:0;border-radius:999px;background:var(--teal);font-weight:800;text-transform:uppercase;font-size:16px;letter-spacing:.04em;cursor:pointer;color:#081817}.dih-chat-send:disabled{opacity:.55;cursor:wait}.dih-chat-disclaimer{font-size:14px;color:var(--dim);margin-top:18px}.dih-chat-bubble{max-width:86%;border-radius:18px;padding:18px 22px;font-size:18px;line-height:1.55;text-align:left}.dih-chat-bubble.user{align-self:flex-end;background:rgba(0,191,178,.15);color:var(--text)}.dih-chat-bubble.bot{align-self:center;background:#fff;color:var(--text);border:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,.06)}.dih-chat-bubble.error{background:#fff2f2;border:1px solid #ffd0d0}.dih-chat-bubble p{margin:0 0 12px}.dih-chat-bubble p:last-child{margin-bottom:0}.dih-chat-bubble a{color:var(--teal-dark);font-weight:800}.dih-chat-typing{display:flex;gap:6px}.dih-chat-typing span{width:8px;height:8px;border-radius:50%;background:var(--teal);animation:dihPulse 1s infinite ease-in-out}.dih-chat-typing span:nth-child(2){animation-delay:.15s}.dih-chat-typing span:nth-child(3){animation-delay:.3s}@keyframes dihPulse{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-5px);opacity:1}}.dir-section{max-width:1280px;margin:0 auto;padding:58px 24px 90px}.dir-section-head{text-align:center;margin:0 auto 28px;max-width:720px}.section-eyebrow{font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.12em;color:var(--teal-dark);font-size:12px;margin-bottom:10px}.dir-section-head h2{font-family:'Playfair Display',Georgia,serif;font-size:42px;line-height:1.05;font-weight:500;margin:0}.dir-cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.dir-cat-card{display:flex;flex-direction:column;min-height:245px;text-decoration:none;border:1px solid var(--border);background:#fff;padding:26px 24px;border-radius:8px;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}.dir-cat-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:0 14px 28px rgba(0,0,0,.08)}.cat-icon{font-size:34px;line-height:1;margin-bottom:18px}.cat-name{font-family:'Playfair Display',Georgia,serif;font-size:25px;line-height:1.08;color:var(--text);margin-bottom:10px}.cat-desc{color:var(--muted);font-size:15px;line-height:1.45;min-height:64px}.cat-count{font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:var(--dim);font-size:12px;margin-top:auto;padding-top:18px}.pcard-cta{display:inline-block;margin-top:12px;color:var(--teal-dark);font-weight:800;font-size:14px}.shell{max-width:1280px;margin:0 auto;padding:0 24px 80px}.hero{padding:38px 0 42px}.hero.compact{text-align:left;padding-top:42px;padding-bottom:28px}.eyebrow{font-family:'DM Mono',monospace;color:var(--teal-dark);text-transform:uppercase;letter-spacing:.08em;font-size:12px;margin:0 0 10px}.hero h1{font-family:'Playfair Display',Georgia,serif;font-size:clamp(48px,6vw,82px);line-height:.98;margin:0 0 18px;letter-spacing:0;font-weight:500}.hero p{font-size:20px;max-width:860px;color:var(--muted);margin:0}.provider-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}.provider-card{display:flex;flex-direction:column;gap:8px;min-height:164px;text-decoration:none;border:1px solid var(--border);background:#fff;padding:22px;border-radius:8px;transition:.15s ease}.provider-card:hover{border-color:var(--teal);transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.08)}.provider-card strong{font-family:'Playfair Display',Georgia,serif;font-size:25px;line-height:1.05}.sub,.meta,.tags{color:var(--muted);font-size:14px}.badge{font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.06em;font-size:11px;color:var(--teal-dark);align-self:flex-start;border:1px solid rgba(0,191,178,.35);border-radius:999px;padding:3px 8px}.provider-section{margin-top:34px}.provider-section h2{font-family:'Playfair Display',Georgia,serif;font-size:30px;margin:0 0 14px}.provider-section h2 span{font-family:'DM Sans',sans-serif;font-size:16px;color:var(--muted);font-weight:500}.provider-card.is-featured{border:2px solid var(--teal);box-shadow:0 4px 16px rgba(0,191,178,.14)}.provider-card.is-featured .badge{background:var(--teal);color:#071818}.provider-card.is-select{border-left:5px solid var(--teal)}.rating{color:#b47a00;font-weight:700;font-size:14px}.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.chips span{border:1px solid var(--border);border-radius:999px;padding:7px 12px;font-size:13px;color:var(--muted);background:#fff}.breadcrumbs{font-size:13px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.breadcrumbs a{text-decoration:none;color:var(--teal-dark)}.detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:28px;align-items:start}.detail-main,.detail-side,.faq-block{border-top:1px solid var(--border);padding-top:22px}.detail-main h2,.faq-block h2{font-family:'Playfair Display',Georgia,serif;font-size:28px;margin:0 0 10px}.detail-main ul{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:8px 0 28px;list-style:none}.detail-main li{background:#fff;border:1px solid var(--border);border-radius:999px;padding:7px 11px;font-size:14px}.detail-side{background:#fff;border:1px solid var(--border);border-radius:8px;padding:18px}.row{padding:12px 0;border-bottom:1px solid var(--border)}.row:last-child{border-bottom:0}.row span{display:block;font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:3px}.button{display:inline-flex;margin:18px 10px 0 0;align-items:center;border-radius:999px;background:var(--text);color:#fff;text-decoration:none;padding:10px 16px;font-weight:700}.button.secondary{background:#fff;color:var(--text);border:1px solid var(--border)}details{border-top:1px solid var(--border);padding:14px 0}summary{cursor:pointer;font-weight:700}@media(max-width:980px){.vgl-nav-inner{padding:0 22px}.vgl-nav-logo{min-width:0}.vgl-nav-logo-text{font-size:15px}.vgl-nav-toggle{display:inline-flex}.vgl-nav-menu{display:none;position:absolute;left:0;right:0;top:88px;background:var(--bg);border-bottom:1px solid #dedbd4;padding:18px 22px 24px;flex-direction:column;align-items:stretch}.vgl-nav-menu.active{display:flex}.vgl-nav-links{flex-direction:column;align-items:flex-start;gap:18px}.vgl-nav-cta{align-self:flex-start}.hero--light{padding:34px 16px 42px}.dih-chat{margin-top:30px;padding:20px 14px;border-radius:18px}.dih-chat-form{grid-template-columns:1fr;gap:10px}.dih-chat-input,.dih-chat-send{height:60px;font-size:16px}.dih-chat-bubble{max-width:100%;font-size:15px}.dir-section{padding:42px 16px 64px}.dir-section-head h2{font-size:34px}.detail-grid{grid-template-columns:1fr}}@media(max-width:560px){.vgl-nav{height:74px}.vgl-nav-menu{top:74px}.vgl-nav-logo-mark{width:36px;height:36px;font-size:12px}.vgl-nav-logo-text{font-size:13px}.hero-name{font-size:50px}.hero-subtitle{font-size:18px}.dir-cat-grid,.provider-grid{grid-template-columns:1fr}.dir-cat-card{min-height:auto}.cat-desc{min-height:0}.shell{padding:0 16px 56px}}`;
}

function renderDihCss() {
  return `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#FAF9F5;color:#1a1a1a;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.55}a{color:inherit}img{max-width:100%}
.vgl-nav{position:sticky;top:0;z-index:50;background:rgba(250,249,245,.96);border-bottom:1px solid #e5e1d8;backdrop-filter:blur(12px)}
.vgl-nav-inner{height:74px;max-width:1180px;margin:0 auto;padding:0 28px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.vgl-nav-logo{display:flex;align-items:center;gap:12px;text-decoration:none;color:#0e0e0e}
.vgl-nav-logo-mark{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:1px solid #d9d4c6;background:#fff;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:15px}
.vgl-nav-logo-text{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:26px;line-height:1;color:hsl(143.04,66.14%,37.06%);white-space:nowrap}
.vgl-nav-logo-text em{font-weight:400;font-style:italic}
.vgl-nav-menu{display:flex;align-items:center;gap:28px}
.vgl-nav-links{display:flex;align-items:center;gap:30px;list-style:none;margin:0;padding:0}
.vgl-nav-links a{font-family:'Newsreader',Georgia,serif;text-decoration:none;color:#5e5a51;font-size:17px;font-weight:500}
.vgl-nav-links a:hover,.vgl-nav-links .nav-directory-link{color:#0e0e0e}
.vgl-nav-cta{display:inline-flex;align-items:center;justify-content:center;min-height:40px;border-radius:999px;background:#0e0e0e;color:#fff!important;text-decoration:none;font-family:'DM Sans',sans-serif;font-weight:600;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:0 20px}
.vgl-nav-cta:hover{background:#1f1f1d}
.vgl-nav-toggle{display:none;background:transparent;border:0;color:#0e0e0e;padding:8px;cursor:pointer}
@media(max-width:880px){.vgl-nav-inner{height:64px;padding:0 18px}.vgl-nav-toggle{display:inline-flex}.vgl-nav-menu{display:none;position:absolute;left:0;right:0;top:64px;background:#FAF9F5;border-bottom:1px solid #e5e1d8;padding:18px;flex-direction:column;align-items:flex-start;gap:16px}.vgl-nav-menu.active{display:flex}.vgl-nav-links{flex-direction:column;align-items:flex-start;gap:14px}}

.dih-hub { --teal:#00BFB2; --teal-dark:#00a89c; --black:#000000; --dark:#1a1a1a; --muted:#6b7280; --border:#e5e7eb; --card:#ffffff; --bg-soft:#f9fafb; --bg-cream:#fafaf7; color:var(--dark) !important; max-width:none; margin:0; padding:0; font-family:'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
.dih-hub *, .dih-hub *::before, .dih-hub *::after { box-sizing:border-box; }
.dih-hub h1, .dih-hub h2, .dih-hub h3, .dih-hub h4 { font-family:'Playfair Display', Georgia, serif; }
.dih-hub p { color:inherit; }
.dih-hub a { color:var(--teal) !important; }
.dih-hub a:hover { color:var(--teal-dark) !important; }
.dih-hub .hub-cat-card, .dih-hub .hub-result-card, .dih-hub .hub-suggest-card { color:var(--dark) !important; text-decoration:none !important; }
.dih-hub .hub-cat-card:hover, .dih-hub .hub-result-card:hover { color:var(--dark) !important; }
.dih-hub .hub-cat-name, .dih-hub .hub-result-name { color:var(--dark) !important; }
.dih-hub .hub-section-title { color:var(--dark) !important; }
.dih-hub .hub-hero { background:#FAF9F5; color:#1f1f1d; padding:7rem 2rem 5.5rem; margin:0; text-align:center; }
.dih-hub .hub-hero-inner { max-width:720px; margin:0 auto; }
.dih-hub .hub-eyebrow { font-family:'DM Sans',sans-serif; font-size:.7rem; font-weight:600; letter-spacing:.32em; text-transform:uppercase; color:#7a7569 !important; margin:0 0 2rem; }
.dih-hub .hub-title { font-family:'Playfair Display',Georgia,serif; font-size:clamp(3.5rem,8vw,5.5rem); font-weight:400; margin:0 0 1.5rem; letter-spacing:-.02em; line-height:1; color:#0e0e0e !important; }
.dih-hub .hub-title em { font-style:italic; font-weight:400; color:var(--teal) !important; }
.dih-hub .hub-title-dot { color:#0e0e0e; }
.dih-hub .hub-subtitle { font-size:1.08rem; color:#5e5a51; margin:0 auto 3.25rem; max-width:540px; line-height:1.55; font-weight:400; }
.dih-hub .hub-form { max-width:640px; margin:0 auto 1.75rem; display:flex; gap:.625rem; align-items:center; }
.dih-hub .hub-search-wrap { position:relative; flex:1; min-width:0; }
.dih-hub .hub-search { width:100%; padding:1.1rem 3rem 1.1rem 1.5rem; font-size:1rem; font-family:inherit; border:1px solid #d9d4c6; border-radius:999px; background:#fff; color:#1f1f1d; transition:border-color .2s, box-shadow .2s; outline:none; }
.dih-hub .hub-search::placeholder { color:#a39d8f; }
.dih-hub .hub-search:focus { border-color:#0e0e0e; box-shadow:0 0 0 3px rgba(14,14,14,.06); }
.dih-hub .hub-clear { position:absolute; top:50%; right:.875rem; transform:translateY(-50%); background:none; border:none; font-size:1.25rem; color:#a39d8f; cursor:pointer; padding:.25rem .4rem; line-height:1; }
.dih-hub .hub-clear:hover { color:#0e0e0e; }
.dih-hub .hub-ask { padding:1.1rem 1.75rem; font-size:.8rem; font-weight:600; font-family:inherit; letter-spacing:.12em; text-transform:uppercase; background:#0e0e0e; color:#fff !important; border:none; border-radius:999px; cursor:pointer; transition:background .15s; flex-shrink:0; }
.dih-hub .hub-ask:hover { background:#1f1f1d; }
@media (max-width:520px){ .dih-hub .hub-form { flex-direction:column; gap:.5rem; } .dih-hub .hub-ask { width:100%; } }
.dih-hub .hub-chips { font-size:.92rem; color:#7a7569; margin:0 auto 2.5rem; max-width:680px; line-height:1.8; }
.dih-hub .hub-chips-label { font-family:'DM Sans',sans-serif; font-size:.7rem; font-weight:600; letter-spacing:.18em; text-transform:uppercase; color:#a39d8f; margin-right:.875rem; }
.dih-hub .hub-chip { background:none; border:none; padding:0; font-family:'Playfair Display',Georgia,serif; font-style:italic; font-size:.95rem; color:#1f1f1d; cursor:pointer; transition:color .15s; border-bottom:1px solid transparent; padding-bottom:1px; }
.dih-hub .hub-chip:hover { color:var(--teal) !important; border-bottom-color:var(--teal); }
.dih-hub .hub-chip-sep { color:#c9c4b7; margin:0 .625rem; font-style:normal; }
.dih-hub .hub-disclosure { font-family:'DM Sans',sans-serif; font-size:.72rem; color:#a39d8f; margin:0; line-height:1.5; letter-spacing:.02em; }
.dih-hub .hub-disclosure strong { color:#7a7569; font-weight:600; }
.dih-hub .hub-disclosure a { color:#7a7569 !important; text-decoration:underline; text-underline-offset:2px; }
.dih-hub .hub-disclosure a:hover { color:var(--teal) !important; }
.dih-hub .hub-body { background:#FAF9F5; padding:5rem 2rem 6rem; border-top:1px solid #e5e1d8; }
.dih-hub .hub-body-inner { max-width:1180px; margin:0 auto; }
.dih-hub .hub-summary { margin-top:1.5rem; font-size:.9rem; color:var(--muted); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }
.dih-hub .hub-summary strong { color:var(--dark); font-weight:700; }
.dih-hub .hub-section { margin-bottom:4rem; }
.dih-hub .hub-section:last-child { margin-bottom:0; }
.dih-hub .hub-section-head { display:flex; align-items:baseline; gap:.875rem; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #e5e1d8; }
.dih-hub .hub-section-icon { font-size:1.1rem; line-height:1; opacity:.7; }
.dih-hub .hub-section-title { font-family:'DM Sans',sans-serif; font-size:.78rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:#0e0e0e; margin:0; }
.dih-hub .hub-section-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem; }
.dih-hub .hub-cat-card { display:block; padding:1.75rem 1.75rem 1.5rem; background:#fff; border:1px solid #e5e1d8; border-radius:8px; text-decoration:none !important; color:#0e0e0e !important; min-height:120px; transition:border-color .2s, transform .2s; }
.dih-hub .hub-cat-card:hover { border-color:var(--teal); transform:translateY(-2px); }
.dih-hub .hub-cat-card.is-empty { opacity:.5; }
.dih-hub .hub-cat-icon { font-size:1.65rem; line-height:1; margin-bottom:.9rem; }
.dih-hub .hub-cat-name { font-family:'Playfair Display',Georgia,serif; font-weight:600; font-size:1.2rem; margin:0 0 .625rem; color:#0e0e0e !important; line-height:1.25; letter-spacing:-.01em; }
.dih-hub .hub-cat-count { font-family:'DM Sans',sans-serif; font-size:.78rem; color:#7a7569; margin:0; font-weight:500; }
.dih-hub .hub-cat-count strong { color:var(--teal); font-weight:600; }
.dih-hub .hub-summary { font-family:'DM Sans',sans-serif; font-size:.78rem; font-weight:500; letter-spacing:.16em; text-transform:uppercase; color:#7a7569; margin-bottom:2rem; padding-bottom:1rem; border-bottom:1px solid #e5e1d8; }
.dih-hub .hub-summary strong { color:#0e0e0e; font-weight:600; }
.dih-hub .hub-results { display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:1.25rem; }
.dih-hub .hub-result-card { display:flex; flex-direction:column; padding:1.75rem 1.75rem 1.5rem; background:#fff; border:1px solid #e5e1d8; border-radius:8px; text-decoration:none !important; color:#0e0e0e !important; position:relative; min-height:180px; transition:border-color .2s, transform .2s; }
.dih-hub .hub-result-card:hover { border-color:var(--teal); transform:translateY(-2px); }
.dih-hub .hub-result-card.is-featured { border-left:2px solid var(--teal); }
.dih-hub .hub-badge { display:inline-block; font-family:'DM Sans',sans-serif; font-size:.68rem; font-weight:600; text-transform:uppercase; letter-spacing:.14em; padding:.3rem .65rem; margin-bottom:.875rem; align-self:flex-start; border-radius:4px; }
.dih-hub .hub-badge.featured { background:var(--teal); color:#fff; }
.dih-hub .hub-result-name { font-family:'Playfair Display',Georgia,serif; font-weight:600; font-size:1.25rem; margin:0 0 .4rem; line-height:1.25; color:#0e0e0e !important; letter-spacing:-.01em; }
.dih-hub .hub-result-meta { font-size:.9rem; color:#7a7569; margin:0 0 .5rem; line-height:1.45; }
.dih-hub .hub-result-rating { font-size:.85rem; color:#7a7569; margin-bottom:.4rem; }
.dih-hub .hub-result-rating strong { color:#0e0e0e; font-weight:600; }
.dih-hub .hub-result-cat { font-family:'DM Sans',sans-serif; font-size:.72rem; color:var(--teal); font-weight:600; text-transform:uppercase; letter-spacing:.14em; margin-top:auto; padding-top:1rem; }
.dih-hub .hub-loading { text-align:center; color:#a39d8f; padding:4rem 1rem; font-family:'DM Sans',sans-serif; font-size:.78rem; text-transform:uppercase; letter-spacing:.2em; font-weight:500; }
.dih-hub .hub-empty { grid-column:1/-1; text-align:center; padding:4rem 1rem; color:#7a7569; font-size:1rem; line-height:1.55; }
.dih-hub .hub-empty strong { color:#0e0e0e; display:block; margin-bottom:.75rem; font-family:'Playfair Display',Georgia,serif; font-size:1.5rem; font-weight:600; font-style:italic; }
.dih-hub .hub-suggestions { display:flex; justify-content:center; flex-wrap:wrap; gap:.5rem; margin-top:1.25rem; }
.dih-hub .hub-suggest-card { display:inline-block; padding:.5rem 1.125rem; background:transparent; border:1px solid #d9d4c6; border-radius:999px; text-decoration:none !important; color:#0e0e0e !important; font-size:.85rem; font-weight:500; transition:all .15s; }
.dih-hub .hub-suggest-card:hover { border-color:var(--teal); color:var(--teal) !important; }
@media (max-width:640px) {
  .dih-hub .hub-hero { padding:4rem 1.5rem 3.5rem; }
  .dih-hub .hub-body { padding:3rem 1.5rem 4rem; }
  .dih-hub .hub-form { flex-direction:column; }
  .dih-hub .hub-ask { width:100%; }
  .dih-hub .hub-section-grid, .dih-hub .hub-results { grid-template-columns:1fr; gap:1rem; }
  .dih-hub .hub-chips { font-size:.85rem; }
  .dih-hub .hub-chip-sep { margin:0 .4rem; }
}

.dih-hub .crumbs{font-family:'DM Sans',sans-serif;font-size:.78rem;color:#7a7569;margin-bottom:1.25rem;letter-spacing:.02em}
.dih-hub .crumbs a{color:#7a7569!important;text-decoration:none}
.dih-hub .crumbs a:hover{color:var(--teal)!important}
.dih-hub .hub-hero.is-page{padding:4.5rem 2rem 3rem;text-align:left}
.dih-hub .hub-hero.is-page .hub-hero-inner{max-width:1180px;margin:0 auto}
.dih-hub .hub-page-icon{font-size:2.4rem;line-height:1;margin:0 0 1rem}
.dih-hub .hub-hero.is-page .hub-title{font-size:clamp(2.5rem,6vw,4rem)}
.dih-hub .hub-hero.is-page .hub-subtitle{margin:1rem 0 0;max-width:680px}
.dih-hub .hub-result-rating span{color:#a39d8f}
.dih-hub .hub-badge.select{background:#0e0e0e;color:#fff}
.dih-hub .dih-detail{max-width:1180px;margin:0 auto;padding:3rem 2rem 5rem}
.dih-hub .dih-detail-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:2.5rem;align-items:start;margin-top:1.75rem}
.dih-hub .dih-detail h1{font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:clamp(2.2rem,5vw,3.2rem);line-height:1.06;margin:.4rem 0 .5rem;color:#0e0e0e;letter-spacing:-.01em}
.dih-hub .dih-detail-cat{font-family:'DM Sans',sans-serif;font-size:.72rem;color:var(--teal);font-weight:600;text-transform:uppercase;letter-spacing:.14em}
.dih-hub .dih-detail-rating{color:#5e5a51;font-size:.95rem;margin:.5rem 0 0}
.dih-hub .dih-detail-rating strong{color:#0e0e0e}
.dih-hub .dih-detail-about{font-size:1.05rem;color:#3a382f;line-height:1.7;margin:1.5rem 0 0}
.dih-hub .dih-detail-section{border-top:1px solid #e5e1d8;padding-top:1.5rem;margin-top:2rem}
.dih-hub .dih-detail-section h2{font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:1.5rem;margin:0 0 1rem;color:#0e0e0e}
.dih-hub .dih-tags{display:flex;flex-wrap:wrap;gap:.5rem;list-style:none;padding:0;margin:0}
.dih-hub .dih-tags li{background:#fff;border:1px solid #e5e1d8;border-radius:999px;padding:.4rem .8rem;font-size:.85rem;color:#5e5a51}
.dih-hub .dih-side{background:#fff;border:1px solid #e5e1d8;border-radius:8px;padding:1.5rem;position:sticky;top:96px}
.dih-hub .dih-side .row{padding:.8rem 0;border-bottom:1px solid #f0ede4}
.dih-hub .dih-side .row:last-of-type{border-bottom:0}
.dih-hub .dih-side .row span{display:block;font-family:'DM Mono',monospace;font-size:.62rem;text-transform:uppercase;letter-spacing:.12em;color:#a39d8f;margin-bottom:.3rem}
.dih-hub .dih-btn{display:inline-flex;align-items:center;justify-content:center;width:100%;margin-top:1rem;border-radius:999px;background:#0e0e0e;color:#fff!important;text-decoration:none;padding:.85rem 1rem;font-weight:600;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase}
.dih-hub .dih-btn:hover{background:#1f1f1d}
.dih-hub .dih-btn.secondary{background:#fff;color:#0e0e0e!important;border:1px solid #d9d4c6}
.dih-hub .dih-btn.secondary:hover{border-color:var(--teal)}
.dih-hub .dih-faq details{border-top:1px solid #e5e1d8;padding:1rem 0}
.dih-hub .dih-faq details:last-child{border-bottom:1px solid #e5e1d8}
.dih-hub .dih-faq summary{cursor:pointer;font-weight:600;font-family:'DM Sans',sans-serif;color:#0e0e0e}
.dih-hub .dih-faq p{color:#5e5a51;margin:.75rem 0 0}
@media(max-width:860px){.dih-hub .dih-detail-grid{grid-template-columns:1fr}.dih-hub .dih-side{position:static}}
`;
}

function renderDirectorySitemap() {
  const urls = [
    DIRECTORY_BASE,
    ...categories.map((cat) => `${DIRECTORY_BASE}/${cat.slug}`),
    ...providers.map(providerPath),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escXml(abs(url))}</loc><lastmod>${GENERATED_AT.slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>${url === DIRECTORY_BASE ? "0.9" : "0.8"}</priority></url>`).join("\n")}
</urlset>
`;
}

function renderSitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${escXml(abs("/sitemap-directory.xml"))}</loc><lastmod>${GENERATED_AT.slice(0, 10)}</lastmod></sitemap>
</sitemapindex>
`;
}

function renderLlmsTxt() {
  return `# Dialed In Health Directory

> Static, crawlable health and wellness provider directory generated from providers.json.

- Site: ${SITE_ORIGIN}
- Directory: ${abs(DIRECTORY_BASE)}
- Providers: ${providers.length}
- Categories: ${categories.length}
- Generated: ${GENERATED_AT}

The directory contains provider category pages and individual provider pages with LocalBusiness, BreadcrumbList, ItemList, and FAQPage structured data where applicable.
`;
}

function buildEnrichedProviders() {
  const out = { ...enrichedProviders };
  for (const provider of providers) {
    if (out[provider.slug]) continue;
    out[provider.slug] = {
      name: provider.name,
      slug: provider.slug,
      tier: publicTier(provider).toLowerCase(),
      category: provider.category_slug,
      categoryName: provider.master_category,
      location: {
        label: provider.market_label || provider.market || "",
        address: provider.address || "",
        serviceArea: provider.service_area || "",
      },
      google: {
        rating: provider.google_rating || null,
        reviewCount: provider.reviews || null,
      },
      practice: {
        description: provider.description || provider.subcategory || "",
        newPatients: true,
      },
      specialtyTags: provider.service_tags || [],
      url: abs(providerPath(provider)),
      website: provider.website || null,
    };
  }
  return out;
}

function buildRedirectMap() {
  const categoryBySlug = new Map(categories.map((cat) => [cat.slug, cat]));
  const exact = {
    "/the-directory": DIRECTORY_BASE,
    "/the-directory/": DIRECTORY_BASE,
    "/providers": DIRECTORY_BASE,
    "/providers/": DIRECTORY_BASE,
  };
  const categoriesOut = {};
  for (const category of categories) {
    categoriesOut[category.slug] = `${DIRECTORY_BASE}/${category.slug}`;
    exact[`/providers/${category.slug}`] = `${DIRECTORY_BASE}/${category.slug}`;
    exact[`/providers/${category.slug}/`] = `${DIRECTORY_BASE}/${category.slug}`;
  }
  for (const [oldSlug, newSlug] of Object.entries(OLD_CATEGORY_ALIASES)) {
    if (!categoryBySlug.has(newSlug)) continue;
    categoriesOut[oldSlug] = `${DIRECTORY_BASE}/${newSlug}`;
    exact[`/providers/${oldSlug}`] = `${DIRECTORY_BASE}/${newSlug}`;
    exact[`/providers/${oldSlug}/`] = `${DIRECTORY_BASE}/${newSlug}`;
  }

  const providersBySlug = {};
  const providerPaths = {};
  for (const provider of providers) {
    const target = providerPath(provider);
    providersBySlug[provider.slug] = target;
    if (provider.category_slug) {
      providerPaths[`/providers/${provider.category_slug}/${provider.slug}`] = target;
      providerPaths[`/providers/${provider.category_slug}/${provider.slug}/`] = target;
    }
  }

  return {
    generatedAt: GENERATED_AT,
    siteOrigin: SITE_ORIGIN,
    directoryBase: DIRECTORY_BASE,
    exact,
    categories: categoriesOut,
    providersBySlug,
    providerPaths,
    rules: [
      "/the-directory -> /directory",
      "/providers -> /directory",
      "/providers/:category -> /directory/:category, with legacy category aliases",
      "/providers/:category/:slug -> slug-resolved /directory/:current_category/:slug",
      "/providers/listing?slug=:slug -> slug-resolved /directory/:current_category/:slug",
    ],
  };
}

function webPageSchema(name, description, urlPath) {
  return { "@context": "https://schema.org", "@type": "WebPage", name, description, url: abs(urlPath) };
}

function localBusinessSchema(provider, urlPath) {
  const enriched = enrichedFor(provider);
  const category = categories.find((cat) => cat.slug === provider.category_slug) || {};
  const schema = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "MedicalBusiness"],
    name: provider.name,
    url: abs(urlPath),
    description: enrichedDescription(enriched) || provider.description || providerAbout(provider, category) || provider.subcategory || provider.master_category || undefined,
    telephone: provider.phone || undefined,
    sameAs: provider.website ? [normalizeWebsite(provider.website)] : undefined,
    areaServed: provider.service_area || provider.market || provider.market_label || undefined,
    medicalSpecialty: provider.master_category || undefined,
  };
  const address = parseAddress(provider.address);
  if (address) schema.address = address;
  if (provider.google_rating && provider.reviews) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: provider.google_rating,
      reviewCount: provider.reviews,
      bestRating: 5,
    };
  }
  return prune(schema);
}

function breadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, url], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: abs(url),
    })),
  };
}

function faqSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function categoryFaq(category) {
  return [
    {
      q: `How are ${category.name.toLowerCase()} providers organized?`,
      a: "Providers are grouped by their current Dialed In Health tier: Featured, Select, and Listed.",
    },
    {
      q: "Is this directory generated from live data?",
      a: "Yes. These static pages are generated from the Dialed In Health providers.json data feed.",
    },
  ];
}

function providerFaq(provider, category) {
  return [
    {
      q: `What category is ${provider.name} listed under?`,
      a: `${provider.name} is listed under ${category.name} in the Dialed In Health directory.`,
    },
    {
      q: `Where does ${provider.name} serve patients or clients?`,
      a: provider.service_area || provider.market_label || provider.market || "Contact the provider for current service area details.",
    },
    {
      q: `How can I contact ${provider.name}?`,
      a: provider.phone ? `Call ${provider.phone} or visit the provider website if one is listed.` : "Visit the provider website if one is listed, or use the Dialed In Health directory page for current details.",
    },
  ];
}

function providerAbout(provider, category) {
  const parts = [];
  const categoryDescription = category.description || `${category.name} providers support patients and clients across the region.`;
  parts.push(`${provider.name} is a ${category.name.toLowerCase()} provider in the Dialed In Health directory.`);
  if (provider.subcategory) {
    parts.push(`Their listing is tagged as ${provider.subcategory}.`);
  }
  if (provider.address) {
    parts.push(`The practice is located at ${provider.address}.`);
  } else if (locationLine(provider)) {
    parts.push(`They serve ${locationLine(provider)}.`);
  }
  if (ratingText(provider)) {
    parts.push(`The current directory data lists ${ratingText(provider)}.`);
  }
  parts.push(categoryDescription);
  return parts.join(" ");
}

function providerPath(provider) {
  return `${DIRECTORY_BASE}/${provider.category_slug || slugify(provider.master_category || "provider")}/${provider.slug}`;
}

function writeKey(key, content, contentType) {
  const file = keyToFile(key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  manifest.push({ key, file: path.relative(OUT_DIR, file), contentType, bytes: Buffer.byteLength(content) });
}

function keyToFile(key) {
  if (key === "enriched_providers") return path.join(OUT_DIR, "site", "_kv", "enriched_providers.json");
  if (key === "redirects") return path.join(OUT_DIR, "site", "_kv", "redirects.json");
  const clean = key.replace(/^\/+/, "");
  if (!clean) return path.join(OUT_DIR, "site", "index.html");
  if (path.extname(clean)) return path.join(OUT_DIR, "site", clean);
  return path.join(OUT_DIR, "site", clean, "index.html");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readOptionalJson(file) {
  if (!fs.existsSync(file)) return null;
  return readJson(file);
}

function enrichedFor(provider) {
  return enrichedProviders[provider.slug] || {};
}

function enrichedDescription(enriched) {
  return enriched && enriched.practice && typeof enriched.practice.description === "string"
    ? enriched.practice.description.trim()
    : "";
}

function enrichedList(enriched, key) {
  return Array.isArray(enriched && enriched[key])
    ? enriched[key].filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function mergeUnique(...lists) {
  const seen = new Set();
  const out = [];
  for (const item of lists.flat()) {
    const value = String(item || "").trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function normalizeBase(base) {
  const value = `/${String(base).replace(/^\/+|\/+$/g, "")}`;
  return value === "/" ? "" : value;
}

function abs(urlPath) {
  if (!urlPath) return SITE_ORIGIN;
  if (/^https?:\/\//i.test(urlPath)) return urlPath;
  return `${SITE_ORIGIN}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
}

function breadcrumbs(items) {
  return `<div class="breadcrumbs"><a href="/">Home</a>${items.map(([name, href]) => ` <span>/</span> <a href="${esc(href)}">${esc(name)}</a>`).join("")}</div>`;
}

function detailRow(label, value) {
  if (!value) return "";
  return `<div class="row"><span>${esc(label)}</span>${esc(value)}</div>`;
}

function ratingLine(provider) {
  const text = ratingText(provider);
  return text ? `<span class="rating">${esc(text)}</span>` : "";
}

function ratingText(provider) {
  if (!provider.google_rating) return "";
  return `${provider.google_rating} stars${provider.reviews ? ` (${provider.reviews} reviews)` : ""}`;
}

function publicTier(provider) {
  if (provider.is_featured || provider.tier === "Featured") return "Featured";
  if (provider.tier === "Select" || provider.tier === "Activated") return "Select";
  return "Listed";
}

function tierLabel(tier) {
  if (tier === "featured") return "Featured";
  if (tier === "select") return "Select";
  return "Listed";
}

function locationLine(provider) {
  return provider.market_label || provider.market || provider.service_area || "";
}

function normalizeWebsite(value) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function tel(value) {
  return String(value).replace(/[^+\d]/g, "");
}

function parseAddress(address) {
  if (!address) return null;
  const parts = String(address).split(",").map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const regionZip = last.match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/);
  return prune({
    "@type": "PostalAddress",
    streetAddress: parts.length >= 3 ? parts.slice(0, -2).join(", ") : undefined,
    addressLocality: parts.length >= 2 ? parts[parts.length - 2] : undefined,
    addressRegion: regionZip ? regionZip[1] : undefined,
    postalCode: regionZip ? regionZip[2] : undefined,
    addressCountry: "US",
  });
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleize(value) {
  return String(value || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function prune(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined || obj[key] === null || obj[key] === "") delete obj[key];
  }
  return obj;
}

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escXml(value) {
  return esc(value).replace(/'/g, "&apos;");
}
