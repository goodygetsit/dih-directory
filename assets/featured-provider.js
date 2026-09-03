
(function(){
  var P = window.DIH_PROVIDER;
  var root = document.getElementById("dih-fp-root");
  if (!P || !root) return;

  function esc(s){ if(s==null) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

  // Stars
  function renderStars(rating){
    if (!rating) return "";
    var n = Math.round(rating); var s = "";
    for (var i=0;i<n;i++) s += "&#9733;";
    for (var j=n;j<5;j++) s += "&#9734;";
    return s;
  }

  var H = '<div class="wrap">';

  // ============ Breadcrumb (sits on black, flows into hero) — Squarespace site nav lives above this ============
  H += '<div class="breadcrumb"><div class="breadcrumb-inner">';
  H += '<a href="/the-directory">The Directory</a> &rsaquo; ';
  H += '<a href="' + esc(P.master_category_url) + '">' + esc(P.category_name) + '</a> &rsaquo; ';
  H += '<strong>' + esc(P.name) + '</strong>';
  H += '</div></div>';

  // ============ Thick black hero ============
  H += '<section class="hero"><div class="hero-inner">';
  if (P.rating) {
    H += '<div class="hero-rating-block">';
    H += '<span class="hero-rating-num">' + P.rating + '</span>';
    H += '<span class="hero-rating-stars">' + renderStars(P.rating) + '</span>';
    H += '<span class="hero-rating-count">' + (P.reviews ? P.reviews + ' reviews' : 'Featured') + '</span>';
    H += '</div>';
  }
  H += '<div class="hero-content">';
  H += '<div class="hero-eyebrow">Featured Provider &middot; Dialed In Health Guest</div>';
  H += '<div class="badges">';
  H += '<span class="badge-featured">&#9733; Featured Provider</span>';
  H += '<span class="badge-guest">Dialed In Health Guest</span>';
  H += '</div>';
  H += '<h1 class="provider-name">' + esc(P.name) + '</h1>';
  if (P.tagline) H += '<p class="tagline">' + esc(P.tagline) + '</p>';
  if (P.practitioner && P.practitioner.name) {
    H += '<div class="practitioner-row">' + esc(P.practitioner.name) + (P.practitioner.credential ? " &middot; " + esc(P.practitioner.credential) : "") + '</div>';
  }
  if (P.city) H += '<div class="location-row"><span class="pin">&#128205;</span> ' + esc(P.city) + '</div>';
  if (P.tags && P.tags.length) {
    H += '<div class="tags-row">' + P.tags.map(function(t){ return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>';
  }
  if (P.contact && (P.contact.booking_url || P.contact.quiz_url || P.contact.phone)) {
    H += '<div class="hero-cta-row">';
    if (P.contact.booking_url) H += '<a class="btn btn-teal" href="' + esc(P.contact.booking_url) + '" target="_blank" rel="noopener nofollow sponsored" data-dih-event="booking_click">Book an Appointment</a>';
    if (P.contact.quiz_url) H += '<a class="btn btn-ghost" href="' + esc(P.contact.quiz_url) + '" target="_blank" rel="noopener nofollow sponsored" data-dih-event="quiz_click">Take the Quiz</a>';
    if (!P.contact.booking_url && P.contact.phone) H += '<a class="btn btn-teal" href="tel:' + esc(P.contact.phone.replace(/[^0-9+]/g,"")) + '" data-dih-event="phone_tap">Call ' + esc(P.contact.phone) + '</a>';
    H += '</div>';
  }
  H += '</div></div></section>';

  // ============ Two-column layout starts ============
  H += '<div class="layout"><div class="main">';

  // ---------- About ----------
  if (P.about && P.about.length) {
    H += '<section class="block"><h2>About</h2>';
    H += P.about.map(function(p){ return '<p>' + esc(p) + '</p>'; }).join("");
    if (P.team_photo) {
      H += '<figure class="about-team-photo"><img src="' + esc(P.team_photo) + '" alt="' + esc(P.team_photo_alt || (P.name + ' team')) + '" loading="lazy"></figure>';
    }
    H += '</section>';
  }

  // ---------- Three Promises ----------
  if (P.three_promises && P.three_promises.length) {
    H += '<section class="block"><h2>Three Promises to Every Patient</h2>';
    H += '<div class="promises-grid">';
    P.three_promises.forEach(function(p){
      H += '<div class="promise-card"><h4>' + esc(p.title) + '</h4><p>' + esc(p.body) + '</p></div>';
    });
    H += '</div></section>';
  }

  // ---------- Services ----------
  if (P.services && P.services.length) {
    H += '<section class="block"><h2>Services Offered</h2>';
    var isRich = typeof P.services[0] === "object";
    if (isRich) {
      H += '<div class="services-rich">';
      P.services.forEach(function(s){
        H += '<div class="service-rich"><h3>' + esc(s.title) + '</h3>';
        if (s.description) H += '<p>' + esc(s.description) + '</p>';
        H += '</div>';
      });
      H += '</div>';
    } else {
      H += '<div class="services-pill-grid">';
      P.services.forEach(function(s){ H += '<div class="service-pill">' + esc(s) + '</div>'; });
      H += '</div>';
    }
    H += '</section>';
  }

  // ---------- Symptoms ----------
  if (P.symptoms && P.symptoms.length) {
    H += '<section class="block"><h2>Symptoms We Help With</h2>';
    H += '<p class="lede">If you have been told your labs are normal but you do not feel normal, this is the kind of work we do. Most patients arrive with one or more of the following.</p>';
    H += '<div class="chip-list">' + P.symptoms.map(function(s){ return '<span class="chip">' + esc(s) + '</span>'; }).join("") + '</div>';
    H += '</section>';
  }

  // ---------- Conditions ----------
  if (P.conditions_treated && P.conditions_treated.length) {
    H += '<section class="block"><h2>Conditions We Actively Treat</h2>';
    H += '<div class="chip-list">' + P.conditions_treated.map(function(c){ return '<span class="chip">' + esc(c) + '</span>'; }).join("") + '</div>';
    H += '</section>';
  }

  // ---------- Team ----------
  if (P.team_members && P.team_members.length) {
    H += '<section class="block"><h2>Meet the Team</h2><div class="team-grid">';
    P.team_members.forEach(function(m){
      H += '<div class="team-member">';
      if (m.photo) H += '<div class="team-photo-wrap"><img class="team-photo" src="' + esc(m.photo) + '" alt="' + esc(m.name) + '" loading="lazy"></div>';
      H += '<div class="team-meta"><h3>' + esc(m.name) + '</h3>';
      if (m.credentials) H += '<p class="credentials">' + esc(m.credentials) + '</p>';
      if (m.role) H += '<p class="role">' + esc(m.role) + '</p>';
      if (m.bio) H += '<p class="bio">' + esc(m.bio) + '</p>';
      H += '</div></div>';
    });
    H += '</div>';
    if (P.team_extras) H += '<div class="team-extras">' + esc(P.team_extras) + '</div>';
    H += '</section>';
  }

  // ---------- Service Details / Clinic Details ----------
  if (P.service_details) {
    var d = P.service_details;
    H += '<section class="block"><h2>Clinic Details</h2><div class="details-card"><div class="details-grid">';
    if (d.location) H += '<div class="detail-item"><label>Address</label><p>' + esc(d.location) + '</p></div>';
    if (d.focus_areas) H += '<div class="detail-item"><label>Focus Areas</label><p>' + esc(d.focus_areas) + '</p></div>';
    if (d.specialties) H += '<div class="detail-item"><label>Specialties</label><p>' + esc(d.specialties) + '</p></div>';
    if (d.approach) H += '<div class="detail-item"><label>Approach</label><p>' + esc(d.approach) + '</p></div>';
    if (d.founded) H += '<div class="detail-item"><label>Founded</label><p>' + esc(d.founded) + '</p></div>';
    if (d.payment) H += '<div class="detail-item"><label>Payment</label><p>' + esc(d.payment) + '</p></div>';
    if (d.virtual) H += '<div class="detail-item"><label>Virtual Services</label><p>' + esc(d.virtual) + '</p></div>';
    if (d.languages) H += '<div class="detail-item"><label>Languages</label><p>' + esc(d.languages) + '</p></div>';
    if (d.accepting_new) H += '<div class="detail-item"><label>New Patients</label><p>' + esc(d.accepting_new) + '</p></div>';
    H += '</div></div></section>';
  }

  // ---------- Videos (skip first — it goes in sidebar as the lead episode) ----------
  if (P.videos && P.videos.length > 1) {
    var mainVideos = P.videos.slice(1);
    H += '<section class="block"><h2>More Videos</h2><div class="videos-list">';
    mainVideos.forEach(function(v){
      var thumb = "https://img.youtube.com/vi/" + esc(v.youtube_id) + "/maxresdefault.jpg";
      H += '<div class="video-item">';
      H += '<a class="video-thumb" href="' + esc(v.watch_url) + '" target="_blank" rel="noopener" data-dih-event="video_click" data-dih-video="' + esc(v.youtube_id) + '"><img src="' + thumb + '" alt="' + esc(v.title) + '" loading="lazy"></a>';
      H += '<div class="video-meta">';
      if (v.badge) H += '<div class="badge-line">' + esc(v.badge) + '</div>';
      H += '<h3 data-video-yt="' + esc(v.youtube_id || '') + '">' + esc(v.title) + '</h3>';
      if (v.description) H += '<p>' + esc(v.description) + '</p>';
      H += '<div class="video-links">';
      if (v.watch_url) H += '<a href="' + esc(v.watch_url) + '" target="_blank" rel="noopener">&#9654; Watch Episode</a>';
      if (v.episode_url) H += '<a href="' + esc(v.episode_url) + '">Read Full Episode Page &rsaquo;</a>';
      H += '</div>';
      // Episode chapters (optional, per-video)
      if (v.chapters && v.chapters.length) {
        H += '<div class="chapters"><details><summary>Episode Chapters (' + v.chapters.length + ' segments)</summary><div class="chapter-list">';
        v.chapters.forEach(function(c){ H += '<div class="chapter-row"><span class="chapter-time">' + esc(c.time) + '</span><span class="chapter-title">' + esc(c.title) + '</span></div>'; });
        H += '</div></details></div>';
      }
      H += '</div></div>';
    });
    H += '</div></section>';
  }

  // ---------- Events / Special Promotions ----------
  if (P.events && P.events.length) {
    H += '<section class="block"><div class="events-section">';
    if (P.events_title) H += '<h3>' + esc(P.events_title) + '</h3>';
    if (P.events_intro) H += '<p class="intro">' + esc(P.events_intro) + '</p>';
    H += '<div class="event-list">';
    P.events.forEach(function(e){
      H += '<div class="event-item">';
      H += '<div class="city">' + esc(e.city) + '</div>';
      H += '<div class="when">' + esc(e.when) + '</div>';
      if (e.where) H += '<div class="where">' + esc(e.where) + '</div>';
      H += '</div>';
    });
    H += '</div></div></section>';
  }

  // ---------- Articles ----------
  if (P.articles && P.articles.length) {
    H += '<section class="block"><h2>Articles</h2>';

    H += '<div class="articles-list">';
    P.articles.forEach(function(a){
      H += '<a class="article-card" href="' + esc(a.url) + '" target="_blank" rel="noopener" data-dih-event="article_click">';
      if (a.image_url) H += '<img src="' + esc(a.image_url) + '" alt="' + esc(a.title) + '" loading="lazy">';
      H += '<div class="body">';
      H += '<h4>' + esc(a.title) + '</h4>';
      if (a.summary) H += '<p class="summary">' + esc(a.summary) + '</p>';
      if (a.published_date) H += '<div class="date">' + esc(a.published_date) + '</div>';
      H += '</div></a>';
    });
    H += '</div>';
    H += '</section>';
  }

  // ---------- Get Started CTA ----------
  if (P.contact && (P.contact.booking_url || P.contact.phone || P.contact.email)) {
    H += '<section class="block"><div class="get-started">';
    H += '<h3>Get Started</h3>';
    H += '<p>Schedule a discovery call or book your first consult with ' + esc(P.name) + '.</p>';
    H += '<div class="cta-row">';
    if (P.contact.booking_url) H += '<a class="btn btn-teal" href="' + esc(P.contact.booking_url) + '" target="_blank" rel="noopener nofollow sponsored" data-dih-event="booking_click">Book Now &rsaquo;</a>';
    if (P.contact.phone) H += '<a class="btn btn-ghost" href="tel:' + esc(P.contact.phone.replace(/[^0-9+]/g,"")) + '" data-dih-event="phone_tap">Call ' + esc(P.contact.phone) + '</a>';
    if (P.contact.email) H += '<a class="btn btn-ghost" href="mailto:' + esc(P.contact.email) + '" data-dih-event="email_click">Email the Clinic</a>';
    H += '</div></div></section>';
  }

  // ---------- FAQ ----------
  if (P.faqs && P.faqs.length) {
    H += '<section class="block"><h2>Frequently Asked Questions</h2><div class="faqs">';
    P.faqs.forEach(function(f){
      H += '<div class="faq-item"><div class="faq-q">' + esc(f.question) + '</div><div class="faq-a">' + esc(f.answer) + '</div></div>';
    });
    H += '</div></section>';
  }

  // ---------- Related on Dialed In Health ----------
  if (P.related_on_dih && P.related_on_dih.length) {
    H += '<section class="block"><h2>Related on Dialed In Health</h2><div class="related-grid">';
    P.related_on_dih.forEach(function(r){
      H += '<a class="related-card" href="' + esc(r.url) + '">';
      if (r.kicker) H += '<div class="kicker">' + esc(r.kicker) + '</div>';
      H += '<h4>' + esc(r.title) + '</h4>';
      if (r.description) H += '<p>' + esc(r.description) + '</p>';
      H += '</a>';
    });
    H += '</div></section>';
  }

  H += '</div>'; // /main

  // ============ Sidebar ============
  H += '<aside class="sidebar">';

  // Quick Reference
  if (P.contact) {
    var c = P.contact;
    H += '<div class="sb-card"><h3>Quick Reference</h3>';
    if (c.phone) H += '<div class="field"><label>Phone</label><a href="tel:' + esc(c.phone.replace(/[^0-9+]/g,"")) + '" data-dih-event="phone_tap">' + esc(c.phone) + '</a></div>';
    if (c.email) H += '<div class="field"><label>Email</label><a href="mailto:' + esc(c.email) + '" data-dih-event="email_click">' + esc(c.email) + '</a></div>';
    if (c.address) H += '<div class="field"><label>Address</label>' + esc(c.address) + '</div>';
    if (c.website) H += '<div class="field"><label>Website</label><a href="' + esc(c.website) + '" target="_blank" rel="noopener nofollow sponsored" data-dih-event="website_click">' + esc(c.website.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,"")) + '</a></div>';
    if (c.hours) H += '<div class="field"><label>Hours</label>' + esc(c.hours) + '</div>';
    if (c.new_patients) H += '<div class="field"><label>New Patients</label>' + esc(c.new_patients) + '</div>';
    if (P.service_area && P.service_area !== c.address) H += '<div class="field"><label>Markets</label>' + esc(P.service_area) + '</div>';
    H += '</div>';
  }

  // As Heard On — rich card with YouTube thumbnail (uses first video, or P.as_heard_on override)
  var leadEp = P.as_heard_on || (P.videos && P.videos[0]);
  if (leadEp && leadEp.youtube_id) {
    var thumbUrl = "https://img.youtube.com/vi/" + esc(leadEp.youtube_id) + "/hqdefault.jpg";
    var watch = leadEp.watch_url || ("https://www.youtube.com/watch?v=" + leadEp.youtube_id);
    H += '<div class="sb-episode">';
    H += '<a class="thumb" href="' + esc(watch) + '" target="_blank" rel="noopener" data-dih-event="video_click" data-dih-video="' + esc(leadEp.youtube_id) + '"><img src="' + thumbUrl + '" alt="' + esc(leadEp.title || 'Episode') + '" loading="lazy"></a>';
    H += '<div class="body">';
    if (leadEp.badge) H += '<div class="badge-line">' + esc(leadEp.badge) + '</div>';
    H += '<h4 data-video-yt="' + esc(leadEp.youtube_id) + '">' + esc(leadEp.title || '') + '</h4>';
    if (leadEp.description) H += '<p class="desc">' + esc(leadEp.description) + '</p>';
    H += '<a class="btn btn-teal btn-block" href="' + esc(watch) + '" target="_blank" rel="noopener" data-dih-event="video_click">&#9654; Watch the Episode</a>';
    if (leadEp.episode_url) H += '<a class="btn btn-ghost btn-block" href="' + esc(leadEp.episode_url) + '" style="margin-top:8px;">Episode Page &rsaquo;</a>';
    H += '</div></div>';
  }

  // Newsletter
  H += '<div class="sb-card newsletter-card"><h3>Free Newsletter</h3>';
  H += '<p class="small">New episodes, provider spotlights, and Featured Provider quarterly features. ' + esc(P.name) + ' is in the rotation.</p>';
  H += '<a class="btn btn-dark btn-block" href="https://dialedinhealth.kit.com/bc70e0bc47" target="_blank" rel="noopener" data-dih-event="newsletter_click">Subscribe Free</a>';
  H += '</div>';


  // Report
  H += '<div class="sb-card"><h3>See something wrong?</h3>';
  H += '<p class="small">Let us know if any information here is incorrect or outdated.</p>';
  H += '<a class="btn btn-ghost btn-block" href="https://tally.so/r/ODL60M" target="_blank" rel="noopener" data-dih-event="report_click">Report Incorrect Info</a>';
  H += '</div>';

  H += '</aside>';
  H += '</div>'; // /layout

  // ============ Other Featured Providers (full-width below grid) ============
  H += '<section class="block" style="margin-top:32px;"><h2>Other Featured Providers</h2>';
  H += '<p class="cross-promo-intro">Featured health and wellness companies on Dialed In Health.</p>';
  H += '<div class="cross-promo-grid" id="dih-cp-grid" data-current-provider-slug="' + esc(P.slug) + '"><div style="padding:24px;color:#6b7280;">Loading featured providers&hellip;</div></div>';
  H += '</section>';

  // ============ Want Featured CTA ============
  H += '<section class="block"><div class="featured-cta">';
  H += '<h3>Want your business featured on Dialed In Health?</h3>';
  H += '<p>Featured Providers get a custom listing page, podcast episode, and quarterly newsletter rotation.</p>';
  H += '<a class="btn btn-dark" href="https://www.dialedin.health/be-a-guest" data-dih-event="apply_featured_click">Apply for Featured &rsaquo;</a>';
  H += '</div></section>';

  H += '</div>'; // /wrap

  root.innerHTML = H;

  // FAQ accordion
  root.querySelectorAll(".faq-item").forEach(function(item){
    item.querySelector(".faq-q").addEventListener("click", function(){ item.classList.toggle("open"); });
  });

  // Set page title
  document.title = P.name + " | " + P.category_name + " | Dialed In Health";

  // ============ Cross-promo loader ============
  // Honors manual P.cross_promo_pool (array of slugs) if provided.
  // Otherwise auto-picks 3 Featured providers from different master_categories.
  var cpGrid = document.getElementById("dih-cp-grid");
  if (cpGrid) {
    (window.DIH_CP_POOL ? Promise.resolve({ providers: window.DIH_CP_POOL }) : fetch("https://cdn.jsdelivr.net/gh/goodygetsit/dih-directory@main/providers.json", { cache: "no-store" }).then(function(r){ return r.json(); }))
      .then(function(data){
        var providers = data.providers || [];
        var picks = [];
        if (P.cross_promo_pool && P.cross_promo_pool.length) {
          // Manual pool — preserve order, drop unknowns
          P.cross_promo_pool.forEach(function(slug){
            var hit = providers.filter(function(p){ return p.slug === slug; })[0];
            if (hit) picks.push(hit);
          });
        } else {
          // Auto-pick: Featured only, different master_category, by review score
          var others = providers.filter(function(x){
            if (x.slug === P.slug) return false;
            if (x.master_category === P.category_name) return false;
            return x.is_featured;
          });
          function reviewScore(p){ var r=p.google_rating||0, n=p.reviews||0; return r * Math.log10(n+1); }
          others.sort(function(a,b){ return reviewScore(b) - reviewScore(a); });
          picks = others;
        }
        picks = picks.slice(0, 3);
        if (!picks.length) { cpGrid.innerHTML = '<p style="color:#6b7280;">No featured providers available.</p>'; return; }
        var H2 = '';
        picks.forEach(function(x){
          var url = x.profile_url || ('/providers/listing?slug=' + x.slug);
          H2 += '<a class="cp-card featured" href="' + esc(url) + '">';
          H2 += '<div class="specialty">' + esc(x.master_category || '') + ' &middot; ' + esc(x.market_label || x.market || '') + '</div>';
          H2 += '<h4>' + esc(x.name) + '</h4>';
          if (x.subcategory) H2 += '<p class="practitioner">' + esc(x.subcategory) + '</p>';
          H2 += '<span class="badge-mini">&#9733; Featured Provider</span>';
          H2 += '</a>';
        });
        cpGrid.innerHTML = H2;
      })
      .catch(function(){ cpGrid.innerHTML = '<p style="color:#6b7280;">Could not load featured providers right now.</p>'; });
  }

  // ============ Pull YouTube titles via oEmbed ============
  // Replaces video heading text with the actual YouTube title.
  // Manual title is shown immediately, then upgraded to the YouTube title once oEmbed responds.
  document.querySelectorAll("[data-video-yt]").forEach(function(el){
    var ytId = el.getAttribute("data-video-yt");
    if (!ytId) return;
    fetch("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=" + encodeURIComponent(ytId) + "&format=json")
      .then(function(r){ if (r.ok) return r.json(); throw new Error("oEmbed " + r.status); })
      .then(function(data){ if (data && data.title) el.textContent = data.title; })
      .catch(function(){ /* keep manual title as fallback */ });
  });

  // ============ JSON-LD Schema ============
  var schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["MedicalBusiness","LocalBusiness"],
        "@id": "https://www.dialedin.health/providers/" + P.category_slug + "/" + P.slug + "#business",
        "name": P.name,
        "url": "https://www.dialedin.health/providers/" + P.category_slug + "/" + P.slug,
        "telephone": (P.contact && P.contact.phone) || undefined,
        "email": (P.contact && P.contact.email) || undefined,
        "address": (P.contact && P.contact.address) ? { "@type":"PostalAddress", "streetAddress": P.contact.address, "addressLocality": (P.city||"").split(",")[0].trim(), "addressRegion": "SD", "addressCountry": "US" } : undefined,
        "medicalSpecialty": P.tags && P.tags.length ? P.tags : P.category_name,
        "aggregateRating": P.rating ? { "@type":"AggregateRating", "ratingValue": P.rating, "reviewCount": P.reviews || 0 } : undefined,
        "openingHours": (P.contact && P.contact.hours) || undefined,
        "areaServed": P.service_area || P.city,
        "speakable": { "@type":"SpeakableSpecification", "cssSelector":[".provider-name",".tagline",".practitioner-row",".location-row"] }
      },
      {
        "@type": "FAQPage",
        "@id": "https://www.dialedin.health/providers/" + P.category_slug + "/" + P.slug + "#faq",
        "mainEntity": (P.faqs||[]).map(function(f){ return { "@type":"Question", "name": f.question, "acceptedAnswer": { "@type":"Answer", "text": f.answer } }; })
      },
      {
        "@type": "BreadcrumbList",
        "@id": "https://www.dialedin.health/providers/" + P.category_slug + "/" + P.slug + "#breadcrumb",
        "itemListElement": [
          { "@type":"ListItem", "position":1, "name":"Home", "item":"https://www.dialedin.health/" },
          { "@type":"ListItem", "position":2, "name":"The Directory", "item":"https://www.dialedin.health/the-directory" },
          { "@type":"ListItem", "position":3, "name": P.category_name, "item":"https://www.dialedin.health" + P.master_category_url },
          { "@type":"ListItem", "position":4, "name": P.name, "item":"https://www.dialedin.health/providers/" + P.category_slug + "/" + P.slug }
        ]
      }
    ]
  };
  (P.videos||[]).forEach(function(v){
    if (!v.youtube_id) return;
    schema["@graph"].push({
      "@type":"VideoObject",
      "name": v.title,
      "description": v.description || v.title,
      "thumbnailUrl": ["https://img.youtube.com/vi/" + v.youtube_id + "/maxresdefault.jpg"],
      "uploadDate": "2026-01-01",
      "contentUrl": v.watch_url,
      "embedUrl": "https://www.youtube.com/embed/" + v.youtube_id
    });
  });
  function clean(obj){ if(Array.isArray(obj)) return obj.map(clean); if(obj && typeof obj==="object"){ var o={}; for(var k in obj){ if(obj[k]!==undefined){ o[k]=clean(obj[k]); }} return o; } return obj; }
  var schemaScript = document.createElement("script");
  schemaScript.type = "application/ld+json";
  schemaScript.textContent = JSON.stringify(clean(schema));
  document.head.appendChild(schemaScript);

  // ============ Analytics ============
  document.addEventListener("click", function(e){
    var el = e.target.closest("[data-dih-event]");
    if (!el) return;
    var evt = el.getAttribute("data-dih-event");
    var payload = { event: "dih_" + evt, provider_slug: P.slug, provider_name: P.name, master_category: P.category_name, tier: "Featured" };
    if (el.getAttribute("data-dih-video")) payload.video_id = el.getAttribute("data-dih-video");
    if (window.dataLayer) window.dataLayer.push(payload);
    if (window.gtag) window.gtag("event", "dih_" + evt, payload);
  });
  if (window.dataLayer) window.dataLayer.push({ event: "dih_provider_view", provider_slug: P.slug, provider_name: P.name, master_category: P.category_name, tier: "Featured" });
})();
