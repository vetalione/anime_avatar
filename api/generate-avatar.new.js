import OpenAI from 'openai';

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { animeTitle, animeCharacter } = req.body;
    if (!animeTitle) {
      return res.status(400).json({ error: 'Missing required field: animeTitle' });
    }

    console.log('🎌 Starting avatar generation (OpenAI only):', { animeTitle, animeCharacter });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build prompt for DALL-E
    const basePrompt = `Create a high-quality anime avatar in ${animeTitle} art style`;
    const characterPrompt = animeCharacter ? ` resembling ${animeCharacter}` : '';
    const stylePrompt = `. Style: vibrant colors, detailed anime/manga illustration, professional digital art, ${animeTitle} aesthetic, beautiful lighting, masterpiece quality, sharp focus`;
    const dallePrompt = (basePrompt + characterPrompt + stylePrompt).substring(0, 1000);

    console.log('🎨 DALL-E prompt prepared:', dallePrompt.substring(0, 100) + '...');

    // Generate image with DALL-E 3
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
        imageUrl: generatedImageUrl
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
