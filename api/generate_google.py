import base64
import mimetypes
import os
from google import genai
from google.genai import types
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

@app.post("/")
async def generate_google(request: Request):
    data = await request.json()
    image_base64 = data.get("imageBase64")
    anime_title = data.get("animeTitle")
    anime_character = data.get("animeCharacter")

    if not image_base64 or not anime_title:
        return JSONResponse({"error": "Missing required fields: imageBase64 and animeTitle"}, status_code=400)

    # Prepare inline image bytes and mime type
    mime_type = "image/jpeg"
    try:
        if image_base64.startswith("data:"):
            header, b64 = image_base64.split(",", 1)
            # example header: data:image/png;base64
            try:
                mime_type = header.split(":", 1)[1].split(";", 1)[0]
            except Exception:
                mime_type = "image/jpeg"
            image_bytes = base64.b64decode(b64)
        else:
            image_bytes = base64.b64decode(image_base64)
    except Exception:
        return JSONResponse({"error": "Invalid imageBase64"}, status_code=400)

    # Build instruction prompt
    parts = [
        types.Part.from_text(
            text=(
                f"Analyze the provided selfie and extract the person's key facial features, hair color/length/shape, eye shape/color, skin tone, face structure, and expression. "
                f"Infer the person's gender from the selfie and keep it the same in the result. "
                f"Then generate a new portrait as an original character strictly in the visual style of the anime '{anime_title}'. "
                + (f"The character should subtly resemble '{anime_character}' while staying unique. " if anime_character else "")
                + "Match the canonical color palette, linework, shading, composition, and rendering typical for the specified anime. "
                "No text, no watermark, no signature. Upper body portrait on a clean simple background. "
                "High resolution, professional digital art, masterpiece quality."
            )
        ),
        # Attach the selfie to let the model analyze it
        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
    ]

    client = genai.Client(api_key=GEMINI_API_KEY)
    model = "gemini-2.5-flash-image-preview"
    contents = [types.Content(role="user", parts=parts)]
    generate_content_config = types.GenerateContentConfig(response_modalities=["IMAGE"])  # image only

    images = []
    try:
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if (
                not getattr(chunk, "candidates", None)
                or not chunk.candidates[0].content
                or not chunk.candidates[0].content.parts
            ):
                continue
            part = chunk.candidates[0].content.parts[0]
            if getattr(part, "inline_data", None) and part.inline_data and part.inline_data.data:
                inline_data = part.inline_data
                data_buffer = inline_data.data
                mime = inline_data.mime_type or "image/png"
                b64_image = base64.b64encode(data_buffer).decode("utf-8")
                images.append({
                    "data": b64_image,
                    "mime_type": mime,
                })
    except Exception as e:
        return JSONResponse({"error": f"Gemini error: {str(e)}"}, status_code=500)

    if images:
        # Return only the first image for simplicity
        img = images[0]
        return JSONResponse({
            "success": True,
            "image": {
                "dataUrl": f"data:{img['mime_type']};base64,{img['data']}",
                "mimeType": img["mime_type"],
            },
        })
    return JSONResponse({"error": "No image generated"}, status_code=500)
