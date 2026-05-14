/*
 * DIH Directory Loader — script
 * Hosted at: https://cdn.jsdelivr.net/gh/goodygetsit/dih-directory@main/loader.js
 *
 * Renders the category directory and emits ItemList + BreadcrumbList JSON-LD
 * so AI engines understand the page as a structured collection of providers.
 *
 * Update workflow:
 * 1. Edit in /Users/melissagoodwin/Documents/Claude/Projects/Vitality Growth/directory-2026-05-09/directory-loader/squarespace/loader-v2/
 * 2. Copy to /Users/melissagoodwin/Documents/GitHub/dih-directory/loader.js
 * 3. git commit && git push
 * 4. Purge jsDelivr cache (or wait ~12h)
 */
(function () {
  "use strict";

  // === Configuration ===
  var DATA_URL = "https://cdn.jsdelivr.net/gh/goodygetsit/dih-directory@main/providers.json";
  var FEATURED_PAGE_BASE = "/providers";
  var LISTING_PAGE_BASE  = "/listing";
  var SITE_ORIGIN = "https://www.dialedin.health";
  var MARKET_CHIPS = ["All Locations", "Sioux Falls", "Minneapolis", "Omaha", "Virtual"];

  // Map category_slug on each page to its friendly /providers/[slug] URL used for Featured page links.
  var CATEGORY_URL_OVERRIDE = {
    "animal-health-wellness": "animal-health",
    "dental-oral-health": "dental",
    "digital-health-telehealth": "telehealth",
    "energy-medicine-alternative-healing": "energy-medicine",
    "fitness-movement-studios": "fitness-movement",
    "functional-integrative-naturopathic-medicine": "functional-medicine",
    "home-community-health": "home-health-caregiving",
    "massage-bodywork": "massage",
    "medical-aesthetics-skin": "medical-aesthetics",
    "mental-behavioral-health": "mental-health",
    "mind-body-wellness-lifestyle": "mind-body",
    "nutrition-weight-metabolic-health": "nutrition",
    "performance-optimization-biohacking": "performance-biohacking",
    "pharmacy-compounding": "pharmacy",
    "physical-rehabilitation-movement": "physical-therapy",
    "physical-therapy-rehabilitation": "physical-therapy",
    "spas-beauty-wellness": "spas",
    "spiritual-health-sacred-wellness": "spiritual-wellness"
  };

  // === State ===
  var container = document.querySelector(".dih-directory");
  if (!container) return;
  var config = {
    categorySlug: container.dataset.categorySlug || "",
    blogCategory: container.dataset.blogCategory || "",
    title: container.dataset.title || "Directory",
    subtitle: container.dataset.subtitle || ""
  };
  var state = { market: "All Locations", data: null };

  // === Fetch ===
  // NOTE: removed `cache: "no-store"` so the browser respects jsDelivr's
  // 7-day max-age caching. Visitors browsing multiple categories now get
  // instant subsequent loads instead of a 280ms re-fetch each time.
  fetch(DATA_URL)
    .then(function (r) {
      if (!r.ok) throw new Error("Fetch failed: " + r.status);
      return r.json();
    })
    .then(function (json) {
      state.data = json;
      render();
    })
    .catch(function (err) {
      container.innerHTML = '<div class="dih-error">Unable to load directory data. ' + err.message + '</div>';
    });

  // === Helpers ===
  function categoryUrlSlug(slug) {
    return CATEGORY_URL_OVERRIDE[slug] || slug;
  }
  function featuredUrl(p) {
    // If we have a full profile_url, use it directly (handles both absolute and relative)
    if (p.profile_url) {
      // Strip site origin so relative URLs stay relative (better for Squarespace's <a> handling)
      if (p.profile_url.indexOf(SITE_ORIGIN) === 0) return p.profile_url.substring(SITE_ORIGIN.length);
      if (p.profile_url.indexOf("/providers/") === 0) return p.profile_url;
      if (p.profile_url.indexOf("http") === 0) return p.profile_url;
    }
    // Fall back to category-scoped slug pattern
    return FEATURED_PAGE_BASE + "/" + (CATEGORY_URL_OVERRIDE[p.category_slug] || p.category_slug) + "/" + p.slug;
  }

  function cardHref(p) {
    // Featured tier: link to the dedicated /providers/[category]/[slug] profile page
    if (p.is_featured) return featuredUrl(p);
    // Activated/Listed tier: link to the provider's own website if we have one
    if (p.website) return p.website;
    // Last resort: anchor within the same category page
    if (p.profile_url) {
      if (p.profile_url.indexOf(SITE_ORIGIN) === 0) return p.profile_url.substring(SITE_ORIGIN.length);
      return p.profile_url;
    }
    return "#";
  }

  function cardTarget(p) {
    // Open external websites in a new tab; keep DIH-internal links in same tab
    if (p.is_featured) return "";
    if (p.website) return ' target="_blank" rel="noopener noreferrer"';
    return "";
  }
  function matchesCategory(p) {
    if (config.categorySlug && p.category_slug === config.categorySlug) return true;
    if (config.blogCategory && p.blog_category === config.blogCategory) return true;
    return false;
  }
  function matchesMarket(p) {
    if (state.market === "All Locations") return true;
    if (p.market_label === state.market) return true;
    if (p.additional_market_labels && p.additional_market_labels.indexOf(state.market) !== -1) return true;
    return false;
  }
  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function absoluteUrl(href) {
    if (!href) return null;
    if (href.indexOf("http") === 0) return href;
    return SITE_ORIGIN + (href.charAt(0) === "/" ? href : "/" + href);
  }
  function providerCanonicalUrl(p) {
    return absoluteUrl(featuredUrl(p));
  }

  // === Schema injection ===
  // Inject ItemList and BreadcrumbList JSON-LD into <head> so AI engines and
  // search crawlers understand the structure of this page beyond visible cards.
  function injectSchema(visibleProviders) {
    // Remove any previously-injected blocks (re-runs on market filter change)
    document.querySelectorAll('script[data-dih-schema]').forEach(function (el) { el.remove(); });

    var categoryName = config.title || "Directory";
    var pageUrl = window.location.origin + window.location.pathname;

    // BreadcrumbList: Home -> Directory -> [Category]
    var breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_ORIGIN + "/" },
        { "@type": "ListItem", "position": 2, "name": "Directory", "item": SITE_ORIGIN + "/the-directory" },
        { "@type": "ListItem", "position": 3, "name": categoryName, "item": pageUrl }
      ]
    };

    // ItemList of providers shown on this page
    var itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": categoryName + " Providers",
      "description": config.subtitle || (categoryName + " providers listed in the Dialed In Health directory."),
      "itemListOrder": "https://schema.org/ItemListOrderAscending",
      "numberOfItems": visibleProviders.length,
      "itemListElement": visibleProviders.map(function (p, idx) {
        var url = providerCanonicalUrl(p);
        var item = {
          "@type": p.master_category && p.master_category.toLowerCase().indexOf("medical") > -1
            ? "MedicalBusiness"
            : "LocalBusiness",
          "name": p.name,
          "url": url
        };
        if (p.address && p.address !== p.market_label) {
          item.address = {
            "@type": "PostalAddress",
            "streetAddress": p.address,
            "addressLocality": p.market_label || undefined,
            "addressRegion": p.market === "Sioux Falls, SD" ? "SD"
              : p.market === "Omaha, NE" ? "NE"
              : (p.market || "").indexOf("MN") > -1 ? "MN"
              : undefined,
            "addressCountry": "US"
          };
        }
        if (p.phone) item.telephone = p.phone;
        if (p.website) item.sameAs = [p.website];
        if (p.google_rating && p.reviews) {
          item.aggregateRating = {
            "@type": "AggregateRating",
            "ratingValue": p.google_rating,
            "reviewCount": p.reviews,
            "bestRating": 5
          };
        }
        return {
          "@type": "ListItem",
          "position": idx + 1,
          "item": item
        };
      })
    };

    var s1 = document.createElement("script");
    s1.type = "application/ld+json";
    s1.setAttribute("data-dih-schema", "breadcrumb");
    s1.textContent = JSON.stringify(breadcrumb);
    document.head.appendChild(s1);

    var s2 = document.createElement("script");
    s2.type = "application/ld+json";
    s2.setAttribute("data-dih-schema", "itemlist");
    s2.textContent = JSON.stringify(itemList);
    document.head.appendChild(s2);
  }

  // === Render ===
  function render() {
    var all = state.data.providers.filter(matchesCategory);
    var featured  = all.filter(function (p) { return p.is_featured && matchesMarket(p); });
    var activated = all.filter(function (p) { return p.tier === "Activated" && matchesMarket(p); });
    var listed    = all.filter(function (p) { return p.tier === "Listed" && matchesMarket(p); });

    // Upgrade pool
    var upgrade = [];
    var poolCats = (state.data.upgrade_pool_map || {})[resolveMasterCategoryForSlug(config.categorySlug)] || [];
    poolCats.forEach(function (catName) {
      state.data.providers.forEach(function (p) {
        if (p.master_category === catName && p.is_featured && matchesMarket(p)) {
          if (upgrade.indexOf(p) === -1 && featured.indexOf(p) === -1) upgrade.push(p);
        }
      });
    });

    var visibleProviders = featured.concat(activated).concat(listed);

    var html = '';
    html += '<h2 class="dih-page-title">' + escapeHtml(config.title) + '</h2>';
    if (config.subtitle) html += '<p class="dih-subtitle">' + escapeHtml(config.subtitle) + '</p>';

    html += '<div class="dih-filters">';
    MARKET_CHIPS.forEach(function (m) {
      html += '<button class="dih-chip' + (m === state.market ? ' is-active' : '') + '" data-market="' + escapeHtml(m) + '">' + escapeHtml(m) + '</button>';
    });
    html += '</div>';

    if (featured.length) {
      html += '<div class="dih-section-title">Top Provider<span class="dih-count">' + featured.length + '</span></div>';
      html += '<div class="dih-grid">';
      featured.forEach(function (p) { html += renderCard(p, 'featured'); });
      html += '</div>';
    }

    var standardTotal = activated.length + listed.length;
    if (standardTotal) {
      html += '<div class="dih-section-title">All Providers<span class="dih-count">' + standardTotal + '</span></div>';
      html += '<div class="dih-grid">';
      activated.forEach(function (p) { html += renderCard(p, 'activated'); });
      listed.forEach(function (p) { html += renderCard(p, 'listed'); });
      html += '</div>';
    } else if (!featured.length) {
      html += '<div class="dih-grid"><div class="dih-empty">No providers match your filters. Try "All Locations".</div></div>';
    }

    if (upgrade.length) {
      html += '<div class="dih-section-title">Related Top Providers<span class="dih-count">' + upgrade.length + '</span></div>';
      html += '<div class="dih-grid">';
      upgrade.forEach(function (p) { html += renderCard(p, 'featured', true); });
      html += '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll(".dih-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.market = btn.dataset.market;
        render();
      });
    });

    // Emit schema for the currently visible providers
    injectSchema(visibleProviders);
  }

  function renderCard(p, tierClass, isUpgrade) {
    var href = cardHref(p);
    var target = cardTarget(p);
    var cls = 'dih-card is-' + tierClass;
    var html = '<a class="' + cls + '" href="' + escapeHtml(href) + '"' + target + '>';
    if (p.is_featured) {
      html += '<span class="dih-badge">★ Top Provider</span>';
    } else if (p.tier === "Activated") {
      html += '<span class="dih-badge" style="background:#1a1a1a;color:#00bfb2;">Activated</span>';
    }
    html += '<h3 class="dih-name">' + escapeHtml(p.name) + '</h3>';
    if (p.subcategory) html += '<p class="dih-sub">' + escapeHtml(p.subcategory) + '</p>';
    if (p.market_label) html += '<p class="dih-meta"><strong>Location:</strong> ' + escapeHtml(p.market_label) + '</p>';
    if (p.google_rating) {
      var stars = '★'.repeat(Math.round(p.google_rating));
      html += '<p class="dih-meta"><span class="dih-rating">' + stars + '</span> ' + p.google_rating + '</p>';
    }
    html += '<div class="dih-card-footer">';
    html += p.is_featured ? '<span class="dih-link">View Featured Profile →</span>' : '<span class="dih-link">View Listing →</span>';
    html += '</div></a>';
    return html;
  }

  function resolveMasterCategoryForSlug(slug) {
    if (!state.data || !state.data.taxonomy) return null;
    var match = (state.data.taxonomy.master_categories || []).find(function (c) { return c.slug === slug; });
    return match ? match.name : null;
  }
})();
