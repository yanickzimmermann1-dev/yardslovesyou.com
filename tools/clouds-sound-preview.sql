-- Run in the Supabase SQL editor. Works for jsonb columns (the ::jsonb cast is also fine for json/text->jsonb assignment).
-- If sound_preview is a text column, replace "::jsonb" with nothing.
update shop_products
set sound_preview = '{"bucket":"coverart-products","folder":"clouds-preview","count":8,"files":["CLOUDS_Kick_Punch.wav","CLOUDS_Snare_Breeze.wav","CLOUDS_Clap_Vapor.wav","CLOUDS_HiHat_Aurora.wav","CLOUDS_OpenHat_Zenith.wav","CLOUDS_Perc_Halo.wav","CLOUDS_808_Cumulus_C.wav","CLOUDS_808_Nimbus_C.wav"]}'::jsonb
where title = 'Clouds Vol. 01';
