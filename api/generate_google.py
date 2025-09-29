import base64
import json
import os
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
                self._set_headers(400)
                self.wfile.write(json.dumps({
                    'error': 'Missing required fields: imageBase64 and animeTitle'
                }).encode('utf-8'))
                return

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
                self._set_headers(400)
                self.wfile.write(json.dumps({'error': 'Invalid imageBase64'}).encode('utf-8'))
                return

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
            result = client.models.generate_content(
                model=MODEL_ID,
                contents=contents,
                config=config,
            )

            if not getattr(result, 'candidates', None):
                self._set_headers(500)
                self.wfile.write(json.dumps({'error': 'No candidates returned'}).encode('utf-8'))
                return

            for p in result.candidates[0].content.parts:
                inline = getattr(p, 'inline_data', None)
                if inline and inline.data:
                    out_mime = inline.mime_type or 'image/png'
                    b64_image = base64.b64encode(inline.data).decode('utf-8')
                    self._set_headers(200)
                    self.wfile.write(json.dumps({
                        'success': True,
                        'image': {
                            'dataUrl': f'data:{out_mime};base64,{b64_image}',
                            'mimeType': out_mime,
                        }
                    }).encode('utf-8'))
                    return

            self._set_headers(500)
            self.wfile.write(json.dumps({'error': 'No image generated'}).encode('utf-8'))
        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({'error': f'Gemini error: {str(e)}'}).encode('utf-8'))
