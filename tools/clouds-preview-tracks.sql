update shop_products
set preview_tracks = '[{"title":"Creatures · 145 BPM","file":"https://audio.yardslovesyou.com/clouds-creatures145bpm.m4a"},{"title":"Runnin · 180 BPM","file":"https://audio.yardslovesyou.com/clouds-runnin180bpm.m4a"},{"title":"Londn · 169 BPM","file":"https://audio.yardslovesyou.com/clouds-londn169bpm.m4a"},{"title":"Anthem On It · 140 BPM","file":"https://audio.yardslovesyou.com/clouds-anthemonit140bpm.m4a"}]'::jsonb
where title = 'Clouds Vol. 01';
