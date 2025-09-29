import base64
import json
import os
from google import genai
from google.genai import types

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL_ID = "gemini-2.5-flash-image-preview"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

def _response(payload, status=200, headers=None):
    merged = {**CORS_HEADERS, **(headers or {})}
    return (json.dumps(payload), status, merged)


def handler(request):
    # CORS preflight
    if request.method == "OPTIONS":
        return ("", 200, CORS_HEADERS)

    if request.method != "POST":
        return _response({"error": "Method not allowed"}, 405)

    # Parse JSON body
    try:
        body = request.get_json(silent=True) or {}
    except Exception:
        try:
            raw = getattr(request, "data", b"{}") or b"{}"
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8", errors="ignore")
            body = json.loads(raw or "{}")
        except Exception:
            body = {}

    image_base64 = body.get("imageBase64")
    anime_title = body.get("animeTitle")
    anime_character = body.get("animeCharacter")

    if not image_base64 or not anime_title:
        return _response({"error": "Missing required fields: imageBase64 and animeTitle"}, 400)

    # Decode data URL to bytes and detect mime type
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
        return _response({"error": "Invalid imageBase64"}, 400)

    # Build prompt
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
            return _response({"error": "No candidates returned"}, 500)

        # Find first inline image
        for p in result.candidates[0].content.parts:
            inline = getattr(p, "inline_data", None)
            if inline and inline.data:
                out_mime = inline.mime_type or "image/png"
                b64_image = base64.b64encode(inline.data).decode("utf-8")
                return _response({
                    "success": True,
                    "image": {
                        "dataUrl": f"data:{out_mime};base64,{b64_image}",
                        "mimeType": out_mime,
                    }
                })

        return _response({"error": "No image generated"}, 500)
    except Exception as e:
        return _response({"error": f"Gemini error: {str(e)}"}, 500)
