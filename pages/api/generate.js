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
    const {
      prompt,
      negativePrompt,
      width = 1024,
      height = 1024,
      steps = 30,
      guidance = 7,
    } = req.body || {};

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({ ok: false, error: "prompt_required" });
    }

    const token = process.env.HF_API_TOKEN;
    if (!token) {
      return res
        .status(500)
        .json({ ok: false, error: "missing_HF_API_TOKEN" });
    }

    // TRIM the model to remove stray spaces/newlines from env
    const envModel =
      (process.env.HF_MODEL || "stabilityai/stable-diffusion-xl-base-1.0").trim();
    const model = envModel.replace(/\s+/g, ""); // collapse any stray whitespace
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
    console.log("[MilanAPI] Using model:", model); // visible in Vercel logs

    let { status, buf } = await callHF(url, token, payload);

    // If model not found, auto-fallback once to SDXL base
    if (status === 404) {
      const fallback = "stabilityai/stable-diffusion-xl-base-1.0";
      console.warn(
        `[MilanAPI] Model 404 for "${model}". Falling back to "${fallback}"`
      );
      ({ status, buf } = await callHF(
        `https://api-inference.huggingface.co/models/${fallback}`,
        token,
        payload
      ));
    }

    if (status >= 400) {
      const maybeJson = buf[0] === 0x7b ? JSON.parse(buf.toString()) : null;
      const detail = maybeJson ? JSON.stringify(maybeJson) : buf.toString();
      return res
        .status(500)
        .json({ ok: false, error: `hf_${status}`, detail, model });
    }

    // Interpret image bytes vs JSON base64
    let b64;
    if (buf[0] === 0x7b) {
      const j = JSON.parse(buf.toString());
      b64 = (j?.data || j?.image || (j?.images && j.images[0]))?.replace(
        /^data:image\/[a-zA-Z+]+;base64,/,
        ""
      );
    } else {
      b64 = buf.toString("base64");
    }

    if (!b64) {
      return res.status(500).json({ ok: false, error: "no_image_returned" });
    }

    return res
      .status(200)
      .json({ ok: true, image: `data:image/png;base64,${b64}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "generation_failed" });
  }
}
