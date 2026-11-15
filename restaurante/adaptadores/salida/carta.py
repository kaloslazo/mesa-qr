import csv
import io
import json
import time
from pathlib import Path

import httpx

from restaurante.dominio.plato import Plato


def _precio(valor):
    try:
        return float(str(valor).replace(",", "."))
    except (TypeError, ValueError):
        return None


def _lista(valor):
    # "gluten; lacteos" -> ["gluten", "lacteos"]
    return [x.strip().lower() for x in str(valor).replace(",", ";").split(";") if x.strip()]


def plato_desde_dict(datos):
    alergenos = datos.get("alergenos")
    return Plato(
        id=str(datos.get("id", "")).strip(),
        nombre=str(datos.get("nombre", "")).strip(),
        precio=_precio(datos.get("precio")),
        categoria=str(datos.get("categoria", "")).strip().lower(),
        alergenos=list(alergenos) if isinstance(alergenos, list) else None,
        descripcion=str(datos.get("descripcion", "")).strip(),
        picante=bool(datos.get("picante", False)),
        alias=list(datos.get("alias", [])),
        seccion=str(datos.get("seccion", "")).strip().lower(),
        foto=str(datos.get("foto", "")).strip(),
    )


def plato_desde_fila(fila):
    # en la hoja: celda vacia = alergenos sin declarar, "ninguno" = no tiene
    celda = (fila.get("alergenos") or "").strip()
    if not celda:
        alergenos = None
    elif celda.lower() == "ninguno":
        alergenos = []
    else:
        alergenos = _lista(celda)
    return Plato(
        id=(fila.get("id") or "").strip(),
        nombre=(fila.get("nombre") or "").strip(),
        precio=_precio(fila.get("precio")),
        categoria=(fila.get("categoria") or "").strip().lower(),
        alergenos=alergenos,
        descripcion=(fila.get("descripcion") or "").strip(),
        picante=(fila.get("picante") or "").strip().lower() in ("si", "sí", "x", "true", "1"),
        alias=_lista(fila.get("alias") or ""),
        seccion=(fila.get("seccion") or "").strip().lower(),
        foto=(fila.get("foto") or "").strip(),
    )


class CartaJson:
    # la carta en un archivo del proyecto
    def __init__(self, ruta):
        self.ruta = Path(ruta)

    def platos(self):
        datos = json.loads(self.ruta.read_text(encoding="utf-8"))
        return [plato_desde_dict(d) for d in datos["platos"]]


class CartaGoogleSheets:
    # la carta en una hoja de google publicada como csv; el dueño la edita sin tocar codigo
    def __init__(self, url, segundos_cache=5):
        if not url:
            raise ValueError("falta CARTA_SHEETS_URL en el .env")
        self.url = url
        self.segundos_cache = segundos_cache
        self._platos = None
        self._leida = 0.0

    def platos(self):
        if self._platos is not None and time.monotonic() - self._leida < self.segundos_cache:
            return self._platos
        try:
            respuesta = httpx.get(self.url, timeout=5, follow_redirects=True)
            respuesta.raise_for_status()
            filas = csv.DictReader(io.StringIO(respuesta.content.decode("utf-8-sig")))
            self._platos = [plato_desde_fila(f) for f in filas]
            self._leida = time.monotonic()
        except httpx.HTTPError:
            # si google no responde, se sigue con la ultima carta que se leyo
            if self._platos is None:
                raise
        return self._platos
