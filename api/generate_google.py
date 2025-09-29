import base64
import json
import os
import time
import random
from http.server import BaseHTTPRequestHandler
from google import genai
from google.genai import types

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL_ID = "gemini-2.5-flash-image-preview"

class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, extra=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.end_headers()

    def _write_json(self, payload, status=200):
        self._set_headers(status)
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_OPTIONS(self):
        self._set_headers(200)
        self.wfile.write(b"")

    def do_POST(self):
        try:
            length = int(self.headers.get('content-length', 0))
            raw_body = self.rfile.read(length) if length else b'{}'
            try:
                body = json.loads(raw_body.decode('utf-8'))
            except Exception:
                body = {}

            image_base64 = body.get('imageBase64')
            anime_title = body.get('animeTitle')
            anime_character = body.get('animeCharacter')

            if not image_base64 or not anime_title:
                return self._write_json({'error': 'Missing required fields: imageBase64 and animeTitle'}, 400)

            # Decode image data URL or plain base64
            mime_type = 'image/jpeg'
            try:
                if isinstance(image_base64, str) and image_base64.startswith('data:'):
                    header, b64 = image_base64.split(',', 1)
                    try:
                        mime_type = header.split(':', 1)[1].split(';', 1)[0]
                    except Exception:
                        mime_type = 'image/jpeg'
                    image_bytes = base64.b64decode(b64)
                else:
                    image_bytes = base64.b64decode(image_base64)
            except Exception:
                return self._write_json({'error': 'Invalid imageBase64'}, 400)

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

            client = genai.Client(api_key=GEMINI_API_KEY)
            contents = [types.Content(role='user', parts=parts)]
            config = types.GenerateContentConfig(response_modalities=['IMAGE'])

            # Retry with exponential backoff on 429
            delay = 1.0
            max_retries = 3
            last_error = None
            for attempt in range(max_retries):
                try:
                    result = client.models.generate_content(
                        model=MODEL_ID,
                        contents=contents,
                        config=config,
                    )
                    last_error = None
                    break
                except Exception as e:
                    status = getattr(getattr(e, 'response', None), 'status_code', None)
                    message = str(e)
                    if status == 429 or '429' in message or 'Too Many Requests' in message:
                        last_error = e
                        if attempt < max_retries - 1:
                            time.sleep(delay + random.uniform(0, 0.25))
                            delay *= 2
                            continue
                        else:
                            return self._write_json({
                                'success': False,
                                'error': 'Rate limit exceeded. Please try again later.',
                                'errorCode': 'RATE_LIMIT_ERROR'
                            }, 429)
                    else:
                        return self._write_json({
                            'success': False,
                            'error': f'Gemini error: {message}'
                        }, 500)

            if last_error is not None:
                return self._write_json({'error': 'Failed after retries'}, 500)

            if not getattr(result, 'candidates', None):
                return self._write_json({'error': 'No candidates returned'}, 500)

            for p in result.candidates[0].content.parts:
                inline = getattr(p, 'inline_data', None)
                if inline and inline.data:
                    out_mime = inline.mime_type or 'image/png'
                    b64_image = base64.b64encode(inline.data).decode('utf-8')
                    return self._write_json({
                        'success': True,
                        'image': {
                            'dataUrl': f'data:{out_mime};base64,{b64_image}',
                            'mimeType': out_mime,
                        }
                    }, 200)

            return self._write_json({'error': 'No image generated'}, 500)
        except Exception as e:
            return self._write_json({'error': f'Gemini error: {str(e)}'}, 500)
