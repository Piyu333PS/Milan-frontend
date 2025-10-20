// Hugging Face (text-to-image) → returns an image directly
export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } }, // small JSON only
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  const HF_MODEL = process.env.HF_MODEL || "stabilityai/sdxl-turbo";

  if (!HF_TOKEN) {
    // Fall back so UI doesn’t break (but tells you why)
    return res
      .status(200)
      .json({ imageUrl: demoFallbackUrl(), source: "demo", note: "HF_TOKEN missing" });
  }

  try {
    const { prompt = "", negative = "", size = "1024x1024", steps, guidance } =
      (req.body || {});

    const [w, h] = parseSize(size);
    // Build HF payload — most models ignore unsupported keys safely
    const payload = {
      inputs: prompt,
      options: { wait_for_model: true },
      parameters: {
        width: w,
        height: h,
        negative_prompt: negative || undefined,
        // SDXL Turbo is designed for very few steps; leave undefined if not sure
        num_inference_steps: steps || undefined,
        guidance_scale: guidance || undefined,
      },
    };

    const r = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(HF_MODEL)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "image/png",
        },
        body: JSON.stringify(payload),
      }
    );

    const ct = r.headers.get("content-type") || "";
    if (!r.ok) {
      // HF often returns JSON error bodies
      let body;
      try {
        body = ct.includes("application/json") ? await r.json() : await r.text();
      } catch {
        body = "Unparsable error";
      }
      return res.status(502).json({ error: "HF generation failed", status: r.status, body });
    }

    // Success → HF returns raw image bytes
    if (ct.startsWith("image/")) {
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader("Content-Type", ct);
      // cache a bit to speed up re-opens (optional)
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.send(buf);
    }

    // Some models may return JSON with base64 (rare for this endpoint)
    if (ct.includes("application/json")) {
      const data = await r.json();
      const b64 =
        data?.b64_json ||
        data?.imageBase64 ||
        (Array.isArray(data?.images) && data.images[0]);
      if (b64) return res.status(200).json({ imageUrl: `data:image/png;base64,${stripPrefix(b64)}` });
      return res.status(502).json({ error: "No image in HF JSON response", dataSample: shrink(data) });
    }

    // Unexpected content
    const text = await r.text();
    return res.status(502).json({ error: "Unsupported HF response", contentType: ct, body: text.slice(0, 1000) });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: e.message });
  }
}

/* utils */
function parseSize(s) {
  const [w, h] = String(s || "1024x1024").split("x").map((n) => parseInt(n, 10));
  return [clamp(w, 512, 1536), clamp(h, 512, 1536)];
}
function clamp(n, lo, hi) {
  const v = Number.isFinite(n) ? n : 1024;
  return Math.min(hi, Math.max(lo, v));
}
function stripPrefix(b64) {
  return (b64 || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}
function shrink(obj) {
  try {
    const s = JSON.stringify(obj);
    return s.length > 1200 ? s.slice(0, 1200) + "…" : s;
  } catch {
    return "[unserializable]";
  }
}
function demoFallbackUrl() {
  const seeds = ["milan1", "milan2", "milan3", "milan4", "milan5"];
  const seed = seeds[Math.floor(Math.random() * seeds.length)];
  return `https://picsum.photos/seed/${seed}/1200/800`;
}
