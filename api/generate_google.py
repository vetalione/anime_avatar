import base64
import os
from google import genai
from google.genai import types
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL_ID = "gemini-2.5-flash-image-preview"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/")
async def generate_google(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    image_base64 = body.get("imageBase64")
    anime_title = body.get("animeTitle")
    anime_character = body.get("animeCharacter")

    if not image_base64 or not anime_title:
        return JSONResponse({"error": "Missing required fields: imageBase64 and animeTitle"}, status_code=400)

    # Decode data URL to bytes and detect mime
    mime_type = "image/jpeg"
    try:
        if isinstance(image_base64, str) and image_base64.startswith("data:"):
            header, b64 = image_base64.split(",", 1)
            try:
                mime_type = header.split(":", 1)[1].split(";", 1)[0]
            except Exception:
                mime_type = "image/jpeg"
            image_bytes = base64.b64decode(b64)
        else:
            image_bytes = base64.b64decode(image_base64)
    except Exception:
        return JSONResponse({"error": "Invalid imageBase64"}, status_code=400)

    instruction = (
        "Analyze the provided selfie and extract the person's key facial features, hair color/length/shape, "
        "eye shape/color, skin tone, face structure, and expression. Infer the person's gender from the selfie "
        "and keep it the same in the result. Then generate a new portrait as an original character strictly in "
        f"the visual style of the anime '{anime_title}'. "
        + (f"The character should subtly resemble '{anime_character}' while staying unique. " if anime_character else "")
        + "Match the canonical color palette, linework, shading, composition, and rendering typical for the specified anime. "
        "No text, no watermark, no signature. Upper body portrait on a clean simple background. High resolution, professional digital art, masterpiece quality."
    )

    parts = [
        types.Part.from_text(text=instruction),
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        contents = [types.Content(role="user", parts=parts)]
        config = types.GenerateContentConfig(response_modalities=["IMAGE"])  # image only
        result = client.models.generate_content(
            model=MODEL_ID,
            contents=contents,
            config=config,
        )

        if not getattr(result, "candidates", None):
            return JSONResponse({"error": "No candidates returned"}, status_code=500)

        # find first inline image
        for part in result.candidates[0].content.parts:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                out_mime = inline.mime_type or "image/png"
                b64_image = base64.b64encode(inline.data).decode("utf-8")
                return JSONResponse({
                    "success": True,
                    "image": {
                        "dataUrl": f"data:{out_mime};base64,{b64_image}",
                        "mimeType": out_mime,
                    }
                })

        return JSONResponse({"error": "No image generated"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": f"Gemini error: {str(e)}"}, status_code=500)
