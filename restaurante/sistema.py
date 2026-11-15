import os
import threading
from pathlib import Path

from dotenv import load_dotenv

from restaurante.adaptadores.salida.avisos import AvisosConsola, HubWebSocket
from restaurante.adaptadores.salida.carta import CartaGoogleSheets, CartaJson
from restaurante.adaptadores.salida.ia_clientes import ClienteGemini, ClienteGroq, ClienteOllama
from restaurante.adaptadores.salida.mesero import (
    InterpreteConRespaldo,
    InterpreteIA,
    InterpretePalabras,
    RecomendadorConRespaldo,
    RecomendadorIA,
    RecomendadorPalabras,
    TraductorFijo,
    TraductorIA,
)
from restaurante.adaptadores.salida.pagos import PagoSimulado
from restaurante.adaptadores.salida.reloj import RelojReal, RelojSimulado
from restaurante.adaptadores.salida.repositorio_memoria import RepositorioMemoria
from restaurante.adaptadores.salida.repositorio_sqlite import RepositorioSqlite
from restaurante.adaptadores.salida.tipo_cambio import CambioExchangeRate, CambioFijo
from restaurante.aplicacion.casos_de_uso import ServicioCocina, ServicioMesa, ServicioMozo

RAIZ = Path(__file__).resolve().parent.parent
DATOS = RAIZ / "datos"
load_dotenv(RAIZ / ".env")


def _ia(opcion):
    # devuelve el par (interprete, recomendador) para la opcion elegida
    if opcion == "palabras":
        return InterpretePalabras(), RecomendadorPalabras()
    clientes = {"groq": ClienteGroq(), "gemini": ClienteGemini(), "local": ClienteOllama()}
    if opcion == "respaldo":
        orden = [clientes["groq"], clientes["gemini"], clientes["local"]]
        return (
            InterpreteConRespaldo([InterpreteIA(c) for c in orden] + [InterpretePalabras()]),
            RecomendadorConRespaldo([RecomendadorIA(c) for c in orden] + [RecomendadorPalabras()]),
        )
    cliente = clientes[opcion]
    return InterpreteConRespaldo([InterpreteIA(cliente)]), RecomendadorConRespaldo([RecomendadorIA(cliente)])


def _traductor_ia():
    clientes = [ClienteGroq(), ClienteGemini(), ClienteOllama()]
    return TraductorIA(clientes, respaldo=TraductorFijo(DATOS / "traducciones.json"))


# cada puerto con sus adaptadores posibles. cambiar de tecnologia = elegir otra opcion
OPCIONES = {
    "carta": {
        "json": lambda s: CartaJson(DATOS / "carta.json"),
        "sheets": lambda s: CartaGoogleSheets(os.getenv("CARTA_SHEETS_URL", "")),
    },
    "repositorio": {
        "sqlite": lambda s: RepositorioSqlite(os.getenv("RUTA_DB", str(DATOS / "restaurante.db"))),
        "memoria": lambda s: RepositorioMemoria(),
    },
    "pagos": {
        "simulado": lambda s: PagoSimulado(),
        "caido": lambda s: PagoSimulado(tasa_rechazo=1.0),
    },
    "avisos": {
        "websocket": lambda s: s.hub,
        "consola": lambda s: AvisosConsola(),
    },
    "reloj": {
        "real": lambda s: RelojReal(),
        "simulado": lambda s: RelojSimulado(),
    },
    "ia": {
        "respaldo": lambda s: _ia("respaldo"),
        "groq": lambda s: _ia("groq"),
        "gemini": lambda s: _ia("gemini"),
        "local": lambda s: _ia("local"),
        "palabras": lambda s: _ia("palabras"),
    },
    "traductor": {
        "fijo": lambda s: TraductorFijo(DATOS / "traducciones.json"),
        "ia": lambda s: _traductor_ia(),
    },
    "cambio": {
        "exchangerate": lambda s: CambioExchangeRate(),
        "fijo": lambda s: CambioFijo(),
    },
}

POR_DEFECTO = {
    "carta": "json",
    "repositorio": "sqlite",
    "pagos": "simulado",
    "avisos": "websocket",
    "reloj": "real",
    "ia": "respaldo",
    "traductor": "fijo",
    "cambio": "exchangerate",
}


def eleccion_del_env():
    return {puerto: os.getenv(puerto.upper(), opcion) for puerto, opcion in POR_DEFECTO.items()}


class Sistema:
    # arma la app: decide que adaptador va en cada puerto
    def __init__(self, eleccion):
        self.hub = HubWebSocket()
        self.candado = threading.RLock()
        self.eleccion = {}
        self.adaptadores = {}
        for puerto, opcion in eleccion.items():
            self.cambiar(puerto, opcion)

    def cambiar(self, puerto, opcion):
        if opcion not in OPCIONES.get(puerto, {}):
            raise ValueError(f"no existe la opción {opcion} para {puerto}")
        self.adaptadores[puerto] = OPCIONES[puerto][opcion](self)
        self.eleccion[puerto] = opcion

    def mesa(self):
        a = self.adaptadores
        interprete, recomendador = a["ia"]
        return ServicioMesa(a["repositorio"], a["carta"], a["reloj"], a["avisos"], a["pagos"],
                            interprete, recomendador, a["traductor"], a["cambio"])

    def cocina(self):
        a = self.adaptadores
        return ServicioCocina(a["repositorio"], a["carta"], a["avisos"])

    def mozo(self):
        a = self.adaptadores
        return ServicioMozo(a["repositorio"], a["reloj"], a["avisos"])

