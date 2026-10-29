import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { product_id } = await req.json();
    if (!product_id) throw new Error("product_id fehlt");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: product, error } = await supabase.from("shop_products")
      .select("id,title,description,price_cents,currency,published").eq("id", product_id).eq("published", true).single();
    if (error || !product) throw new Error("Produkt nicht gefunden");
    if (product.price_cents <= 0) throw new Error("Dieses Checkout-Beispiel unterstützt nur kostenpflichtige Produkte");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price_data: { currency: product.currency.toLowerCase(), unit_amount: product.price_cents,
        product_data: { name: product.title, description: product.description || "Digitaler ZIP-Download" } }, quantity: 1 }],
      success_url: `${origin}/shop.html?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop.html?cancelled=1`,
      metadata: { product_id: product.id },
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Checkout fehlgeschlagen" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});