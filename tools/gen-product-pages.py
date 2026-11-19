#!/usr/bin/env python3
"""Erzeugt statische Produktseiten (essentials.html, guide-*.html, ...) aus product.html + Supabase,
schreibt products-map.js und ergaenzt fehlende Produkt-URLs in sitemap.xml.
Nur Python-Standardbibliothek. Aufruf aus dem Repo-Stammordner: python3 tools/gen-product-pages.py

KURZANLEITUNG
  Liest:     Supabase shop_products (read-only GET, Key aus config.js), product.html (Vorlage inkl. Script-
             Liste/?v=-Versionen/CSS-Marker), media.js, products-map.js (bestehende Seitennamen), vorhandene
             Produktseiten (nur: ob sample.js drin ist).
  Schreibt:  <slug>.html je Produkt, products-map.js, sitemap.xml (bestehende Eintraege/lastmod bleiben).
  Danach:    python3 tools/build.py (setzt das CSS-Bundle/den Hash), dann `git diff` pruefen, erst dann pushen.
  Stabil:    Bei unveraendertem DB-Stand liefert der Lauf (+ build.py) einen leeren git diff.
  Seitennamen: stehen in products-map.js und bleiben erhalten; nur NEUE Produkte werden per slugify(title) benannt.
  Handpflege: PAGE_OVERRIDES (unten) haelt Abweichungen, die nicht aus der DB kommen (Bild-URL, Zusatzbilder)."""
import html, json, re, sys, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://yardslovesyou.com"
LASTMOD = "2026-11-14"
CHF_NBSP = " "


def cfg_value(key):
    m = re.search(key + r'\s*:\s*"([^"]+)"', (ROOT / "config.js").read_text(encoding="utf-8"))
    if not m:
        sys.exit("config.js: %s nicht gefunden" % key)
    return m.group(1)


def fetch_products():
    base, key = cfg_value("SUPABASE_URL"), cfg_value("SUPABASE_PUBLISHABLE_KEY")
    q = urllib.parse.urlencode({"published": "eq.true", "select": "id,title,description,long_description,price_cents,currency,image_url,gallery,category",
                                "order": "created_at.asc"})
    req = urllib.request.Request(base + "/rest/v1/shop_products?" + q, headers={"apikey": key, "Authorization": "Bearer " + key})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


# Abweichungen von der DB, die auf den aktuellen Seiten bewusst so stehen (Schluessel = Seitenname).
#   "images": exakte Bild-URL-Liste fuer og:image/twitter:image/JSON-LD/<img> (erste = Hauptbild)
PAGE_OVERRIDES = {
    "clouds-vol-01": {"images": ["https://kmekgjllklwrxizqbrac.supabase.co/storage/v1/object/public/coverart-products/clouds-vol-01.jpg"]},
}
SAMPLE_TAG = re.compile(r'[ \t]*<script src="sample\.js[^"]*" defer></script>\n')


def slugify(t):
    s = re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")
    return s or "product"


def media_manifest():
    m = re.search(r"var FILES = (\{.*?\});", (ROOT / "media.js").read_text(encoding="utf-8"))
    return json.loads(m.group(1)) if m else {}


def image_urls(p, files):
    """Absolute URLs; bevorzugt die gespiegelte Datei unter /media/ (wie media.js)."""
    out = []
    for u in [p.get("image_url")] + list(p.get("gallery") or []):
        if not u:
            continue
        if re.match(r"https://", u):
            pre = cfg_value("SUPABASE_URL").rstrip("/") + "/storage/v1/object/public/"
            path = urllib.parse.unquote(u[len(pre):].split("?")[0]) if u.startswith(pre) else None
        else:
            path = "coverart-products/" + u
        if path in files:
            t = files[path] if isinstance(files[path], str) else path
            out.append(SITE + "/media/" + "/".join(urllib.parse.quote(x) for x in t.split("/")))
        elif path:
            out.append(cfg_value("SUPABASE_URL").rstrip("/") + "/storage/v1/object/public/" + urllib.parse.quote(path))
        else:
            out.append(u)
    return out


def short_desc(p):
    d = re.sub(r"\s+", " ", p.get("description") or "Digital download as ZIP file.").strip()
    if len(d) > 155:
        d = d[:155]
        sp = d.rfind(" ")
        if sp > 100:
            d = d[:sp]
        d = re.sub(r"[\s,.;:\-]+$", "", d) + "…"
    return d


