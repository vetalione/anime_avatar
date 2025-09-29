import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export default async function handler(req, res) {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { imageBase64, animeTitle, animeCharacter, language } = req.body;

    if (!imageBase64 || !animeTitle) {
      return res.status(400).json({ 
        error: 'Missing required fields: imageBase64 and animeTitle' 
      });
    }

    console.log('🎌 Starting avatar generation:', { animeTitle, animeCharacter, language });

    // Инициализируем AI сервисы
    const genAI = new GoogleGenerativeAI(process.env.VITE_GOOGLE_AI_API_KEY);
    const openai = new OpenAI({
      apiKey: process.env.VITE_OPENAI_API_KEY
    });

    // Шаг 1: Анализируем фото с Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const analysisPrompt = `Analyze this photo and describe the person's key facial features, expression, and overall appearance in detail. Focus on features that would be important for creating an anime avatar. Be specific about hair color, eye shape, face structure, and expression.`;
    
    const imagePart = {
      inlineData: {
        data: imageBase64.split(',')[1], // Remove data URL prefix
        mimeType: 'image/jpeg',
      },
    };
    
    console.log('🔍 Analyzing image with Gemini...');
    const analysisResult = await model.generateContent([analysisPrompt, imagePart]);
    const analysisResponse = await analysisResult.response;
    const personDescription = analysisResponse.text();
    
    console.log('👤 Person analysis completed:', personDescription.substring(0, 100) + '...');

    // Шаг 2: Создаем промпт для DALL-E
    const basePrompt = `Create a high-quality anime avatar in ${animeTitle} art style`;
    const characterPrompt = animeCharacter ? ` resembling ${animeCharacter}` : '';
    const featuresPrompt = ` based on these characteristics: ${personDescription}`;
    const stylePrompt = `. Style: vibrant colors, detailed anime/manga illustration, professional digital art, ${animeTitle} aesthetic, beautiful lighting, masterpiece quality, sharp focus`;
    
    const dallePrompt = (basePrompt + characterPrompt + featuresPrompt + stylePrompt).substring(0, 1000); // DALL-E имеет лимит на промпт
    
    console.log('🎨 DALL-E prompt prepared:', dallePrompt.substring(0, 100) + '...');
    
    // Шаг 3: Генерируем изображение с DALL-E 3
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: dallePrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid"
    });
    
    const generatedImageUrl = imageResponse.data?.[0]?.url;
    
    if (generatedImageUrl) {
      console.log('✅ Image generated successfully!');
      return res.json({ 
        success: true, 
        imageUrl: generatedImageUrl,
        analysis: personDescription 
      });
    } else {
      throw new Error('No image URL received from DALL-E');
    }
    
  } catch (error) {
    console.error('❌ Generation error:', error);
    
    let errorMessage = 'Error generating avatar. Please try again.';
    let errorCode = 'UNKNOWN_ERROR';
    
    if (error.message?.includes('billing') || error.message?.includes('insufficient_quota')) {
      errorMessage = 'OpenAI billing error. Please check your account balance.';
      errorCode = 'BILLING_ERROR';
    } else if (error.message?.includes('rate_limit')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      errorCode = 'RATE_LIMIT_ERROR';
    } else if (error.message?.includes('invalid_api_key')) {
      errorMessage = 'Invalid API key configuration.';
      errorCode = 'INVALID_API_KEY';
    } else if (error.message?.includes('content_policy')) {
      errorMessage = 'Content policy violation. Please try a different image or description.';
      errorCode = 'CONTENT_POLICY_ERROR';
    }
    
    return res.status(500).json({ 
      success: false, 
      error: errorMessage,
      errorCode: errorCode
    });
  }
}