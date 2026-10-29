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
    const { session_id } = await req.json();
    if (!session_id || typeof session_id !== "string" || !session_id.startsWith("cs_")) throw new Error("Ungültige Checkout-Session");
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") throw new Error("Zahlung noch nicht bestätigt");
    const productId = session.metadata?.product_id;
    if (!productId) throw new Error("Produkt fehlt in der Zahlung");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: product, error } = await supabase.from("shop_products").select("storage_path,title").eq("id", productId).eq("published", true).single();
    if (error || !product) throw new Error("Download nicht verfügbar");
    const { data, error: signError } = await supabase.storage.from("zip-products").createSignedUrl(product.storage_path, 300, { download: true });
    if (signError || !data?.signedUrl) throw new Error("Download-Link konnte nicht erstellt werden");
    return new Response(JSON.stringify({ url: data.signedUrl, title: product.title }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Download fehlgeschlagen" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});