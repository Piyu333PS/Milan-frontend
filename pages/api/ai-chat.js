import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    const systemPrompt = `You are ${aiName}, a friendly ${aiGender} chat partner on a dating app called Milan.

Rules:
- Be warm, casual, and engaging
- Keep responses short (1-3 sentences)
- Use Hinglish naturally (mix of Hindi and English)
- Match user's language style
- Avoid personal info, phone numbers, or meeting requests
- If user gets inappropriate, politely redirect
- Be conversational like a real person
- Show interest in the conversation
- Ask questions occasionally to keep chat flowing

Examples:
User: "Hey, kaise ho?"
You: "Hey! Main theek hoon, thanks! Tum batao, kya chal raha hai? 😊"

User: "Bore ho raha hu"
You: "Arre! Toh kuch interesting baat karte hain... tum kya karte ho usually when you're free?"`;

    // Build conversation context
    let contextMessages = '';
    if (conversationHistory.length > 0) {
      const recentHistory = conversationHistory.slice(-8); // Last 4 exchanges
      contextMessages = recentHistory.map(msg => 
        `${msg.role === 'user' ? 'User' : aiName}: ${msg.content}`
      ).join('\n');
    }

    // Final prompt with context
    const fullPrompt = `${systemPrompt}

${contextMessages ? `Previous conversation:\n${contextMessages}\n` : ''}
User: ${message}
${aiName}:`;

    // Initialize Gemini model with safety settings
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 150,
      },
    });

    // Generate response
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    const aiResponse = response.text().trim();

    // Return response
    return res.status(200).json({
      success: true,
      message: aiResponse,
      aiName: aiName,
      aiGender: aiGender,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Gemini Error:', error);
    
    // Handle safety blocks
    if (error.message && error.message.includes('SAFETY')) {
      return res.status(200).json({
        success: true,
        message: 'Hey! Chalo kuch aur interesting baat karte hain... 😊',
        aiName: userGender === 'male' ? 'Priya' : 'Rahul',
        aiGender: userGender === 'male' ? 'female' : 'male',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      success: false,
      error: 'AI service temporarily unavailable',
      message: 'Hey! Thoda connection issue hai, ek second... 😅'
    });
  }
}
