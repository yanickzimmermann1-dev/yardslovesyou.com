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


build.py - CSS-Bundles erzeugen (schnellere Seitenladung)
---------------------------------------------------------
Was es macht:
  * Jede HTML-Seite hat statt 10-18 einzelner CSS-<link>-Tags nur noch EIN Bundle: css/b-<hash>.css
    (alle CSS-Dateien der Seite in derselben Reihenfolge, konservativ minimiert, url()-Pfade angepasst).
  * Welche Dateien in ein Bundle kommen, steht pro Seite im Marker direkt vor dem Link:
        <!-- css-src: intro.css fx.css styles.css ... -->
        <link rel="stylesheet" href="css/b-xxxxxxxxxx.css" data-css="...">
  * Die Quelldateien (styles.css, hero.css, ...) bleiben im Hauptordner und sind weiter die Dateien,
    die du bearbeitest. Die Dateien in css/ nie von Hand aendern.
  * Seiten mit gleicher Dateiliste teilen sich ein Bundle. Der Hash im Dateinamen sorgt fuer Cache-Busting
    (kein ?v= mehr noetig). Alte, nicht mehr benutzte Bundles werden automatisch geloescht.

So startest du es (im Hauptordner des Repos, nur Python 3 noetig):
    python3 tools/build.py

Wann ausfuehren:
  * Nach JEDER Aenderung an einer CSS-Datei (sonst sieht die Seite die Aenderung nicht).
  * Nach dem Erzeugen von Produktseiten (gen-product-pages.py), falls die Vorlage product.html geaendert wurde.
  * Danach css/ und die geaenderten HTML-Dateien mit hochladen (GitHub).
Neues CSS auf einer Seite einbinden: den Dateinamen im Marker (css-src) dieser Seite ergaenzen, dann build.py ausfuehren.
Neue Seite: normale <link rel="stylesheet" href="xyz.css">-Tags schreiben, build.py baut den Marker beim ersten Lauf selbst.
