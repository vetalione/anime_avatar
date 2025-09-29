import base64
import json
import os
import time
import random
import requests
from http.server import BaseHTTPRequestHandler

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL_ID = "gemini-2.5-flash-image-preview"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent"

class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, extra=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, X-Client-Source")
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
            if not GEMINI_API_KEY:
                return self._write_json({'error': 'GEMINI_API_KEY is not configured'}, 500)

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

            instruction = (
                "Analyze the provided selfie and extract the person's key facial features, hair color/length/shape, "
                "eye shape/color, skin tone, face structure, and expression. Infer the person's gender from the selfie "
                "and keep it the same in the result. Then generate a new portrait as an original character strictly in "
                f"the visual style of the anime '{anime_title}'. "
                + (f"The character should subtly resemble '{anime_character}' while staying unique. " if anime_character else "")
                + "Match the canonical color palette, linework, shading, composition, and rendering typical for the specified anime. "
                "No text, no watermark, no signature. Upper body portrait on a clean simple background. High resolution, professional digital art, masterpiece quality."
            )

            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": instruction},
                            {"inlineData": {"mimeType": mime_type, "data": base64.b64encode(image_bytes).decode("utf-8")}},
                        ],
                    }
                ],
                "generationConfig": {
                    "candidateCount": 1,
                    "responseMimeType": "image/png"
                },
            }

            headers = {
                "x-goog-api-key": GEMINI_API_KEY,
                "Content-Type": "application/json",
            }

            # Single attempt (avoid extra load)
            resp = requests.post(API_URL, headers=headers, json=payload, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                try:
                    parts = data["candidates"][0]["content"]["parts"]
                    # Look for inline image (support both key styles)
                    for part in parts:
                        inline = part.get("inlineData") or part.get("inline_data")
                        if inline and (inline.get("data") or inline.get("data") == ""):
                            b64_image = inline.get("data")
                            if b64_image:
                                out_mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                                return self._write_json({
                                    'success': True,
                                    'image': {
                                        'dataUrl': f'data:{out_mime};base64,{b64_image}',
                                        'mimeType': out_mime,
                                    }
                                }, 200)
                    # If only text parts present, return diagnostic text
                    texts = [p.get("text") for p in parts if p.get("text")]
                    if texts:
                        return self._write_json({'error': texts[0] or 'No image generated'}, 500)
                except Exception:
                    pass
                return self._write_json({'error': 'No image generated'}, 500)

            elif resp.status_code == 429:
                retry_after = resp.headers.get('retry-after')
                secs = int(retry_after) if retry_after and retry_after.isdigit() else None
                return self._write_json({
                    'success': False,
                    'error': 'Rate limit exceeded. Please try again later.',
                    'errorCode': 'RATE_LIMIT_ERROR',
                    'retryAfterSec': secs,
                }, 429)
            else:
                # Forward error details for debugging
                try:
                    err_json = resp.json()
                except Exception:
                    err_json = {'message': resp.text}
                return self._write_json({
                    'success': False,
                    'error': f'Gemini HTTP {resp.status_code}',
                    'details': err_json,
                }, 500)
        except Exception as e:
            return self._write_json({'error': f'Gemini error: {str(e)}'}, 500)
