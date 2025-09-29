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
                            {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode("utf-8")}},
                        ],
                    }
                ],
                "generation_config": {
                    "candidate_count": 1,
                },
            }

            headers = {
                "x-goog-api-key": GEMINI_API_KEY,
                "Content-Type": "application/json",
            }

            # Retry with exponential backoff on 429
            delay = 1.0
            max_retries = 2
            for attempt in range(max_retries):
                resp = requests.post(API_URL, headers=headers, json=payload, timeout=60)
                if resp.status_code == 200:
                    data = resp.json()
                    # Parse first inline image
                    try:
                        parts = data["candidates"][0]["content"]["parts"]
                        for part in parts:
                            inline = part.get("inline_data")
                            if inline and inline.get("data"):
                                out_mime = inline.get("mime_type", "image/png")
                                b64_image = inline["data"]
                                return self._write_json({
                                    'success': True,
                                    'image': {
                                        'dataUrl': f'data:{out_mime};base64,{b64_image}',
                                        'mimeType': out_mime,
                                    }
                                }, 200)
                        # If there is text only
                        text_parts = [p.get("text") for p in parts if p.get("text")]
                        if text_parts:
                            return self._write_json({'error': text_parts[0] or 'No image generated'}, 500)
                    except Exception:
                        pass
                    return self._write_json({'error': 'No image generated'}, 500)
                elif resp.status_code == 429 and attempt < max_retries - 1:
                    retry_after = resp.headers.get('retry-after')
                    wait = float(retry_after) if retry_after and retry_after.isdigit() else (delay + random.uniform(0, 0.25))
                    time.sleep(wait)
                    delay *= 2
                    continue
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

            return self._write_json({'error': 'Failed after retries'}, 500)
        except Exception as e:
            return self._write_json({'error': f'Gemini error: {str(e)}'}, 500)
