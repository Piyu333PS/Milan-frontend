// Next.js API route: Universal image generator proxy + safe fallback
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const upstream = process.env.MILAN_GENERATE_URL || ""; // e.g. https://your-backend.ai/generate
  const apiKey = process.env.MILAN_API_KEY || "";        // optional Bearer token

  const payload = req.body || {};
  try {
    if (upstream) {
      const upr = await fetch(upstream, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const ctype = upr.headers.get("content-type") || "";

      if (!upr.ok) {
        // Bubble up upstream error so the UI can show it
        const body = await safeRead(upr, ctype);
        return res
          .status(upr.status)
          .json({ error: "Upstream error", status: upr.status, body });
      }

      // 1) If upstream sends image bytes directly
      if (ctype.startsWith("image/")) {
        const buf = Buffer.from(await upr.arrayBuffer());
        res.setHeader("Content-Type", ctype);
        return res.send(buf);
      }

      // 2) JSON (many shapes supported)
      if (ctype.includes("application/json")) {
        const data = await upr.json();
        const url =
          data?.imageUrl ||
          data?.url ||
          data?.data?.url ||
          data?.output?.[0] ||
          (data?.imageBase64 && `data:image/png;base64,${stripPrefix(data.imageBase64)}`) ||
          (data?.base64 && `data:image/png;base64,${stripPrefix(data.base64)}`) ||
          // some providers return { images: ["base64...", ...] }
          (Array.isArray(data?.images) && data.images[0] && `data:image/png;base64,${stripPrefix(data.images[0])}`) ||
          // some return array of urls
          (Array.isArray(data) && typeof data[0] === "string" && data[0]);

        if (url) return res.status(200).json({ imageUrl: url });
        return res.status(502).json({ error: "Upstream JSON had no image", upstreamSample: shrink(data) });
      }

      // 3) Text fallback (maybe a URL or data URL)
      const text = await upr.text();
      const trimmed = text.trim();
      if (trimmed.startsWith("data:image") || /^https?:\/\//i.test(trimmed)) {
        return res.status(200).json({ imageUrl: trimmed });
      }

      return res.status(502).json({
        error: "Unsupported upstream content",
        contentType: ctype,
        body: trimmed.slice(0, 1200),
      });
    }

    // No upstream configured → safe demo so UI never fails
    const demo = demoFallbackUrl();
    return res.status(200).json({ imageUrl: demo });
  } catch (e) {
    return res.status(500).json({ error: "Proxy failed", message: e.message });
  }
}

// utils
function stripPrefix(b64) {
  return (b64 || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}
function demoFallbackUrl() {
  const seeds = ["milan1", "milan2", "milan3", "milan4", "milan5"];
  const seed = seeds[Math.floor(Math.random() * seeds.length)];
  return `https://picsum.photos/seed/${seed}/1200/800`;
}
async function safeRead(resp, ctype) {
  try {
    if (ctype.includes("application/json")) return await resp.json();
    return (await resp.text()).slice(0, 2000);
  } catch {
    return "Could not read upstream body";
  }
}
function shrink(obj) {
  try {
    const s = JSON.stringify(obj);
    return s.length > 1200 ? s.slice(0, 1200) + "…" : s;
  } catch {
    return "[unserializable]";
  }
}
