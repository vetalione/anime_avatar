import base64
import mimetypes
import os
from google import genai
from google.genai import types
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

@app.post("/api/generate_google")
async def generate_google(request: Request):
    data = await request.json()
    prompt = data.get("prompt")
    if not prompt:
        return JSONResponse({"error": "Missing prompt"}, status_code=400)

    client = genai.Client(api_key=GEMINI_API_KEY)
    model = "gemini-2.5-flash-image-preview"
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
    )

    file_index = 0
    images = []
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        if (
            chunk.candidates is None
            or chunk.candidates[0].content is None
            or chunk.candidates[0].content.parts is None
        ):
            continue
        part = chunk.candidates[0].content.parts[0]
        if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
            inline_data = part.inline_data
            data_buffer = inline_data.data
            file_extension = mimetypes.guess_extension(inline_data.mime_type)
            b64_image = base64.b64encode(data_buffer).decode("utf-8")
            images.append({
                "data": b64_image,
                "mime_type": inline_data.mime_type,
                "file_extension": file_extension or ".png"
            })
        elif hasattr(chunk, "text") and chunk.text:
            # Optionally collect text responses
            pass
    if images:
        return JSONResponse({"images": images})
    return JSONResponse({"error": "No image generated"}, status_code=500)
