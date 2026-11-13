MEDIA-SPIEGEL (spart Supabase-Egress)
=====================================
Dateien in diesem Ordner werden von GitHub Pages statt von Supabase Storage ausgeliefert.
Pfad = Bucket/Pfad, z.B. media/coverart-products/perclab/kick/kick.wav
Die Liste steht in media/manifest.json und ist in media.js eingebettet.

Neue Dateien hinzufuegen:
1) Wie bisher in Supabase hochladen (Bucket coverart-products usw.). Das funktioniert sofort
   ueber den Fallback (Datei kommt dann von Supabase).
2) Optional spiegeln: Claude bitten "Media spiegeln". Oder die Datei selbst nach
   media/<bucket>/<pfad> legen, den Eintrag in media/manifest.json ergaenzen und media.js
   neu erzeugen (FILES-Objekt). Danach ?v bei media.js in allen HTML-Seiten erhoehen.

Nur oeffentliche Buckets spiegeln, nie zip-products, client-submissions, client-deliveries.
Dateien ueber ca. 20 MB nicht spiegeln (z.B. finished-snippet-essentials.wav).
Wird eine Datei in Supabase ersetzt, muss auch die Kopie hier ersetzt werden.
