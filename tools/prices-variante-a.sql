update shop_products set price_cents = 1200 where id = '11f558ea-9332-4bf3-ad2f-d8327c489445'; -- Essentials CHF 12
update shop_products set price_cents = 3900 where id = 'c9ab4f32-e7a1-4ae0-8e93-a421b3225c15'; -- The Last Yards CHF 39
select title, price_cents from shop_products where id in ('11f558ea-9332-4bf3-ad2f-d8327c489445','c9ab4f32-e7a1-4ae0-8e93-a421b3225c15');
