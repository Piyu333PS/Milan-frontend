export default async function handler(req, res) {
  try {
    const resp = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    const json = await resp.json();
    return res.status(200).json(json);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
