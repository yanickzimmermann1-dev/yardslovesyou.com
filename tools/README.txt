Werkzeuge fuer yardslovesyou.com
================================

gen-product-pages.py - statische Produktseiten erzeugen (SEO)
-------------------------------------------------------------
Was es macht:
  * Holt alle veroeffentlichten Produkte (published = true) aus Supabase (eine einzige Abfrage).
  * Schreibt pro Produkt eine Seite im Hauptordner, z.B. essentials.html und the-last-yards.html
    (Dateiname = Produkttitel in Kleinbuchstaben mit Bindestrichen). Vorlage ist product.html.
  * Jede Seite hat eigenen Titel, Beschreibung, Canonical, Open-Graph/Twitter-Tags,
    JSON-LD (Product) und einen fertig gerenderten H1/Text/Preis, den product.js danach uebernimmt.
  * Schreibt products-map.js (Produkt-ID -> Seitenname, wird von Shop, Warenkorb und Quickview benutzt).
  * Aktualisiert die Produkt-URLs in sitemap.xml.

So startest du es (im Hauptordner des Repos, nur Python 3 noetig, keine Pakete):
  python3 tools/gen-product-pages.py

Wann ausfuehren:
  * Nach jedem neuen Produkt, nach einer Titel-, Preis- oder Beschreibungsaenderung in Supabase
    und nach Aenderungen an product.html (die Vorlage).
  * Danach die geaenderten Dateien (xxx.html, products-map.js, sitemap.xml) mit GitHub hochladen.

Hinweise:
  * product.html?id=... funktioniert weiterhin (alte Links), zeigt aber auf die statische Seite als Canonical.
  * Die Seiten nicht von Hand bearbeiten, sie werden beim naechsten Lauf ueberschrieben.
  * Das Datum in der Sitemap (lastmod) steht oben im Skript (LASTMOD).
