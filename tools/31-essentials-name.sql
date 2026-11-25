-- =====================================================================
-- 31-essentials-name.sql  (Produktname vereinheitlichen)
--
-- Der Kit heisst ueberall "Essentials" (die Gratis-Version "Essentials Lite").
-- Die Beschreibung in der Datenbank sagte noch "Essentials Percussion is ...".
--
-- Einmal im Supabase SQL Editor einfuegen und "Run" klicken. Wiederholbar.
-- essentials.html ist schon angepasst; beim naechsten Lauf von
-- tools/gen-product-pages.py bleibt es so.
-- =====================================================================

update public.shop_products
   set description = replace(description, 'Essentials Percussion', 'Essentials')
 where description like '%Essentials Percussion%';
