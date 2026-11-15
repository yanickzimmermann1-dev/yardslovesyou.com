#!/usr/bin/env python3
"""build.py - buendelt die CSS-Dateien jeder HTML-Seite zu EINEM minimierten Bundle (css/b-<hash>.css).

Nur Python 3 (Standardbibliothek). Im Hauptordner des Repos ausfuehren:
    python3 tools/build.py

Wie es funktioniert
  * Pro HTML-Seite steht ein Marker: <!-- css-src: a.css b.css ... --> direkt vor dem Bundle-<link>.
    Beim ersten Lauf wird der Marker aus den vorhandenen <link rel="stylesheet">-Tags der Seite erzeugt
    (gleiche Reihenfolge!), danach liest das Skript immer den Marker.
  * Die Quell-CSS-Dateien bleiben im Repo und sind weiterhin die Dateien, die man bearbeitet.
  * Seiten mit identischer Dateiliste teilen sich dasselbe Bundle (Hash im Dateinamen = Cache-Busting).
  * Nicht mehr benutzte Bundles (css/b-*.css) werden geloescht.
  * Neue Seite / neues CSS einbinden: Dateiname im Marker ergaenzen (oder bei einer neuen Seite normale
    <link rel="stylesheet">-Tags schreiben) und das Skript laufen lassen.
"""
import glob
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "css")
MARK_RE = re.compile(r'[ \t]*<!-- css-src: ([^>]*?) -->\s*<link rel="stylesheet" href="([^"]*)"[^>]*>[ \t]*\r?\n?')
LINK_RE = re.compile(r'[ \t]*<link\b[^>]*>[ \t]*\r?\n?')


def attrs(tag):
    return dict((m.group(1).lower(), m.group(2)) for m in re.finditer(r'([a-zA-Z-]+)="([^"]*)"', tag))


def is_local_css(tag):
    a = attrs(tag)
    if a.get("rel", "").lower() != "stylesheet":
        return None
    href = a.get("href", "")
    if re.match(r'^[a-z][a-z0-9+.-]*:|^//', href, re.I):
        return None
    if a.get("media") or a.get("integrity"):
        return None
    return href.split("?")[0].split("#")[0]


# ---------------------------------------------------------------- CSS minify (konservativ)
def fix_urls(css, rel_prefix="../"):
    def repl(m):
        q, u = m.group(1) or "", m.group(2).strip()
        if re.match(r'^(data:|https?:|//|/|#|about:|blob:)', u, re.I):
            return m.group(0)
        return "url(%s%s%s%s)" % (q, rel_prefix, u, q)
    return re.sub(r'url\(\s*(["\']?)([^"\')]*?)\1\s*\)', repl, css)


def minify(css):
    out = []
    i, n = 0, len(css)
    while i < n:
        c = css[i]
        if c == "/" and css.startswith("/*", i):
            j = css.find("*/", i + 2)
            i = n if j < 0 else j + 2
            out.append(" ")
        elif c in "\"'":
            j = i + 1
            while j < n and css[j] != c:
                j += 2 if css[j] == "\\" else 1
            out.append(css[i:j + 1])
            i = j + 1
        elif css.startswith("url(", i) and not re.match(r'url\(\s*["\']', css[i:i + 12]):
            j = css.find(")", i)
            out.append(css[i:j + 1])
            i = j + 1
        else:
            out.append(c)
            i += 1
    s = "".join(out)
    # Strings/urls koennen kein Leerzeichen-Kollaps vertragen -> getrennt behandeln
    parts = re.split(r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|url\([^)"\']*\))', s)
    for k in range(0, len(parts), 2):
        p = re.sub(r'\s+', " ", parts[k])
        p = re.sub(r' ?([{};,]) ?', r'\1', p)
        parts[k] = p
    s = "".join(parts)
    s = s.replace(";}", "}")
    return s.strip()


def build_bundle(files, base_dir):
    chunks = []
    for f in files:
        p = os.path.join(base_dir, f)
        if not os.path.isfile(p):
            sys.exit("FEHLER: %s nicht gefunden" % p)
        with open(p, encoding="utf-8") as fh:
            src = fh.read()
        chunks.append(minify(fix_urls(src)))
    return "\n".join(chunks) + "\n"


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    used = set()
    changed = 0
    for page in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        with open(page, encoding="utf-8") as fh:
            html = fh.read()
        head_end = html.find("</head>")
        head = html[:head_end] if head_end > 0 else html
        rest = html[len(head):]
        m = MARK_RE.search(head)
        if m:
            files = m.group(1).split()
            prefix = "/" if m.group(2).startswith("/") else ""
            span = (m.start(), m.end())
        else:
            files, first, prefix, spans = [], None, "", []
            for lm in LINK_RE.finditer(head):
                css = is_local_css(lm.group(0))
                if css:
                    if first is None:
                        first = lm.start()
                        prefix = "/" if attrs(lm.group(0)).get("href", "").startswith("/") else ""
                    files.append(os.path.basename(css))
                    spans.append((lm.start(), lm.end()))
            if not files:
                continue
            # alle einzelnen Links entfernen (von hinten), Marker + Bundle an erster Stelle einsetzen
            for a, b in reversed(spans):
                head = head[:a] + head[b:]
            span = (first, first)
            m = None
        bundle = build_bundle(files, ROOT)
        h = hashlib.sha1(bundle.encode("utf-8")).hexdigest()[:10]
        name = "b-%s.css" % h
        used.add(name)
        path = os.path.join(OUT_DIR, name)
        if not os.path.isfile(path) or open(path, encoding="utf-8").read() != bundle:
            with open(path, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(bundle)
        tag = ('  <!-- css-src: %s -->\n  <link rel="stylesheet" href="%scss/%s" data-css="%s">\n'
               % (" ".join(files), prefix, name, " ".join(files)))
        new_html = head[:span[0]] + tag + head[span[1]:] + rest
        if new_html != html:
            with open(page, "w", encoding="utf-8", newline="") as fh:
                fh.write(new_html)
            changed += 1
        print("%-26s %2d CSS -> %s" % (os.path.basename(page), len(files), name))
    for old in glob.glob(os.path.join(OUT_DIR, "b-*.css")):
        if os.path.basename(old) not in used:
            os.remove(old)
    print("%d Seite(n) aktualisiert, %d Bundle(s) in css/" % (changed, len(used)))


if __name__ == "__main__":
    main()
