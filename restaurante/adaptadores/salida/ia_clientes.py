import json
import os

import httpx


class IANoDisponible(Exception):
    # el proveedor no respondio, no hay llave o devolvio algo que no sirve
    pass


def _json_de(texto):
    # los modelos a veces envuelven el json en texto o en ```
    inicio, fin = texto.find("{"), texto.rfind("}")
    if inicio == -1 or fin == -1:
        raise IANoDisponible("la respuesta no trae json")
    try:
        return json.loads(texto[inicio : fin + 1])
    except json.JSONDecodeError as error:
        raise IANoDisponible("json mal formado") from error


def _post(nombre, url, segundos, **kwargs):
    try:
        respuesta = httpx.post(url, timeout=segundos, **kwargs)
    except httpx.HTTPError as error:
        raise IANoDisponible(f"{nombre} no responde") from error
    if respuesta.status_code == 429:
        raise IANoDisponible(f"{nombre} llegó a su límite gratis")
    if respuesta.status_code != 200:
        raise IANoDisponible(f"{nombre} respondió {respuesta.status_code}")
    return respuesta.json()


class ClienteGroq:
    nombre = "groq"

    def __init__(self):
        self.llave = os.getenv("GROQ_API_KEY", "")
        self.modelo = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    def pedir_json(self, instrucciones, mensaje):
        if not self.llave:
            raise IANoDisponible("falta GROQ_API_KEY")
        datos = _post(
            self.nombre,
            "https://api.groq.com/openai/v1/chat/completions",
            10,
            headers={"Authorization": f"Bearer {self.llave}"},
            json={
                "model": self.modelo,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": instrucciones},
                    {"role": "user", "content": mensaje},
                ],
            },
        )
        return _json_de(datos["choices"][0]["message"]["content"])


class ClienteGemini:
    nombre = "gemini"

    def __init__(self):
        self.llave = os.getenv("GEMINI_API_KEY", "")
        self.modelo = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    def pedir_json(self, instrucciones, mensaje):
        if not self.llave:
            raise IANoDisponible("falta GEMINI_API_KEY")
        datos = _post(
            self.nombre,
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.modelo}:generateContent",
            15,
            headers={"x-goog-api-key": self.llave},
            json={
                "systemInstruction": {"parts": [{"text": instrucciones}]},
                "contents": [{"role": "user", "parts": [{"text": mensaje}]}],
                "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
            },
        )
        try:
            texto = datos["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as error:
            raise IANoDisponible("gemini no devolvió texto") from error
        return _json_de(texto)


class ClienteOllama:
    # modelo que corre en la propia laptop: funciona sin internet
    nombre = "local"

    def __init__(self):
        self.url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.modelo = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:3b")

    def pedir_json(self, instrucciones, mensaje):
        datos = _post(
            "el modelo local",
            f"{self.url}/api/chat",
            float(os.getenv("OLLAMA_SEGUNDOS", "30")),
            json={
                "model": self.modelo,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0},
                "messages": [
                    {"role": "system", "content": instrucciones},
                    {"role": "user", "content": mensaje},
                ],
            },
        )
        return _json_de(datos["message"]["content"])
