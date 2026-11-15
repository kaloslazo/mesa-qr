import time

import httpx


class CambioExchangeRate:
    # tasas reales, gratis y sin llave
    URL = "https://open.er-api.com/v6/latest/PEN"

    def __init__(self, segundos_cache=600):
        self.segundos_cache = segundos_cache
        self._tasas = None
        self._leidas = 0.0

    def por_sol(self, moneda):
        if self._tasas is None or time.monotonic() - self._leidas > self.segundos_cache:
            respuesta = httpx.get(self.URL, timeout=5)
            respuesta.raise_for_status()
            self._tasas = respuesta.json()["rates"]
            self._leidas = time.monotonic()
        return self._tasas[moneda]


class CambioFijo:
    # tasas aproximadas a mano, para cuando no hay internet
    TASAS = {"USD": 0.29, "EUR": 0.25}

    def por_sol(self, moneda):
        return self.TASAS[moneda]
