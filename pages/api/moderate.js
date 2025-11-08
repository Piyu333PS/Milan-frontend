import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const moderation = await openai.moderations.create({
      input: text
    });

    return res.status(200).json({
      safe: !moderation.results[0].flagged,
      categories: moderation.results[0].categories
    });

  } catch (error) {
    console.error('Moderation Error:', error);
    return res.status(500).json({ 
      error: 'Moderation check failed' 
    });
  }
}