def money(cents, cur):
    return "%s%s%.2f" % ((cur or "CHF").upper(), CHF_NBSP, cents / 100)


def build_page(tpl, p, slug, files):
    title = p["title"]
    e = html.escape
    desc = short_desc(p)
    url = "%s/%s.html" % (SITE, slug)
    imgs = PAGE_OVERRIDES.get(slug, {}).get("images") or image_urls(p, files)
    img = imgs[0] if imgs else SITE + "/og-image.jpg"
    # Guide-Cover (guides/NN-name.jpg) haben ein Vorschaubild "<name>-preview.jpg" -> zusaetzlich im JSON-LD
    ld_imgs = list(imgs) or [img]
    if re.search(r"/guides/\d\d-[^/]+\.jpg$", img):
        ld_imgs.append(img[:-4] + "-preview.jpg")
    cur = (p.get("currency") or "CHF").upper()
    head = (
        '<title>%s · YARDSLOVESYOU</title>\n'
        '  <meta name="description" content="%s">\n'
        '  <link rel="canonical" href="%s">\n'
        '  <link rel="icon" href="favicon.svg?v=4" type="image/svg+xml">\n'
        '  <link rel="icon" href="favicon.png?v=4" type="image/png" sizes="192x192">\n'
        '  <link rel="icon" href="favicon-32.png?v=4" type="image/png" sizes="32x32">\n'
        '  <link rel="apple-touch-icon" href="apple-touch-icon.png?v=4">\n\n'
        '  <meta property="og:type" content="product">\n'
        '  <meta property="og:site_name" content="YARDSLOVESYOU">\n'
        '  <meta property="og:title" content="%s · YARDSLOVESYOU">\n'
        '  <meta property="og:description" content="%s">\n'
        '  <meta property="og:url" content="%s">\n'
        '  <meta property="og:image" content="%s">\n'
        '  <meta name="twitter:card" content="summary_large_image">\n'
        '  <meta name="twitter:title" content="%s · YARDSLOVESYOU">\n'
        '  <meta name="twitter:description" content="%s">\n'
        '  <meta name="twitter:image" content="%s">\n'
    ) % (e(title), e(desc), url, e(title), e(desc), url, e(img), e(title), e(desc), e(img))
    ld = {
        "@context": "https://schema.org", "@type": "Product", "name": title, "description": desc,
        "image": ld_imgs, "sku": p["id"], "url": url,
        "brand": {"@type": "Brand", "name": "YARDSLOVESYOU"},
        "offers": {"@type": "Offer", "url": url, "price": "%.2f" % (p["price_cents"] / 100), "priceCurrency": cur,
                   "availability": "https://schema.org/InStock"},
    }
    head += '  <script type="application/ld+json" id="ld-product">%s</script>\n' % json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    pat = re.compile(r'<title>.*?<meta name="twitter:image"[^>]*>\n', re.S)
    if not pat.search(tpl):
        sys.exit("product.html: Head-Block nicht gefunden")
    out = pat.sub(lambda m: head, tpl, count=1)

    # sample.js: bei bestehenden Seiten so lassen wie aktuell (nicht jedes Produkt hat Hoerproben), neue Seiten: Vorlage
    cur_page = ROOT / (slug + ".html")
    if cur_page.exists() and "sample.js" not in cur_page.read_text(encoding="utf-8"):
        out = SAMPLE_TAG.sub("", out)

    out = out.replace('<body data-area="shop">', '<body data-area="shop" data-product-id="%s">' % e(p["id"]), 1)

    local_img = img.replace(SITE + "/", "", 1) if img.startswith(SITE + "/") else img
    chev = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
    back = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="m15 6-6 6 6 6"/></svg>'
    static = (
        '<main class="wrap" id="product-root">\n'
        '    <nav class="crumbs" aria-label="Breadcrumb"><a href="shop.html">Shop</a>%s<span aria-current="page">%s</span></nav>\n'
        '    <a class="back-link" href="shop.html#downloads">%s Back to shop</a>\n'
        '    <section class="product-detail" data-static>\n'
        '      <div class="pd-media"><div class="pd-main"><img src="%s" alt="%s" width="800" height="800" fetchpriority="high" decoding="async"></div></div>\n'
        '      <div class="pd-info">\n'
        '        <p class="eyebrow">Digital product</p>\n'
        '        <h1>%s</h1>\n'
        '        <p class="muted">%s</p>\n'
        '        <div class="pd-buy"><span class="price-wrap"><span class="price">%s</span></span></div>\n'
        '      </div>\n'
        '    </section>\n'
        '  </main>'
    ) % (chev, e(title), back, e(local_img), e(title), e(title), e(p.get("description") or "Digital download as ZIP file."), money(p["price_cents"], cur))
    out, n = re.subn(r'<main class="wrap" id="product-root">.*?</main>', lambda m: static, out, count=1, flags=re.S)
    if not n:
        sys.exit("product.html: <main id=product-root> nicht gefunden")
    return out


