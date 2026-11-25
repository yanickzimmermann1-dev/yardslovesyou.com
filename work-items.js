/* work-items.js - alles, was yards musikalisch macht (Work-Galerie, work.html -> work.js).

   NEUEN EINTRAG HINZUFUEGEN:
   1. Datei in Cloudflare R2 hochladen (Bucket yards-media, oeffentlich unter https://audio.yardslovesyou.com/).
   2. Unten oben in der Liste EINE Zeile ergaenzen (neueste zuerst).
   3. In work.html die Version von work-items.js hochzaehlen (?v=...), sonst sieht man den Eintrag wegen Cache nicht.
   ACHTUNG: Nie eine Datei referenzieren, bevor sie hochgeladen ist. Cloudflare cached 404s auf
   audio.yardslovesyou.com 7 Tage lang, die Datei waere dann tagelang "nicht da", auch nach dem Upload.

   FELDER
   type   'audio' | 'video' | 'youtube' | 'image' | 'note'   (Pflicht)
   title  Anzeigename                                         (Pflicht, bei image optional)
   file   R2-Dateiname ('loop-04.m4a'), volle https-URL, lokaler Pfad ('about-img/x.jpg') oder bei youtube die Video-ID/URL
   cover  optional: Bild fuer audio/video (gleiche Schreibweise wie file)
   date   'YYYY-MM-DD' (oder leer lassen, dann ganz unten einsortiert)
   tags   ['808','sketch','track', ...]                      -> werden automatisch zu Filter-Chips
   bpm, key, note  optional (Meta-Zeile / Text; bei type 'note' ist note der Inhalt)
   alt    optional: Bildbeschreibung fuer Screenreader */
(function () {
  'use strict';
  var R2 = 'https://audio.yardslovesyou.com/';
  window.YLYWork = {
    r2: R2,
    items: [
      // --- finished tracks (gleiche Dateien wie portfolio.js) ---
      { type: 'audio', title: 'Pretty.mp<3', file: 'pretty125bpm.m4a', cover: 'pretty.jpg?v=2', date: '2026-11-18', tags: ['track'], bpm: 125 },
      { type: 'audio', title: 'Crack.mp<3', file: 'crack180bpm.m4a', cover: 'crack.jpg', date: '2026-11-18', tags: ['track'], bpm: 180 },
      { type: 'audio', title: 'Flowing.mp<3', file: 'flowing158bpm.m4a', cover: 'Flowing.jpg', date: '2026-11-18', tags: ['track'], bpm: 158 },
      { type: 'audio', title: 'TwoDays.mp<3', file: 'twodays132bpm.m4a', cover: 'TwoDays.jpg', date: '2026-11-16', tags: ['track'], bpm: 132 },
      { type: 'audio', title: 'MyFace.mp<3', file: 'myface130bpm.m4a?v=2', cover: 'MyFace.jpg', date: '', tags: ['track'], bpm: 130 },
      { type: 'audio', title: 'AngelsHell.mp<3', file: 'angelshell148bpm.m4a', cover: 'AngelsHell.jpg', date: '', tags: ['track'], bpm: 148 },
      // --- studio ---
      { type: 'image', title: 'Console', file: 'about-img/console.jpg', date: '', tags: ['studio'], alt: 'Mixing console in the studio' },
      { type: 'image', title: 'Drum session', file: 'about-img/drum-session.jpg', date: '', tags: ['studio'], alt: 'Drum session in the live room' },
      { type: 'image', title: 'Home studio', file: 'about-img/home-studio.jpg', date: '', tags: ['studio'], alt: 'The home studio setup' },
      { type: 'image', title: 'Live room', file: 'about-img/live-room.jpg', date: '', tags: ['studio'], alt: 'The live room' }
    ]
  };
})();
