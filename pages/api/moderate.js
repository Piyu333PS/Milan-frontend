import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Gemini model with strict safety settings
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
        },
      ],
    });

    // Check if content is safe
    const prompt = `Analyze this message for inappropriate content (abusive language, sexual content, harassment, hate speech). 
Message: "${text}"
Respond with only "SAFE" or "UNSAFE"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim().toUpperCase();

    const isSafe = responseText.includes('SAFE') && !responseText.includes('UNSAFE');

    return res.status(200).json({
      safe: isSafe,
      categories: {
        harassment: !isSafe,
        hate_speech: !isSafe,
        sexual: !isSafe,
        violence: !isSafe
      }
    });

  } catch (error) {
    console.error('Moderation Error:', error);
    
    // If Gemini blocks the content due to safety, consider it unsafe
    if (error.message && error.message.includes('SAFETY')) {
      return res.status(200).json({
        safe: false,
        categories: {
          harassment: true,
          hate_speech: true,
          sexual: true,
          violence: true
        }
      });
    }

    return res.status(500).json({ 
      error: 'Moderation check failed' 
    });
  }
}
