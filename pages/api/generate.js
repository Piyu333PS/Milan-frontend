// ✅ Hugging Face Text → Image API Integration
export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } }, // allow JSON only
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  const HF_MODEL = process.env.HF_MODEL || "stabilityai/sdxl-turbo";

  if (!HF_TOKEN) {
    return res.status(200).json({
      imageUrl: demoFallbackUrl(),
      source: "demo",
      note: "⚠️ HF_TOKEN missing — add it in environment variables.",
    });
  }

  try {
    const {
      prompt = "",
      negative = "",
      size = "1024x1024",
      steps,
      guidance,
    } = req.body || {};

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const [width, height] = parseSize(size);

    // ✅ Build payload for Hugging Face API
    const payload = {
      inputs: prompt,
      options: { wait_for_model: true },
      parameters: {
        width,
        height,
        negative_prompt: negative || undefined,
        num_inference_steps: steps || undefined,
        guidance_scale: guidance || undefined,
      },
    };

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
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

    const contentType = response.headers.get("content-type") || "";

    // ✅ If the response is image data
    if (response.ok && contentType.startsWith("image/")) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString("base64");
      return res.status(200).json({
        imageUrl: `data:${contentType};base64,${base64}`,
        source: "huggingface",
      });
    }

    // ❌ If HF returns JSON error
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    return res.status(502).json({
      error: "Hugging Face generation failed",
      details: errorBody,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while generating image",
      message: error.message,
    });
  }
}

/* ===== Helpers ===== */

function parseSize(size) {
  const [w, h] = String(size || "1024x1024")
    .toLowerCase()
    .split("x")
    .map((v) => parseInt(v, 10));
  return [
    Math.min(Math.max(w || 1024, 512), 1536),
    Math.min(Math.max(h || 1024, 512), 1536),
  ];
}

function demoFallbackUrl() {
  const demos = [
    "https://picsum.photos/seed/milan1/800/800",
    "https://picsum.photos/seed/milan2/800/800",
    "https://picsum.photos/seed/milan3/800/800",
  ];
  return demos[Math.floor(Math.random() * demos.length)];
}
