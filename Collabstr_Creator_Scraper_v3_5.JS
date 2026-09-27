/**
 * ============================================================
 *  COLLABSTR CREATOR SCRAPER  v3.3  — DOM-Verified Build
 * ============================================================
 *  Paste into Chrome DevTools Console on any Collabstr listing page.
 *
 *  ALL selectors verified by live console inspection. Zero guesswork.
 *
 *  CONFIRMED CARD STRUCTURE:
 *    .profile-listing-holder              ← one creator card
 *      :scope > a[href]                   ← profile link
 *      .profile-listing-img-holder        ← name, rating, badges
 *        .profile-listing-badge-title     ← badge text (Top Creator, UGC…)
 *      .profile-listing-info-row
 *        h3.profile-listing-title         ← category/niche (truncated)
 *        .profile-listing-price           ← price ($247)
 *      .profile-listing-category          ← location ("Los Angeles, CA, US")
 *
 *  CONFIRMED PROFILE PAGE STRUCTURE:
 *    .profile-platform-badge              ← one platform block
 *      img.profile-listing-platform-img   ← platform (src = instagram.svg etc)
 *      .profile-listing-followers         ← follower count ("12.7k")
 *
 *  v3.3 CHANGES vs v3.2:
 *  [V1]  getCards() — replaces DOM-walk algo with direct
 *        document.querySelectorAll('.profile-listing-holder')
 *  [V2]  parseCard() — direct CSS selectors for ALL confirmed fields.
 *        innerText parsing ONLY on .profile-listing-img-holder (name/
 *        rating/followers) — never on full card, avoiding false positives.
 *  [V3]  extractPlatformFollowers() — uses confirmed DOM classes:
 *        .profile-platform-badge → img.profile-listing-platform-img src
 *        → .profile-listing-followers text
 *  [V4]  scrollAndLoadCards() — polls .profile-listing-holder count
 *  [V5]  FOLLOWERS regex — K/M/B or 5+ digits required (no "5.0" match)
 *  [V6]  Location regex — handles 2-part "City, CC" AND 3-part "City,ST,CC"
 *  [V7]  RESERVED extended: tracking, campaigns, content, library, etc.
 *  [V8]  Platforms: detected from img src inside card (.profile-listing-img-holder)
 *  [V9]  Followers fallback: if card empty → fill from profile page platform count
 *  [V10] Platforms fallback: if card empty → fill from profile social links
 *  [V11] Twitter: 'intent','share' in ignore list → no share-button URLs
 *  [V12] XLSX: 28 columns (original 24 + Instagram/TikTok/YouTube/Twitter Followers)
 * ============================================================
 */

