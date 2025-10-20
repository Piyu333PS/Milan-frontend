// Universal image generator proxy with multiple providers + consistent output
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, negative, size, steps, guidance, mode } = req.body || {};

  // 1) Custom upstream (your own backend) — highest priority
  const UP = process.env.MILAN_GENERATE_URL || "";

  // 2) Replicate
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";

  // 3) HuggingFace
  const HF_TOKEN = process.env.HF_TOKEN || "";
  const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell"; // fast default

  // 4) OpenAI
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
  const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  try {
    // ────────────────────────────────────────────────────────────────────────────
    // A) Your own upstream endpoint (recommended)
    // Expect it to accept JSON and return either:
    // { imageUrl }, or { url }, or { data: { url } }, or raw image bytes, or data URL
    if (UP) {
      const r = await fetch(UP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, negative, size, steps, guidance, mode }),
      });
      return await normalizeAndSend(r, res);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // B) Replicate
    if (REPLICATE_API_TOKEN) {
      // Using Flux Schnell (text-to-image) with simple params
      const model = process.env.REPLICATE_MODEL || "black-forest-labs/flux-schnell";
      const version = process.env.REPLICATE_VERSION || ""; // optional
      const width = pickWidth(size);
      const height = pickHeight(size);

      const body = {
        version: version || undefined,
        input: {
          prompt,
          width,
          height,
          // optional knobs, ignore if model doesn't support
          guidance: guidance || 3,
          num_inference_steps: steps || 25,
          negative_prompt: negative || "",
        },
        // some Replicate routes use "model" instead of version; keeping minimal
        model: version ? undefined : model,
      };

      const rr = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
        },
        body: JSON.stringify(body),
      });

      if (!rr.ok) {
        const msg = await rr.text();
        return res.status(rr.status).json({ error: "Replicate error", detail: msg.slice(0, 2000) });
      }
      const pred = await rr.json();

      // poll until done (very light)
      let predUrl = pred.urls?.get;
      let status = pred.status;
      let output = pred.output;
      let tries = 0;

      while ((status === "starting" || status === "processing") && tries < 40) {
        await sleep(1500);
        const p2 = await fetch(predUrl, {
          headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
        });
        const j2 = await p2.json();
        status = j2.status;
        output = j2.output;
        if (status === "succeeded" || status === "failed" || status === "canceled") break;
        tries++;
      }

      if (status !== "succeeded") {
        return res.status(502).json({ error: "Generation failed", status, output });
      }

      // outputs are usually array of URLs
      const url = Array.isArray(output) ? output[0] : output;
      if (!url) return res.status(502).json({ error: "No output URL from Replicate", output });
      return res.status(200).json({ imageUrl: url, source: "replicate" });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // C) Hugging Face Inference (text-to-image)
    if (HF_TOKEN) {
      const width = pickWidth(size);
      const height = pickHeight(size);
      const payload = {
        inputs: prompt,
        options: { wait_for_model: true },
        parameters: {
          width, height,
          negative_prompt: negative || undefined,
          guidance_scale: guidance || undefined,
          num_inference_steps: steps || undefined,
        },
      };

      const hr = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        body: JSON.stringify(payload),
      });

      if (!hr.ok) {
        const body = await safeRead(hr);
        return res.status(hr.status).json({ error: "HF error", body });
      }

      // HF returns raw image bytes
      const buf = Buffer.from(await hr.arrayBuffer());
      res.setHeader("Content-Type", "image/png");
      return res.send(buf);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // D) OpenAI Images
    if (OPENAI_API_KEY) {
      const [w, h] = (size || "1024x1024").split("x");
      const dim = `${w}x${h}`;
      const body = {
        model: OPENAI_MODEL,
        prompt,
        size: dim,
        // negative prompt not supported directly; ignore
      };

      const or = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!or.ok) {
        const bodyText = await or.text();
        return res.status(or.status).json({ error: "OpenAI error", detail: bodyText.slice(0, 2000) });
      }

      const data = await or.json();
      const url = data?.data?.[0]?.url ?? null;
      const b64 = data?.data?.[0]?.b64_json ?? null;

      if (url) return res.status(200).json({ imageUrl: url, source: "openai-url" });
      if (b64) return res.status(200).json({ imageUrl: `data:image/png;base64,${b64}`, source: "openai-b64" });

      return res.status(502).json({ error: "OpenAI returned no image data", sample: data });
    }

    // ────────────────────────────────────────────────────────────────────────────
    // No provider configured → demo (so UI never breaks)
    return res.status(200).json({ imageUrl: demoFallbackUrl(), source: "demo" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
}

/* helpers */
async function normalizeAndSend(upr, res) {
  const ctype = upr.headers.get("content-type") || "";
  if (!upr.ok) {
    const body = await safeRead(upr, ctype);
    return res.status(upr.status).json({ error: "Upstream error", status: upr.status, body });
  }
  if (ctype.startsWith("image/")) {
    const buf = Buffer.from(await upr.arrayBuffer());
    res.setHeader("Content-Type", ctype);
    return res.send(buf);
  }
  if (ctype.includes("application/json")) {
    const data = await upr.json();
    const url =
      data?.imageUrl ||
      data?.url ||
      data?.data?.url ||
      data?.output?.[0] ||
      (data?.imageBase64 && `data:image/png;base64,${stripPrefix(data.imageBase64)}`) ||
      (data?.base64 && `data:image/png;base64,${stripPrefix(data.base64)}`) ||
      (Array.isArray(data?.images) && data.images[0] && `data:image/png;base64,${stripPrefix(data.images[0])}`) ||
      (Array.isArray(data) && typeof data[0] === "string" && data[0]);
    if (url) return res.status(200).json({ imageUrl: url, source: "upstream" });
    return res.status(502).json({ error: "Upstream JSON had no image", upstreamSample: shrink(data) });
  }
  const text = (await upr.text()).trim();
  if (text.startsWith("data:image") || /^https?:\/\//i.test(text)) {
    return res.status(200).json({ imageUrl: text, source: "upstream-text" });
  }
  return res.status(502).json({ error: "Unsupported upstream response", body: text.slice(0, 1200) });
}

function stripPrefix(b64) {
  return (b64 || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}
function demoFallbackUrl() {
  const seeds = ["milan1","milan2","milan3","milan4","milan5"];
  const seed = seeds[Math.floor(Math.random()*seeds.length)];
  return `https://picsum.photos/seed/${seed}/1200/800`;
}
async function safeRead(resp) {
  try {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await resp.json();
    return (await resp.text()).slice(0, 2000);
  } catch {
    return "Unreadable upstream body";
  }
}
function shrink(obj) {
  try { const s = JSON.stringify(obj); return s.length>1200 ? s.slice(0,1200)+"…" : s; } catch { return "[unserializable]"; }
}
function pickWidth(size)  { const [w] = (size||"1024x1024").split("x").map(n=>parseInt(n,10)); return clamp(w, 512, 1536); }
function pickHeight(size) { const [,h] = (size||"1024x1024").split("x").map(n=>parseInt(n,10)); return clamp(h, 512, 1536); }
function clamp(n, lo, hi){ return Math.min(hi, Math.max(lo, isNaN(n)?1024:n)); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
