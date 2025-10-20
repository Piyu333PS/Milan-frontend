export default function handler(req, res) {
  res.status(200).json({
    HF_TOKEN: process.env.HF_TOKEN ? "present" : "missing",
    HF_MODEL: process.env.HF_MODEL || "not set",
    note: "Values are masked. This just tells you if envs are wired."
  });
}
