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
    const { imageBase64, animeTitle, animeCharacter } = req.body;
    if (!animeTitle) {
      return res.status(400).json({ error: 'Missing required field: animeTitle' });
    }

    console.log('🎌 Starting avatar generation (OpenAI):', { hasImage: !!imageBase64, animeTitle, animeCharacter });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Optionally analyze selfie to infer facial features and gender
    let personDescription = '';
    if (imageBase64) {
      try {
        const dataUrl = imageBase64.startsWith('data:')
          ? imageBase64
          : `data:image/jpeg;base64,${imageBase64}`;

        const analysis = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a precise vision assistant. Analyze selfies and return a concise English summary of facial features and inferred gender.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this selfie and summarize key facial features (hair color/length/style, eye shape/color, skin tone, face structure, expression). Infer the person\'s gender. Keep it concise in one paragraph.' },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }
          ],
          temperature: 0.3,
          max_tokens: 250
        });
        personDescription = analysis.choices?.[0]?.message?.content?.trim() || '';
      } catch (visionErr) {
        console.warn('⚠️ OpenAI selfie analysis failed, continuing without features:', visionErr?.message);
      }
    }

    // Detailed English prompt for DALL-E to enforce anime style and portrait
    let dallePrompt = `Create a high-quality upper-body portrait of an original anime character in the recognizable visual style of "${animeTitle}".`;
    if (animeCharacter) {
      dallePrompt += ` The character should subtly resemble "${animeCharacter}" while staying unique.`;
    }
    if (personDescription) {
      dallePrompt += ` Base the facial features on: ${personDescription}.`;
      dallePrompt += ` Maintain the same gender as inferred from the selfie.`;
    } else {
      dallePrompt += ` Maintain a natural, realistic gender presentation appropriate for the requested style.`;
    }
    dallePrompt += ` Match the canonical color palette, line art weight, shading, composition, and background treatment typical for "${animeTitle}" (use widely recognized references for this anime style).`;
    dallePrompt += ` Clean simple background, no text, no watermark, no signature. Professional digital art, sharp focus, high resolution.`;
    dallePrompt = dallePrompt.substring(0, 1000);

    console.log('🎨 DALL-E prompt prepared:', dallePrompt.substring(0, 200) + '...');

    // Generate image with DALL-E 3
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid'
    });

    const generatedImageUrl = imageResponse.data?.[0]?.url;

    if (generatedImageUrl) {
      console.log('✅ Image generated successfully (OpenAI)!');
      return res.json({ 
        success: true, 
        imageUrl: generatedImageUrl
      });
    } else {
      throw new Error('No image URL received from DALL-E');
    }
  } catch (error) {
    console.error('❌ Generation error (OpenAI):', error);
    
    let errorMessage = 'Error generating avatar. Please try again.';
    let errorCode = 'UNKNOWN_ERROR';
    
    const msg = error?.message || '';
    if (msg.includes('billing') || msg.includes('insufficient_quota')) {
      errorMessage = 'OpenAI billing error. Please check your account balance.';
      errorCode = 'BILLING_ERROR';
    } else if (msg.includes('rate_limit')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      errorCode = 'RATE_LIMIT_ERROR';
    } else if (msg.includes('invalid_api_key')) {
      errorMessage = 'Invalid API key configuration.';
      errorCode = 'INVALID_API_KEY';
    } else if (msg.includes('content_policy')) {
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