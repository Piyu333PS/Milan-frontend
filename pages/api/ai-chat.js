import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, userGender, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set AI gender opposite to user
    const aiGender = userGender === 'male' ? 'female' : 'male';
    const aiName = aiGender === 'female' ? 'Priya' : 'Rahul';

    // System prompt
    const systemPrompt = `You are ${aiName}, a friendly ${aiGender} chat partner on a dating app.

Rules:
- Be warm, casual, and engaging
- Keep responses short (1-3 sentences)
- Use Hinglish naturally (mix of Hindi and English)
- Match user's language style
- Avoid personal info, phone numbers, or meeting requests
- If user gets inappropriate, politely redirect
- Be conversational like a real person

Examples:
User: "Hey, kaise ho?"
You: "Hey! Main theek hoon, thanks! Tum batao, kya chal raha hai? 😊"`;

    // Prepare messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.8,
      max_tokens: 150,
      presence_penalty: 0.6,
      frequency_penalty: 0.3
    });

    const aiResponse = response.choices[0].message.content;

    // Return response
    return res.status(200).json({
      success: true,
      message: aiResponse,
      aiName: aiName,
      aiGender: aiGender,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('OpenAI Error:', error);
    return res.status(500).json({
      success: false,
      error: 'AI service temporarily unavailable',
      message: 'Hey! Thoda connection issue hai, ek second... 😅'
    });
  }
}
