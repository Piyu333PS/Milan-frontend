export default async function handler(req, res) {
  const HF_TOKEN = process.env.HF_TOKEN;
  const HF_MODEL = process.env.HF_MODEL || "black-forest-labs/FLUX.1-schnell";

  if (!HF_TOKEN) {
    return res.status(400).json({ ok: false, error: "HF_TOKEN missing" });
  }

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: "a red ball" }),
      }
    );

    const contentType = response.headers.get("content-type");
    let body;

    try {
      body = contentType?.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch {
      body = "Failed to parse response";
    }

    res.status(200).json({
      ok: response.ok,
      status: response.status,
      contentType,
      body,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