(async () => {

  // ============================================================
  //  CONFIGURATION
  // ============================================================
  const CFG = {
    LIMIT        : 40,      // creators to process (matches Collabstr page count)
    BATCH_SIZE   : 5,
    BATCH_DELAY  : 250,
    FETCH_TIMEOUT: 12000,
    MAX_RETRIES  : 2,
    RETRY_DELAY  : 600,
    AUTO_SCROLL  : true,
    SCROLL_WAIT  : 1800,
    MAX_SCROLLS  : 50,
    DEBUG        : false,

    // [V7] Extended RESERVED — all nav/utility paths
    RESERVED: new Set([
      'home','library','influencers','campaigns','tracking',
      'blog','pricing','about','contact','help','terms','privacy',
      'signin','signup','login','register','marketplace','brand',
      'creator','search','explore','discover','categories',
      'how-it-works','cookie-policy','advertise','collaborate',
      'press','jobs','careers','affiliate','media-kit',
      'brands','creators','reviews','brands-home','start','get-started',
      'faq','notifications','messages','settings','favorites',
      'bookmarks','dashboard','account','billing','orders','portfolio',
      'profile','saved','following','followers','inbox','feed',
      'content','ugc','all','for-brands','for-creators',
      'explore-creators','trending','featured','top-creators','new',
      'shop','store','tools','resources','webinars','podcast','newsletter',
      'top-influencers','instagram-fake-follower-checker',
      'tiktok-fake-follower-checker','influencer-price-calculator',
    ]),

    MKTG_SIGNALS: [
      'collabstr','influencer platform','marketplace',
      'vetted influencer','search creators','hire influencer',
      '#1 marketplace','250,000','find creators','brand deals',
      'collabstr.com','vetted creators','ugc creator platform',
    ],

    IG_IGNORE: new Set([
      'collabstr','share','p','reel','reels','explore','accounts',
      'stories','tv','igtv','tags','locations','graphql','web',
      'embed','direct','developer','about','legal','help','channels',
    ]),

    TT_IGNORE: [
      'collabstr','collabstr.com','/embed','/tag/','/music/','/discover',
      '/trending','/effects','/login','/signup','/foryou','/following',
      '/live','/search','/t/','/channel/','/business',
    ],

    // [V11] 'intent' + 'share' block Twitter share-button URLs
    TWITTER_IGNORE: ['collabstr','usecollabstr','collabstr_com','intent','share'],

    LINK_AGGREGATORS: [
      'linktr.ee','linktree.com','beacons.ai','beacons.page',
      'later.com/pages','allmylinks.com','lnk.bio','campsite.bio',
      'bio.site','taplink.cc','solo.to','carrd.co','stan.store',
    ],

    SOCIAL_DOMAINS: [
      'instagram.com','tiktok.com','youtube.com','twitter.com','x.com',
      'facebook.com','pinterest.com','linkedin.com','twitch.tv','snapchat.com',
      'collabstr.com',
    ],

    AMAZON_PATTERN: /amazon\.[a-z]{2,3}(?:\.[a-z]{2})?\/(shop|storefront)/i,

    XLSX_CDNS: [
      'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      'https://unpkg.com/xlsx/dist/xlsx.full.min.js',
    ],
  };

  // ============================================================
  //  UTILITIES
  // ============================================================
  const sleep   = ms  => new Promise(r => setTimeout(r, ms));
  const getText = el  => el ? (el.innerText || el.textContent || '').trim().replace(/\s+/g,' ') : '';
  const isMarketing = t => CFG.MKTG_SIGNALS.some(k => t.toLowerCase().includes(k));
  const dbg = (...a) => { if (CFG.DEBUG) console.log('[DBG]', ...a); };

  const profileCache = new Map();
  const seenURLs     = new Set();

  // ============================================================
  //  PROGRESS UI
  // ============================================================
  function createProgressUI() {
    document.getElementById('cstrscraper')?.remove();
    const box = document.createElement('div');
    box.id = 'cstrscraper';
    Object.assign(box.style, {
      position:'fixed', bottom:'20px', right:'20px', zIndex:'2147483647',
      background:'#0f172a', color:'#e2e8f0', padding:'16px 20px',
      borderRadius:'12px', fontFamily:'monospace', fontSize:'12px',
      width:'340px', boxShadow:'0 8px 32px rgba(0,0,0,.7)',
      border:'1px solid #334155', lineHeight:'1.7',
    });
    box.innerHTML = `
      <div id="cs-title" style="font-size:14px;font-weight:bold;color:#38bdf8;margin-bottom:8px">🚀 Collabstr Scraper v3.5</div>
      <div id="cs-status">Initializing...</div>
      <div id="cs-detail" style="color:#94a3b8;font-size:11px;min-height:16px;word-break:break-all"></div>
      <div style="background:#1e293b;border-radius:4px;height:5px;margin-top:10px;overflow:hidden">
        <div id="cs-bar" style="background:#38bdf8;height:100%;width:0;transition:width .3s;border-radius:4px"></div>
      </div>
      <button onclick="document.getElementById('cstrscraper').remove()"
        style="position:absolute;top:12px;right:12px;background:none;border:none;color:#64748b;cursor:pointer;font-size:14px">✕</button>
      <div id="cs-multi" style="margin-top:10px;display:none">
        <div id="cs-multi-info" style="color:#fbbf24;font-size:11px;margin-bottom:6px"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button id="cs-btn-all"
            onclick="window.downloadAllCollabstr && window.downloadAllCollabstr()"
            style="background:#0ea5e9;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace">📦 Download ALL</button>
          <button id="cs-btn-clear"
            onclick="if(confirm('Clear all accumulated data?')){window.clearCollabstrData&&window.clearCollabstrData();document.getElementById('cs-multi').style.display='none';}"
            style="background:#475569;color:#fff;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;font-family:monospace">🗑 Clear All</button>
        </div>
      </div>`;
    document.body.appendChild(box);
    const $ = id => document.getElementById(id);
    return {
      status  : t  => { if ($('cs-status')) $('cs-status').textContent = t; console.log(t); },
      detail  : t  => { if ($('cs-detail')) $('cs-detail').textContent = t; },
      progress: (n,t) => {
        const pct = t>0 ? Math.round(n/t*100) : 0;
        if ($('cs-bar'))    $('cs-bar').style.width = pct+'%';
        if ($('cs-detail')) $('cs-detail').textContent = `${n}/${t} (${pct}%)`;
      },
      done: (multiInfo) => {
        if ($('cs-title'))  $('cs-title').style.color  = '#4ade80';
        if ($('cs-status')) $('cs-status').textContent = '✅ Done! Page file downloaded.';
        if ($('cs-bar'))    Object.assign($('cs-bar').style,{background:'#4ade80',width:'100%'});
        if (multiInfo && $('cs-multi')) {
          $('cs-multi-info').textContent = `📦 Accumulated: ${multiInfo.total} creators total (+${multiInfo.added} this page)`;
          $('cs-multi').style.display = 'block';
        }
        setTimeout(() => { if (!$('cs-multi') || $('cs-multi').style.display==='none') $('cstrscraper')?.remove(); }, 9000);
      },
      fail: msg => {
        if ($('cs-title'))  $('cs-title').style.color  = '#f87171';
        if ($('cs-status')) $('cs-status').textContent = '❌ '+msg;
      },
    };
  }
  const UI = createProgressUI();

  // ============================================================
  //  SHEETJS LOADER
  // ============================================================
  async function loadSheetJS() {
    if (window.XLSX) return;
    UI.status('📦 Loading SheetJS...');
    for (const cdn of CFG.XLSX_CDNS) {
      try {
        await new Promise((res,rej) => {
          const s = document.createElement('script');
          s.src = cdn; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
        if (window.XLSX) { UI.detail(`SheetJS loaded.`); return; }
      } catch { console.warn('CDN failed:', cdn); }
    }
    throw new Error('All SheetJS CDNs failed');
  }

  // ============================================================
  //  RESUME SYSTEM
  // ============================================================
  const RESUME_KEY = 'cstrscraper_v33';
  const saveSession  = d  => { try { localStorage.setItem(RESUME_KEY, JSON.stringify({ts:Date.now(),...d})); } catch {} };
  const loadSession  = () => { try { const s=JSON.parse(localStorage.getItem(RESUME_KEY)||'null'); if(!s||Date.now()-s.ts>86400000){localStorage.removeItem(RESUME_KEY);return null;} return s; } catch{return null;} };
  const clearSession = () => localStorage.removeItem(RESUME_KEY);

  // ============================================================
  //  MULTI-PAGE ACCUMULATOR
  // ============================================================
  const MULTI_KEY = 'cstrscraper_multipage_v35';
  const loadAccumulated  = () => { try { return JSON.parse(localStorage.getItem(MULTI_KEY)||'[]'); } catch { return []; } };
  const saveAccumulated  = arr => { try { localStorage.setItem(MULTI_KEY, JSON.stringify(arr)); } catch {} };
  const clearAccumulated = ()  => localStorage.removeItem(MULTI_KEY);

  function appendToAccumulated(creators, profileData) {
    const existing = loadAccumulated();
    const existingURLs = new Set(existing.map(r => r.creator.profileURL));
    let added = 0;
    creators.forEach((c, i) => {
      if (!existingURLs.has(c.profileURL)) {
        existing.push({ creator: c, profile: profileData[i] || {} });
        added++;
      }
    });
    saveAccumulated(existing);
    return { total: existing.length, added };
  }

  function exportAllAccumulated() {
    const rows = loadAccumulated();
    if (!rows.length) { alert('No accumulated data found. Run the scraper on at least one page first.'); return; }
    const allCreators   = rows.map(r => r.creator);
    const allProfiles   = rows.map(r => r.profile);
    exportExcel(allCreators, allProfiles, `collabstr_ALL_${allCreators.length}_creators_${new Date().toISOString().slice(0,10)}.xlsx`);
    console.log(`📦 Exported ALL ${allCreators.length} accumulated creators.`);
  }

  // Attach global helper so user can trigger from console anytime
  window.downloadAllCollabstr = () => { loadSheetJS().then(exportAllAccumulated); };
  window.clearCollabstrData   = () => { clearAccumulated(); console.log('🗑 Accumulated data cleared.'); };

  // ============================================================
  //  JSON-LD + OpenGraph
  // ============================================================
  function extractJSONLD(doc) {
    const r = { name:'', bio:'', email:'', url:'', sameAs:[] };
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        for (const item of [].concat(JSON.parse(s.textContent.trim()))) {
          const types = [].concat(item['@type']||[]);
          if (!types.some(t=>['Person','ProfilePage','Organization','WebPage','WebSite'].includes(t))) continue;
          r.name  = r.name  || item.name        || '';
          r.bio   = r.bio   || item.description || '';
          r.email = r.email || item.email       || '';
          if (item.url && !item.url.includes('collabstr.com')) r.url = r.url || item.url;
          r.sameAs.push(...[].concat(item.sameAs||[]).filter(Boolean));
          if (item.mainEntity) {
            r.name = r.name || item.mainEntity.name || '';
            r.bio  = r.bio  || item.mainEntity.description || '';
            r.sameAs.push(...[].concat(item.mainEntity.sameAs||[]).filter(Boolean));
          }
        }
      } catch {}
    });
    r.sameAs = [...new Set(r.sameAs)];
    return r;
  }

  function extractOpenGraph(doc) {
    const og = {};
    doc.querySelectorAll('meta[property^="og:"],meta[name^="og:"]').forEach(m => {
      const k = (m.getAttribute('property')||m.getAttribute('name')||'').replace(/^og:/,'');
      if (k) og[k] = m.getAttribute('content')||'';
    });
    return og;
  }

  // ============================================================
  //  [V1] CARD DETECTION — direct selector, no DOM-walk
  // ============================================================
  function getCards() {
    return Array.from(document.querySelectorAll('.profile-listing-holder'));
  }

  // ============================================================
  //  [V4] SCROLL — polls .profile-listing-holder count
  // ============================================================
  async function scrollAndLoadCards(targetCount) {
    if (!CFG.AUTO_SCROLL) return getCards();
    UI.status('📜 Scrolling to load all cards...');
    let prevCount = -1, stale = 0;
    for (let i = 0; i < CFG.MAX_SCROLLS; i++) {
      const n = document.querySelectorAll('.profile-listing-holder').length;
      UI.detail(`Scroll ${i+1}: ${n} cards loaded`);
      if (n >= targetCount) break;
      if (n === prevCount) { if (++stale >= 4) break; } else stale = 0;
      prevCount = n;
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      await sleep(CFG.SCROLL_WAIT);
    }
    const cards = getCards();
    console.log(`✅ ${cards.length} .profile-listing-holder elements found`);
    return cards;
  }

  // ============================================================
  //  [V2] parseCard() — confirmed CSS selectors + targeted text parse
  //
  //  CONFIRMED via live DOM inspection:
  //    :scope > a[href]              → profile link
  //    .profile-listing-badge-title  → badge text
  //    h3.profile-listing-title      → category (niche)
  //    .profile-listing-price        → price
  //    .profile-listing-category     → location
  //    .profile-listing-img-holder   → innerText has: name, rating, followers
  // ============================================================

  // [V5] Followers: K/M/B numbers (12.7k), 5+ digits (10000+),
  //         ranges (1k-10k, 0-1k), OR plain 2-4 digit integers (40, 367, 999)
  //         "5.0" = has decimal → caught by RATING_RX first, never reaches here
  //         "5"   = 1 digit only → excluded by {2,4} minimum
  //  [V10] Added 0-Xk range: first number may have no K/M/B suffix (e.g. "0-1k")
  const FOLLOWER_RX = /^\d[\d,.]*\s*[KkMmBb]\+?$|^\d{5,}\+?$|^\d[\d.]*[KkMmBb]?-\d[\d.]*[KkMmBb]$|^\d{2,4}$/;
  const RATING_RX   = /^[0-4]\.[0-9]$|^5\.0$/;
  const BADGE_RX    = /^(Top Creator|UGC|Verified|Pro|New Creator|Featured|Exclusive|Responds Fast)$/i;

  // [V6] Location: handles "City, CC" (2-part) AND "City, ST, CC" (3-part)
  const LOCATION_RX = /^[A-Za-z][A-Za-z\s.',-]+,\s*[A-Z]{2,3}(?:,\s*[A-Z]{2,3})?$/;

  function parseCard(card) {
    // ── Profile URL ──
    const linkEl = card.querySelector(':scope > a[href]');
    let profileURL = '';
    if (linkEl) {
      const href = linkEl.getAttribute('href') || '';
      const seg  = href.slice(1).split('/')[0].toLowerCase();
      if (!CFG.RESERVED.has(seg) && href.startsWith('/')) {
        // Build full URL — avoid new URL() issues with null/undefined origin
        profileURL = href.startsWith('http') ? href : (location.origin + href);
      }
    }

    // ── Confirmed CSS selectors ──
    const badges = Array.from(card.querySelectorAll('.profile-listing-badge-title'))
      .map(el => el.textContent.trim()).filter(Boolean).join(', ');

    const category = getText(card.querySelector('h3.profile-listing-title, .profile-listing-title'));
    const price    = getText(card.querySelector('.profile-listing-price'));
    const creatorLocation = getText(card.querySelector('.profile-listing-category'));

    // ── [V8] Platforms from img src inside card ──
    const PLAT_MAP = {
      instagram : 'Instagram',
      tiktok    : 'TikTok',
      youtube   : 'YouTube',
      twitter   : 'Twitter',
      pinterest : 'Pinterest',
      twitch    : 'Twitch',
      facebook  : 'Facebook',
      snapchat  : 'Snapchat',
    };
    const platforms = [...new Set(
      Array.from(card.querySelectorAll('img[src], img[alt]')).flatMap(img => {
        const src = (img.getAttribute('src') || '').toLowerCase();
        const alt = (img.getAttribute('alt') || '').toLowerCase();
        return Object.entries(PLAT_MAP)
          .filter(([k]) => src.includes(k) || alt.includes(k))
          .map(([,v]) => v);
      })
    )].join(', ');

    // ── Name + Rating + Followers — from .profile-listing-img-holder only ──
    const imgHolder  = card.querySelector('.profile-listing-img-holder');
    const holderText = imgHolder ? (imgHolder.innerText || imgHolder.textContent || '') : '';
    const holderLines = holderText.split('\n').map(s => s.trim()).filter(Boolean);

    let name = '', rating = '', followers = '';
    for (const line of holderLines) {
      if (BADGE_RX.test(line)) continue;                          // skip badge words
      if (!rating    && RATING_RX.test(line))   { rating = line; continue; }
      if (!followers && FOLLOWER_RX.test(line.replace(/,/g,''))) { followers = line; continue; }
      // Name: short, no digits at start, no $ or special
      if (!name && line.length >= 2 && line.length <= 50 &&
          !/^\d/.test(line) && !/^\$/.test(line) && !/^[★⭐]/.test(line)) {
        name = line;
      }
    }

    dbg('Card:', { name, followers, rating, price, location: creatorLocation, platforms, category, badges, profileURL });

    return { name, followers, rating, price, location: creatorLocation, platforms, category, badges, profileURL };
  }

  // ============================================================
  //  FETCH + RETRY + CACHE
  // ============================================================
  async function fetchProfileHTML(url) {
    if (profileCache.has(url)) return profileCache.get(url);
    let lastErr;
    for (let attempt = 0; attempt <= CFG.MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(CFG.RETRY_DELAY * attempt);
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), CFG.FETCH_TIMEOUT);
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { Accept: 'text/html,application/xhtml+xml' },
          redirect: 'follow',
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        profileCache.set(url, html);
        return html;
      } catch (err) {
        clearTimeout(timer);
        lastErr = err;
        console.warn(`  ⚠️ Attempt ${attempt+1}: ${err.name==='AbortError'?'timeout':err.message}`);
      }
    }
    console.warn(`  ❌ Failed: ${url}`);
    return null;
  }

  // ============================================================
  //  SOCIAL LINK EXTRACTION
  // ============================================================
  const isIgnoredIG = url => {
    const path = url.replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').split('/')[0].split('?')[0].toLowerCase();
    return !path || CFG.IG_IGNORE.has(path);
  };
  const isIgnoredTT = url => CFG.TT_IGNORE.some(p => url.toLowerCase().includes(p));
  const isIgnoredTW = url => {
    const seg = url.replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i,'')
                   .split('/')[0].replace('@','').split('?')[0].toLowerCase();
    return CFG.TWITTER_IGNORE.includes(seg);
  };

  function findURL(domain, html, doc, sameAs, ignoreFn=()=>false) {
    const fromLD = (sameAs||[]).find(u => u.toLowerCase().includes(domain) && !ignoreFn(u));
    if (fromLD) return fromLD.split('?')[0].replace(/\/$/,'');
    const el = Array.from(doc.querySelectorAll('a[href]')).find(a => {
      const h = (a.getAttribute('href')||'').toLowerCase();
      return h.includes(domain) && !ignoreFn(a.href||'');
    });
    if (el) return (el.href||el.getAttribute('href')||'').split('?')[0].replace(/\/$/,'');
    const esc = domain.replace(/\./g,'\\.');
    const rx  = new RegExp(`(?:["'\\s(>]|^)https?://(?:www\\.)?${esc}[^"'<>\\s)\\\\]+`, 'gim');
    const hits = (html.match(rx)||[]).map(m=>m.replace(/^["'\s(>]/,'').split(/["'<>\s)]/)[0].replace(/\/$/,''));
    return hits.find(u => !ignoreFn(u)) || '';
  }

  function extractSocialLinks(html, doc, jsonld) {
    const sa    = jsonld.sameAs || [];
    const igURL = findURL('instagram.com', html, doc, sa, isIgnoredIG);
    const ttURL = findURL('tiktok.com',    html, doc, sa, isIgnoredTT);
    const ytURL = findURL('youtube.com',   html, doc, sa, u => /collabstr/i.test(u));
    const twURL = findURL('twitter.com',   html, doc, sa, isIgnoredTW) ||
                  findURL('x.com',         html, doc, sa, isIgnoredTW);

    const igUser = igURL ? igURL.replace(/^https?:\/\/(www\.)?instagram\.com\//i,'').replace(/[/?#].*/,'') : '';
    const ttUser = ttURL ? ttURL.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i,'').replace(/[/?#].*/,'')  : '';
    const ytUser = ytURL ? ytURL.replace(/^https?:\/\/(www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)?/i,'').replace(/[/?#].*/,'') : '';

    const amEl  = Array.from(doc.querySelectorAll('a[href]')).find(a => CFG.AMAZON_PATTERN.test(a.href||''));
    const amURL = amEl ? (amEl.href||'').split('?')[0] : ((html.match(/https?:\/\/(?:www\.)?amazon\.[a-z]{2,3}(?:\.[a-z]{2})?\/(shop|storefront)\/[^"'<>\s]+/i)||[])[0]||'');

    const ltEl  = Array.from(doc.querySelectorAll('a[href]')).find(a => {
      try { return CFG.LINK_AGGREGATORS.some(d => new URL(a.href).hostname.includes(d)); } catch { return false; }
    });

    const wsEl  = Array.from(doc.querySelectorAll('a[href]')).find(a => {
      try {
        const u = new URL(a.href);
        return u.protocol.startsWith('http') &&
               u.hostname !== location.hostname &&
               !CFG.SOCIAL_DOMAINS.some(d => u.hostname.includes(d)) &&
               !CFG.LINK_AGGREGATORS.some(d => u.hostname.includes(d)) &&
               !u.hostname.includes('amazon.');
      } catch { return false; }
    });

    const OTHER = ['pinterest.com','linkedin.com','facebook.com','twitch.tv','snapchat.com'];
    const otherLinks = [...new Set(
      Array.from(doc.querySelectorAll('a[href]'))
        .filter(a => OTHER.some(d => (a.href||'').includes(d)))
        .map(a => a.href)
    )].join(' | ');

    return {
      instagramURL: igURL, instagramUsername: igUser,
      tiktokURL: ttURL,    tiktokUsername: ttUser,
      youtubeURL: ytURL,   youtubeUsername: ytUser,
      twitterURL: twURL,
      amazonStorefront: amURL,
      linktreeURL:  ltEl ? ltEl.href : '',
      websiteURL:   wsEl ? wsEl.href : jsonld.url || '',
      otherLinks,
    };
  }

  // ============================================================
  //  [V3] PER-PLATFORM FOLLOWER EXTRACTION — CORRECT selectors
  //
  //  CONFIRMED via live console inspection:
  //  .profile-platform-badge  = LISTING PACKAGES (all show instagram img)
  //                             ← WRONG, do NOT use
  //
  //  .platform-img-holder-creator  = ACTUAL social platform section ✓
  //    .platform-img               = one platform block
  //      img                       = platform icon (src = "instagram.svg" etc)
  //      text node                 = "12.7k Followers" / "3.49K Followers"
  // ============================================================
  function extractPlatformFollowers(doc) {
    const result = {
      instagramFollowers: '', tiktokFollowers: '',
      youtubeFollowers: '',   twitterFollowers: '',
    };

    // Strategy A: .platform-img-holder-creator — the REAL platform section
    const platHolder = doc.querySelector('.platform-img-holder-creator');
    if (platHolder) {
      platHolder.querySelectorAll('.platform-img').forEach(div => {
        const img  = div.querySelector('img');
        if (!img) return;
        const src  = (img.getAttribute('src') || '').toLowerCase();
        const alt  = (img.getAttribute('alt') || '').toLowerCase();
        // textContent = just text nodes (img alt NOT included in textContent)
        // Handles both: "12.7k Followers" and "49 Followers" (plain integer)
        const text = div.textContent.replace(/\s+/g,' ').trim();
        // [V10] Match range first (e.g. "0-1k"), then K/M/B, then plain int
        const m    = text.match(/(\d[\d.]*[KkMmBb]?-\d[\d.]*[KkMmBb]|\d[\d,.]*\.?\d*\s*[KkMmBb]\+?|\b\d{1,6}\b)/i);
        if (!m) return;
        const cnt = m[0].replace(/\s/g,'');
        if (!cnt) return;  // skip truly empty; allow "0-1k" ranges
        if ((src.includes('instagram') || alt.includes('instagram')) && !result.instagramFollowers)
          result.instagramFollowers = cnt;
        else if ((src.includes('tiktok') || alt.includes('tiktok')) && !result.tiktokFollowers)
          result.tiktokFollowers = cnt;
        else if ((src.includes('youtube') || alt.includes('youtube')) && !result.youtubeFollowers)
          result.youtubeFollowers = cnt;
        else if ((src.includes('twitter') || alt.includes('twitter') ||
                  src.includes('/x.svg') || alt.includes(' x ') || alt === 'x') &&
                 !result.twitterFollowers)
          result.twitterFollowers = cnt;
      });
    }

    // Strategy B: fallback — scan any element with class containing 'follower'
    // handles "49 Followers" badge on profile hero section
    if (!result.instagramFollowers) {
      const heroFol = doc.querySelector('[class*="follower" i]:not([class*="fake" i]):not([class*="footer" i])');
      if (heroFol) {
        const t = heroFol.textContent.trim();
        const m = t.match(/(\d[\d,.]*\.?\d*\s*[KkMmBb]\+?|\b\d{1,6}\b)/);
        if (m && m[0] !== '0') result.instagramFollowers = m[0].replace(/\s/g,'');
      }
    }

    // Strategy C: .metric-item pairs (main profile metric block)
    if (!result.instagramFollowers) {
      doc.querySelectorAll('.metric-item').forEach(item => {
        const val   = item.querySelector('.metric-value');
        const label = item.querySelector('.metric-label');
        if (!val || !label) return;
        const cnt = val.textContent.trim();
        const lbl = label.textContent.trim().toLowerCase();
        if (lbl === 'followers'   && !result.instagramFollowers) result.instagramFollowers = cnt;
        if (lbl === 'subscribers' && !result.youtubeFollowers)   result.youtubeFollowers   = cnt;
      });
    }

    if (CFG.DEBUG) console.log('[DBG] Platform followers:', result);
    return result;
  }

  // ============================================================
  //  BIO EXTRACTION
  // ============================================================
  function extractBio(doc, jsonld, og) {
    if (jsonld.bio && jsonld.bio.length > 30 && !isMarketing(jsonld.bio)) return jsonld.bio;
    const ogDesc = og.description || '';
    if (ogDesc.length > 30 && !isMarketing(ogDesc)) return ogDesc;
    const SELECTORS = [
      '[class*="bio" i]','[class*="about-text" i]','[class*="creator-bio" i]',
      '[class*="creator-desc" i]','[class*="profile-desc" i]',
      '[class*="intro-text" i]','[class*="description" i]','main p',
    ];
    for (const sel of SELECTORS) {
      const t = getText(doc.querySelector(sel));
      if (t.length > 30 && !isMarketing(t)) return t;
    }
    const mc = (doc.querySelector('meta[name="description"]')?.getAttribute('content')||'').trim();
    return mc.length > 30 && !isMarketing(mc) ? mc : '';
  }

  function extractCategories(doc, listing = '') {
    const catEls = doc.querySelectorAll('[class*="categor" i],[class*="niche" i],[class*="genre" i]');
    const cats = [...new Set(
      Array.from(catEls).map(getText).filter(t => t.length > 2 && !LOCATION_RX.test(t) && !isMarketing(t))
    )];
    return [...new Set([listing,...cats].filter(Boolean))].join(', ');
  }

  function extractEmail(doc, jsonld) {
    if (jsonld.email && !jsonld.email.includes('collabstr')) return jsonld.email;
    const area = doc.querySelector('main,[class*="content" i],[class*="profile" i]');
    const hits = ((area ? area.textContent : '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)||[]);
    return hits.find(e => !e.toLowerCase().includes('collabstr') && !e.includes('example.')) || '';
  }

  function extractLanguages(doc) {
    return [...new Set(
      Array.from(doc.querySelectorAll('[class*="language" i],[class*="lang" i]')).map(getText).filter(Boolean)
    )].join(', ');
  }

  // ============================================================
  //  FETCH + PARSE ONE PROFILE
  // ============================================================
  const EMPTY_PROFILE = Object.freeze({
    instagramURL:'', instagramUsername:'', tiktokURL:'', tiktokUsername:'',
    youtubeURL:'', youtubeUsername:'', twitterURL:'', amazonStorefront:'',
    linktreeURL:'', websiteURL:'', otherLinks:'', bio:'', categories:'',
    languages:'', email:'',
    instagramFollowers:'', tiktokFollowers:'', youtubeFollowers:'', twitterFollowers:'',
  });

  async function fetchProfile(creator, idx, total) {
    const { profileURL, category } = creator;
    UI.status(`🔄 Profile ${idx+1}/${total}`);
    UI.detail(profileURL || '(no URL)');
    if (!profileURL) return { ...EMPTY_PROFILE };

    const html = await fetchProfileHTML(profileURL);
    if (!html)  return { ...EMPTY_PROFILE };

    const doc    = new DOMParser().parseFromString(html, 'text/html');
    const jsonld = extractJSONLD(doc);
    const og     = extractOpenGraph(doc);

    const social      = extractSocialLinks(html, doc, jsonld);
    const platFol     = extractPlatformFollowers(doc);
    const bio         = extractBio(doc, jsonld, og);
    const categories  = extractCategories(doc, category);
    const languages   = extractLanguages(doc);
    const email       = extractEmail(doc, jsonld);

    if (social.instagramURL) console.log(`  📸 @${social.instagramUsername} ${platFol.instagramFollowers}`);
    if (social.tiktokURL)    console.log(`  🎵 @${social.tiktokUsername} ${platFol.tiktokFollowers}`);
    if (social.youtubeURL)   console.log(`  ▶️  ${social.youtubeUsername} ${platFol.youtubeFollowers}`);

    return { ...social, ...platFol, bio, categories, languages, email };
  }

  // ============================================================
  //  [V9] ENRICH — card followers + platforms from profile data
  // ============================================================
  function enrichCreator(creator, profile) {
    // [V9] If card has no followers, use best platform count from profile page
    if (!creator.followers) {
      const candidates = [
        profile.instagramFollowers,
        profile.tiktokFollowers,
        profile.youtubeFollowers,
        profile.twitterFollowers,
      ].filter(v => v && /\d/.test(v));
      if (candidates.length) {
        // Pick highest: convert to numeric for comparison
        const toNum = s => {
          const m = (s||'').match(/([\d.]+)\s*([KkMmBb]?)/);
          if (!m) return 0;
          const mul = {k:1e3,m:1e6,b:1e9}[m[2].toLowerCase()] || 1;
          return parseFloat(m[1]) * mul;
        };
        creator.followers = candidates.sort((a,b) => toNum(b)-toNum(a))[0];
      }
    }

    // [V11] ALWAYS merge card platforms + profile URLs + follower counts
    // (card often only shows Instagram icon even if creator has TikTok/YouTube too)
    const platSet = new Set((creator.platforms || '').split(', ').filter(Boolean));
    if (profile.instagramURL      || profile.instagramFollowers) platSet.add('Instagram');
    if (profile.tiktokURL         || profile.tiktokFollowers)    platSet.add('TikTok');
    if (profile.youtubeURL        || profile.youtubeFollowers)   platSet.add('YouTube');
    if (profile.twitterURL        || profile.twitterFollowers)   platSet.add('Twitter/X');
    creator.platforms = [...platSet].join(', ');
  }

  // ============================================================
  //  BATCH PROCESSING
  // ============================================================
  async function processInBatches(creators, existing = []) {
    const results = [...existing];
    const start   = existing.length;
    const total   = creators.length;
    const nBatch  = Math.ceil((total - start) / CFG.BATCH_SIZE);

    for (let i = start; i < total; i += CFG.BATCH_SIZE) {
      const bNum  = Math.floor((i - start) / CFG.BATCH_SIZE) + 1;
      UI.status(`📦 Batch ${bNum}/${nBatch}`);
      const batch = creators.slice(i, i + CFG.BATCH_SIZE);
      const bRes  = await Promise.all(batch.map((c,j) => fetchProfile(c, i+j, total)));
      results.push(...bRes);
      UI.progress(results.length, total);
      saveSession({ creators, profileData: results });
      if (i + CFG.BATCH_SIZE < total) await sleep(CFG.BATCH_DELAY);
    }
    return results;
  }

  // ============================================================
  //  [V12] EXPORT XLSX — 28 columns
  // ============================================================
  function exportExcel(creators, profileData, filename) {
    UI.status('📊 Building XLSX...');
    const rows = creators.map((c, i) => {
      const p = profileData[i] || {};
      return {
        'Name'                 : c.name,
        'Followers'            : c.followers,
        'Rating'               : c.rating,
        'Price'                : c.price,
        'Location'             : c.location,
        'Platforms'            : c.platforms,
        'Instagram Followers'  : p.instagramFollowers  || '',
        'TikTok Followers'     : p.tiktokFollowers     || '',
        'YouTube Subscribers'  : p.youtubeFollowers    || '',
        'Twitter/X Followers'  : p.twitterFollowers    || '',
        'Category / Niche'     : c.category,
        'Badges'               : c.badges,
        'Profile URL'          : c.profileURL,
        'Instagram URL'        : p.instagramURL        || '',
        'Instagram Username'   : p.instagramUsername   || '',
        'TikTok URL'           : p.tiktokURL           || '',
        'TikTok Username'      : p.tiktokUsername      || '',
        'YouTube URL'          : p.youtubeURL          || '',
        'YouTube Username'     : p.youtubeUsername     || '',
        'Twitter/X URL'        : p.twitterURL          || '',
        'Linktree / Bio Link'  : p.linktreeURL         || '',
        'Website'              : p.websiteURL          || '',
        'Amazon Storefront'    : p.amazonStorefront    || '',
        'Email'                : p.email               || '',
        'Bio'                  : p.bio                 || '',
        'Categories (Profile)' : p.categories          || '',
        'Languages'            : p.languages           || '',
        'Other Social Links'   : p.otherLinks          || '',
      };
    });

    const ws  = XLSX.utils.json_to_sheet(rows);
    const hdr = Object.keys(rows[0] || {});
    ws['!cols'] = hdr.map(k => ({
      wch: Math.min(60, rows.reduce((m,r) => Math.max(m, String(r[k]||'').length), k.length) + 2)
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Creators');
    const fname = filename || `collabstr_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fname);
    console.log(`\n✅ Exported → ${fname}  (${rows.length} rows, 28 columns)`);
  }

  // ============================================================
  //  DEBUG HELPER
  // ============================================================
  window.debugCollabstr = () => {
    const cards = getCards();
    console.log(`🔬 v3.3 Debug: ${cards.length} .profile-listing-holder cards`);
    cards.slice(0,3).forEach((c,i) => {
      console.log(`Card ${i+1}:`, parseCard(c));
    });
  };

  // ============================================================
  //  MAIN
  // ============================================================
  try {
    await loadSheetJS();
    UI.status('🚀 Collabstr Scraper v3.5 starting...');

    // Resume check
    const saved = loadSession();
    if (saved?.creators?.length && saved?.profileData?.length < saved.creators.length) {
      if (confirm(`⏸ Resume previous session?\nDone: ${saved.profileData.length}/${saved.creators.length}\n\nOK = Resume  |  Cancel = Fresh start`)) {
        const profileData = await processInBatches(saved.creators, saved.profileData);
        saved.creators.forEach((c,i) => enrichCreator(c, profileData[i]||{}));
        exportExcel(saved.creators, profileData);
        clearSession();
        const multiInfoR = appendToAccumulated(saved.creators, profileData);
        UI.done(multiInfoR); return;
      }
      clearSession();
    }

    // Load all cards
    const allCards = await scrollAndLoadCards(CFG.LIMIT);
    if (!allCards.length) {
      UI.fail('No .profile-listing-holder elements found on this page');
      console.error('❌ Are you on a Collabstr search/listing page?');
      return;
    }

    const limitedCards = allCards.slice(0, CFG.LIMIT);
    UI.status(`📋 ${limitedCards.length} creator cards found`);

    // Parse cards
    const creators = [];
    for (const card of limitedCards) {
      const c = parseCard(card);
      if (!c.profileURL) { console.log('  ⚠️ No profile URL, skipping'); continue; }
      if (seenURLs.has(c.profileURL)) { console.log(`  ⚠️ Duplicate: ${c.profileURL}`); continue; }
      seenURLs.add(c.profileURL);
      creators.push(c);
    }

    console.log(`\n👁 Sample (first 3):`);
    console.table(creators.slice(0,3));

    // Fetch profiles
    const profileData = await processInBatches(creators);

    // Enrich creators with profile fallbacks
    creators.forEach((c,i) => enrichCreator(c, profileData[i]||{}));

    // Export this page
    exportExcel(creators, profileData);
    clearSession();

    // Accumulate for multi-page Download All
    const multiInfo = appendToAccumulated(creators, profileData);
    console.log(`📦 Accumulated: ${multiInfo.total} total creators (+${multiInfo.added} this page)`);

    UI.done(multiInfo);
    console.log('🎉 Complete!');

  } catch (err) {
    UI.fail(err.message);
    console.error('❌ Fatal:', err);
  }

})();
