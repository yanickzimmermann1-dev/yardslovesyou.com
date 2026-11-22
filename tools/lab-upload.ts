// Supabase Edge Function: lab-upload  (Deno, TypeScript, ASCII only)
//
// Deploy:  supabase functions deploy lab-upload
// Secrets: supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//            R2_BUCKET=yards-media R2_PUBLIC_BASE=https://audio.yardslovesyou.com
// (SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase automatically.)
//
// POST { action: "upload", contentType: "audio/mp4", size: 123456 }
//   -> { uploadUrl, publicUrl, key, headers }   (client then PUTs the file to uploadUrl)
// POST { action: "delete", url: "<public url>" }
//   -> { ok: true }   (only the owner of the file or an admin)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const MAX_BYTES = 1.5 * 1024 * 1024;   // 1.5 MB
const MAX_PER_DAY = 10;                // uploads per user per 24 h
const EXPIRES = 300;                   // presigned URL valid for 5 minutes
const REGION = "auto";
const SERVICE = "s3";

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?yardslovesyou\.com$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

function corsHeaders(origin: string | null): Record<string, string> {
  const ok = origin && ALLOWED_ORIGINS.some((r) => r.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://yardslovesyou.com",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ---------- AWS SigV4 with WebCrypto ----------
const enc = new TextEncoder();
const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
async function signingKey(secret: string, date: string) {
  const kDate = await hmac(enc.encode("AWS4" + secret), date);
  const kRegion = await hmac(kDate, REGION);
  const kService = await hmac(kRegion, SERVICE);
  return hmac(kService, "aws4_request");
}
// RFC 3986 encoding as required by SigV4
const uriEnc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

function amzDates() {
  const iso = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20261122T120000Z
  return { amzDate: iso, date: iso.slice(0, 8) };
}

type R2 = { account: string; keyId: string; secret: string; bucket: string; publicBase: string };

function r2Config(): R2 {
  const account = (Deno.env.get("R2_ACCOUNT_ID") || "").trim();
  const keyId = (Deno.env.get("R2_ACCESS_KEY_ID") || "").trim();
  const secret = (Deno.env.get("R2_SECRET_ACCESS_KEY") || "").trim();
  if (!account || !keyId || !secret) throw new Error("R2 is not configured");
  return {
    account, keyId, secret,
    bucket: Deno.env.get("R2_BUCKET") || "yards-media",
    publicBase: (Deno.env.get("R2_PUBLIC_BASE") || "https://audio.yardslovesyou.com").replace(/\/+$/, ""),
  };
}

// Presigned PUT URL (query-string auth). Signs host, content-type and content-length.
async function presignPut(c: R2, key: string, contentType: string, size: number) {
  const host = c.account + ".r2.cloudflarestorage.com";
  const path = "/" + c.bucket + "/" + key.split("/").map(uriEnc).join("/");
  const { amzDate, date } = amzDates();
  const scope = date + "/" + REGION + "/" + SERVICE + "/aws4_request";
  const signedHeaders = "content-length;content-type;host";
  const q: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": c.keyId + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(EXPIRES),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const query = Object.keys(q).sort().map((k) => uriEnc(k) + "=" + uriEnc(q[k])).join("&");
  const canonicalHeaders = "content-length:" + size + "\ncontent-type:" + contentType + "\nhost:" + host + "\n";
  const canonical = ["PUT", path, query, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonical)].join("\n");
  const sig = toHex(await hmac(await signingKey(c.secret, date), toSign));
  return "https://" + host + path + "?" + query + "&X-Amz-Signature=" + sig;
}

// Signed DELETE done by the function itself (header auth)
async function deleteObject(c: R2, key: string) {
  const host = c.account + ".r2.cloudflarestorage.com";
  const path = "/" + c.bucket + "/" + key.split("/").map(uriEnc).join("/");
  const { amzDate, date } = amzDates();
  const scope = date + "/" + REGION + "/" + SERVICE + "/aws4_request";
  const payloadHash = await sha256Hex("");
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = "host:" + host + "\nx-amz-content-sha256:" + payloadHash + "\nx-amz-date:" + amzDate + "\n";
  const canonical = ["DELETE", path, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonical)].join("\n");
  const sig = toHex(await hmac(await signingKey(c.secret, date), toSign));
  const auth = "AWS4-HMAC-SHA256 Credential=" + c.keyId + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + sig;
  const res = await fetch("https://" + host + path, {
    method: "DELETE",
    headers: { "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash, "Authorization": auth },
  });
  if (!res.ok && res.status !== 404) throw new Error("R2 delete failed (" + res.status + ")");
}

function uuid() {
  return crypto.randomUUID();
}

// ---------- handler ----------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  try {
    // 1. Who is calling? (user JWT from the Authorization header)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Please sign in first." }, 401, origin);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: "Bearer " + token } },
      auth: { persistSession: false },
    });
    const { data: u, error: uerr } = await supabase.auth.getUser(token);
    if (uerr || !u || !u.user) return json({ error: "Please sign in again." }, 401, origin);
    const userId = u.user.id;

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch (_) { /* empty body */ }
    const action = String(body.action || "upload");
    const r2 = r2Config();

    // 2a. Upload: validate, rate limit, hand out a presigned PUT URL
    if (action === "upload") {
      const contentType = String(body.contentType || "");
      const size = Number(body.size || 0);
      if (contentType !== "audio/mp4") return json({ error: "Only audio/mp4 (.m4a) files are accepted." }, 400, origin);
      if (!(size > 0) || size > MAX_BYTES) return json({ error: "The file is too large (max 1.5 MB)." }, 400, origin);

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count, error: cerr } = await supabase
        .from("posts").select("id", { count: "exact", head: true })
        .eq("user_id", userId).in("type", ["audio", "gumball"]).gte("created_at", since);
      if (cerr) return json({ error: "Could not check your upload limit." }, 500, origin);
      if ((count || 0) >= MAX_PER_DAY) return json({ error: "You have reached today's upload limit (10). Please try again tomorrow." }, 429, origin);

      const key = "lab/" + userId + "/" + uuid() + ".m4a";
      const uploadUrl = await presignPut(r2, key, contentType, size);
      return json({ uploadUrl, publicUrl: r2.publicBase + "/" + key, key, headers: { "Content-Type": contentType } }, 200, origin);
    }

    // 2b. Delete: only the owner (key contains the user id) or an admin
    if (action === "delete") {
      const url = String(body.url || "");
      const prefix = r2.publicBase + "/";
      if (!url.startsWith(prefix)) return json({ error: "Unknown file." }, 400, origin);
      const key = url.slice(prefix.length);
      if (!/^lab\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.m4a$/i.test(key)) return json({ error: "Unknown file." }, 400, origin);
      let allowed = key.startsWith("lab/" + userId + "/");
      if (!allowed) {
        const { data: isAdmin } = await supabase.rpc("is_admin");   // same check the site uses
        allowed = isAdmin === true;
      }
      if (!allowed) return json({ error: "Not allowed." }, 403, origin);
      await deleteObject(r2, key);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Unknown action." }, 400, origin);
  } catch (e) {
    return json({ error: "Server error: " + (e && (e as Error).message ? (e as Error).message : "unknown") }, 500, origin);
  }
});
