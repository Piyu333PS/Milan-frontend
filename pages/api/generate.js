// pages/api/generate.js

async function callHF(url, token, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const { prompt, negativePrompt, width = 1024, height = 1024, steps = 30, guidance = 7 } = req.body || {};

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ ok: false, error: "prompt_required" });
    }

    // ✅ 1. API Token check
    const token = process.env.HF_API_TOKEN || process.env.HF_TOKEN;
    if (!token) {
      return res.status(500).json({ ok: false, error: "missing_HF_API_TOKEN" });
    }

    // ✅ 2. Safe model name from environment
    const model = (process.env.HF_MODEL || "stabilityai/stable-diffusion-xl-base-1.0")
      .trim()
      .replace(/\s+/g, "");

    const payload = {
      inputs: prompt,
      parameters: {
        width,
        height,
        num_inference_steps: steps,
        guidance_scale: guidance,
        negative_prompt: negativePrompt,
      },
      options: { wait_for_model: true },
    };

    const url = `https://api-inference.huggingface.co/models/${model}`;
    console.log(`[MilanAI] Using model: ${model}`);

    let { status, buf } = await callHF(url, token, payload);

    // ✅ 3. Auto fallback if model not found
    if (status === 404) {
      const fallback = "stabilityai/stable-diffusion-xl-base-1.0";
      console.warn(`[MilanAI] Model "${model}" not found. Falling back to "${fallback}"`);
      ({ status, buf } = await callHF(
        `https://api-inference.huggingface.co/models/${fallback}`,
        token,
        payload
      ));
    }

    // ✅ 4. Error handling (401, 500, etc.)
    if (status >= 400) {
      let detail = buf.toString();
      try {
        const json = JSON.parse(buf.toString());
        detail = json?.error || JSON.stringify(json);
      } catch {}
      return res.status(500).json({ ok: false, error: `hf_${status}`, detail });
    }

    // ✅ 5. Parse returned image
    let b64;
    if (buf[0] === 0x7b) {
      const json = JSON.parse(buf.toString());
      b64 = json?.data || json?.image || (json?.images && json.images[0]);
      if (b64) b64 = b64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    } else {
      b64 = buf.toString("base64");
    }

    if (!b64) {
      return res.status(500).json({ ok: false, error: "no_image_returned" });
    }

    return res.status(200).json({ ok: true, image: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error("[MilanAI Error]", e);
    return res.status(500).json({ ok: false, error: "generation_failed", detail: e.message });
  }
}
