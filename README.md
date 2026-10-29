# Music Portfolio + ZIP-Shop (GitHub Pages + Supabase + Stripe)

Dieses Starterprojekt enthält:
- `index.html`: Musik-Portfolio mit mehreren Playern, Drag-and-drop Audio-Upload und Admin-Login.
- `shop.html`: Produktübersicht für ZIP-Dateien.
- `styles.css`: gemeinsames dunkles/violettes Design.
- `config.js`: Supabase-Projekt-URL und Publishable Key.
- `supabase/setup.sql`: Tabellen, Storage-Buckets und Sicherheitsregeln.
- `supabase/functions/`: serverseitige Stripe-Checkout- und Download-Funktionen.

## 1. Supabase einrichten
1. Erstelle ein Supabase-Projekt.
2. Öffne **SQL Editor**, füge `supabase/setup.sql` vollständig ein und führe es aus.
3. Unter **Authentication → Users** erstellst du deinen Admin-Benutzer.
4. Kopiere dessen UUID und führe im SQL Editor aus:
   `insert into public.audio_admins(user_id) values ('DEINE-USER-UUID');`
5. Öffne **Project Settings → API** und kopiere Project URL und Publishable Key (oder alten `anon` Key) in `config.js`.
6. Deaktiviere öffentliche Registrierung unter Authentication, wenn nur du Admin sein sollst.

## 2. Musikdateien hochladen
Lade die Seite nach dem Einrichten hoch, klicke auf **Admin**, melde dich an und ziehe Audio-Dateien in den Upload-Bereich. Audio-Dateien sind absichtlich öffentlich streambar. Löschen und Upload sind durch Supabase RLS auf Admins beschränkt.

## 3. ZIP-Shop und Stripe einrichten
1. Erstelle ein Stripe-Konto und schalte es für Live-Zahlungen erst frei, wenn du die nötigen Angaben ergänzt hast.
2. Installiere lokal die Supabase CLI und melde dich an, verknüpfe das Projekt (`supabase link --project-ref DEIN_PROJECT_REF`).
3. Lege die Edge-Function-Secrets im Supabase-Projekt fest:
   - `STRIPE_SECRET_KEY` = Stripe Secret Key (nur serverseitig)
   - `SITE_URL` = vollständige GitHub-Pages-URL, z. B. `https://BENUTZER.github.io/REPOSITORY`
   - `SUPABASE_SERVICE_ROLE_KEY` = Service-Role-Key nur als Edge-Function-Secret, NIEMALS in `config.js` oder GitHub
4. Deploye die Funktionen:
   `supabase functions deploy create-checkout`
   `supabase functions deploy download-zip`
5. In Supabase → Storage → `zip-products` lädst du deine ZIP-Dateien hoch. Der Bucket ist privat. Notiere pro Datei den Storage-Pfad.
6. Lege Produkte in `shop_products` an. Felder: `title`, `description`, `price_cents` (z. B. 999 für CHF 9.99), `currency` (z. B. `CHF`), `cover_emoji`, `storage_path` (exakter Pfad im `zip-products` Bucket), `published` (zum Anzeigen `true`).
7. Teste zuerst mit Stripe-Testschlüsseln und Testzahlungen. Ersetze sie erst später durch Live-Schlüssel.

### Wichtige Sicherheitshinweise
- `config.js` darf nur die Supabase Project URL und den Publishable Key enthalten. Niemals `service_role`, `secret` oder Stripe Secret Key in HTML/JS veröffentlichen.
- ZIP-Dateien bleiben im privaten Bucket. Der Download-Endpunkt prüft serverseitig den Stripe-Zahlungsstatus und gibt danach einen signierten Link aus, der nach 5 Minuten abläuft.
- Die Beispiel-Funktion prüft die Checkout-Session gegen Stripe, bevor sie einen Download-Link erstellt. Für einen produktiven Shop solltest du zusätzlich Stripe-Webhooks, Bestellprotokoll, Missbrauchsschutz/Rate-Limits und eine eindeutige Download-Berechtigung pro Bestellung ergänzen. Der einfache Session-ID-Ansatz ist ein Starter, kein vollständiges DRM; Session-IDs nicht öffentlich teilen.
- Veröffentliche erst nach Tests. Steuern, Widerrufsrecht und Informationspflichten für digitale Produkte können je nach Land gelten.

## 4. Auf GitHub Pages veröffentlichen
1. Erstelle ein GitHub-Repository, z. B. `music-website`.
2. Lade `index.html`, `shop.html`, `styles.css`, `config.js`, `portfolio.js`, `shop.js` und den Ordner `supabase/` hoch.
3. Ersetze in `config.js` die beiden Platzhalter.
4. Öffne im Repository **Settings → Pages**.
5. Wähle **Deploy from a branch**, Branch `main`, Ordner `/ (root)` und speichere.
6. GitHub zeigt dir die Website-Adresse an. Verwende diese URL auch als `SITE_URL` und trage sie bei Bedarf in den Stripe-Einstellungen ein.

## Dateien bearbeiten
- Farben und Layout: `styles.css`
- Portfolio-Texte: `index.html`
- Shop-Texte: `shop.html`
- Supabase-Zugangsdaten: `config.js`
- Tabellen und Rechte: `supabase/setup.sql`