def update_map(slugs):
    f = ROOT / "products-map.js"
    s = f.read_text(encoding="utf-8")
    s = re.sub(r"var SLUGS = \{.*?\};", lambda m: "var SLUGS = " + json.dumps(slugs, indent=2, sort_keys=True) + ";", s, count=1, flags=re.S)
    f.write_text(s, encoding="utf-8")


def update_sitemap(slugs):
    """Bestehende Eintraege (Reihenfolge, lastmod) bleiben unveraendert; nur fehlende Seiten werden ergaenzt."""
    f = ROOT / "sitemap.xml"
    s = f.read_text(encoding="utf-8")
    s = re.sub(r'[ \t]*<url><loc>%s/product\.html\?id=[^<]*</loc>.*?</url>\n' % re.escape(SITE), "", s)
    entries = "".join('  <url><loc>%s/%s.html</loc><lastmod>%s</lastmod><priority>0.8</priority></url>\n' % (SITE, slug, LASTMOD)
                      for slug in sorted(slugs.values()) if "<loc>%s/%s.html</loc>" % (SITE, slug) not in s)
    if entries:
        anchor = re.search(r'[ \t]*<url><loc>%s/community-guidelines\.html' % re.escape(SITE), s)
        s = s[:anchor.start()] + entries + s[anchor.start():] if anchor else s.replace("</urlset>", entries + "</urlset>")
    f.write_text(s, encoding="utf-8")


LOCAL_JSON = ROOT.parent / "next" / "upload-guides" / "products.json"


def load_local(path):
    """Lokale Produktdaten (gleiche Felder wie die DB-Zeilen, plus optional "slug" = Seitenname)."""
    return json.loads(Path(path).read_text(encoding="utf-8"))


def current_slugs():
    m = re.search(r"var SLUGS = (\{.*?\});", (ROOT / "products-map.js").read_text(encoding="utf-8"), re.S)
    return json.loads(m.group(1)) if m else {}


def main():
    """Modi:
      python3 tools/gen-product-pages.py            alle veroeffentlichten Produkte live aus der DB (read-only GET)
      python3 tools/gen-product-pages.py --local [pfad/zu/products.json]
          nur die Produkte aus der lokalen JSON (Standard: ../next/upload-guides/products.json), ohne DB-Zugriff;
          bestehende Eintraege in products-map.js/sitemap.xml bleiben erhalten.
    Hat ein Produkt in der JSON ein Feld "slug", wird dieser Seitenname auch im Live-Modus verwendet."""
    tpl = (ROOT / "product.html").read_text(encoding="utf-8")
    files = media_manifest()
    args = sys.argv[1:]
    local_mode = "--local" in args
    src = Path(args[args.index("--local") + 1]) if local_mode and len(args) > args.index("--local") + 1 else LOCAL_JSON
    local = load_local(src) if (local_mode or src.exists()) else []
    forced = {p["id"]: p["slug"] for p in local if p.get("slug")}
    products = local if local_mode else fetch_products()
    slugs = current_slugs()
    for p in products:
        slug = forced.get(p["id"]) or slugs.get(p["id"]) or slugify(p["title"])
        if p["id"] not in forced and p["id"] not in slugs and (slug in ("product", "shop", "index") or slug in slugs.values()):
            slug += "-" + p["id"][:4]
        slugs[p["id"]] = slug
        (ROOT / (slug + ".html")).write_text(build_page(tpl, p, slug, files), encoding="utf-8")
        print("geschrieben:", slug + ".html")
    update_map(slugs)
    update_sitemap(slugs)
    print("products-map.js und sitemap.xml aktualisiert (%d Produkte)" % len(slugs))


if __name__ == "__main__":
    main()
