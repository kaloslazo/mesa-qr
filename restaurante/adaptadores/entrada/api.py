import asyncio
import io
import logging
import os
from dataclasses import asdict
from pathlib import Path

import segno
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from restaurante.adaptadores.entrada.bots import ComensalesVirtuales
from restaurante.adaptadores.entrada.firma import es_valida, firmar
from restaurante.dominio.errores import ReglaRota
from restaurante.sistema import OPCIONES

# adaptador de entrada: traduce http y websocket a llamadas a los casos de uso

WEB = Path(__file__).resolve().parents[3] / "web"
log = logging.getLogger("mesa-qr")


class QRInvalido(Exception):
    pass


class Unirse(BaseModel):
    nombre: str


class Linea(BaseModel):
    plato_id: str
    cantidad: int = 1


class Pedido(BaseModel):
    comensal: str
    lineas: list[Linea]


class Texto(BaseModel):
    texto: str


class Deseo(BaseModel):
    deseo: str
    sin: list[str] = []
    sin_picante: bool = False


class PagoMesa(BaseModel):
    comensal: str
    monto: float
    medio: str


class Agotado(BaseModel):
    agotado: bool


class CambioAdaptador(BaseModel):
    puerto: str
    opcion: str


class Hora(BaseModel):
    hora: str | None = None


class Llamado(BaseModel):
    comensal: str
    motivo: str


class Bots(BaseModel):
    mesas: int = 6
    cocina: bool = True


def cuenta_json(cuenta):
    if cuenta is None:
        return None
    return {
        "mesa": cuenta.mesa,
        "abierta": cuenta.abierta,
        "comensales": cuenta.comensales,
        "items": [asdict(i) for i in cuenta.items],
        "pagos": [asdict(p) for p in cuenta.pagos],
        "total": cuenta.total,
        "pagado": cuenta.pagado,
        "saldo": cuenta.saldo,
        "llamado": cuenta.llamado,
    }


def _lista(texto):
    return [x for x in (texto or "").split(",") if x]


def crear_api(sistema):
    app = FastAPI(title="Mesa QR")
    secreto = os.getenv("SECRETO_QR", "cambia-esto")
    nombre = os.getenv("NOMBRE_RESTAURANTE", "La Esquina")
    total_mesas = int(os.getenv("MESAS", "8"))
    bots = ComensalesVirtuales(sistema)
    # la interfaz es una app de react ya compilada (frontend/ -> web/)
    app.mount("/assets", StaticFiles(directory=WEB / "assets", check_dir=False), name="assets")

    @app.exception_handler(ReglaRota)
    async def regla_rota(request, error):
        return JSONResponse({"error": str(error)}, status_code=400)

    @app.exception_handler(QRInvalido)
    async def qr_invalido(request, error):
        return JSONResponse({"error": "este QR no es de esta mesa"}, status_code=403)

    @app.exception_handler(Exception)
    async def otro_error(request, error):
        log.exception("error atendiendo %s", request.url.path)
        return JSONResponse({"error": f"no se pudo completar: {error}"}, status_code=503)

    def verificar(mesa, t):
        if not es_valida(mesa, t, secreto):
            raise QRInvalido()

    # paginas

    @app.get("/")
    def inicio():
        return RedirectResponse("/mozo")

    # todas las pantallas son la misma app; ella decide que mostrar segun la ruta
    @app.get("/mesa/{mesa}")
    @app.get("/cocina")
    @app.get("/mozo")
    @app.get("/arquitectura")
    @app.get("/qr")
    def pagina():
        return FileResponse(WEB / "index.html")

    @app.get("/favicon.svg")
    def icono():
        return FileResponse(WEB / "favicon.svg")

    # cliente en su mesa

    @app.get("/api/info")
    def info():
        return {"restaurante": nombre}

    @app.get("/api/carta")
    def carta(idioma: str = "es", sin: str = "", sin_picante: bool = False):
        return sistema.mesa().ver_carta(idioma, _lista(sin), sin_picante)

    @app.post("/api/mesas/{mesa}/unirse")
    def unirse(mesa: int, cuerpo: Unirse, t: str = ""):
        verificar(mesa, t)
        with sistema.candado:
            return cuenta_json(sistema.mesa().unirse(mesa, cuerpo.nombre))

    @app.get("/api/mesas/{mesa}/cuenta")
    def cuenta(mesa: int, t: str = ""):
        verificar(mesa, t)
        return cuenta_json(sistema.mesa().ver_cuenta(mesa))

    @app.post("/api/mesas/{mesa}/pedidos")
    def pedir(mesa: int, cuerpo: Pedido, t: str = ""):
        verificar(mesa, t)
        lineas = [(linea.plato_id, linea.cantidad) for linea in cuerpo.lineas]
        with sistema.candado:
            items = sistema.mesa().pedir(mesa, cuerpo.comensal, lineas)
        return {"items": [asdict(i) for i in items]}

    @app.post("/api/mesas/{mesa}/interpretar")
    def interpretar(mesa: int, cuerpo: Texto, t: str = ""):
        verificar(mesa, t)
        return sistema.mesa().interpretar(cuerpo.texto)

    @app.post("/api/mesas/{mesa}/recomendar")
    def recomendar(mesa: int, cuerpo: Deseo, t: str = ""):
        verificar(mesa, t)
        return sistema.mesa().recomendar(cuerpo.deseo, cuerpo.sin, cuerpo.sin_picante)

    @app.delete("/api/mesas/{mesa}/items/{item_id}")
    def cancelar(mesa: int, item_id: int, comensal: str, t: str = ""):
        verificar(mesa, t)
        with sistema.candado:
            item = sistema.mesa().cancelar(mesa, comensal, item_id)
        return asdict(item)

    @app.get("/api/mesas/{mesa}/dividir")
    def dividir(mesa: int, forma: str, comensal: str = "", items: str = "", t: str = ""):
        verificar(mesa, t)
        ids = [int(x) for x in _lista(items)]
        return sistema.mesa().dividir(mesa, forma, comensal=comensal or None, items=ids)

    @app.post("/api/mesas/{mesa}/pagos")
    def pagar(mesa: int, cuerpo: PagoMesa, t: str = ""):
        verificar(mesa, t)
        with sistema.candado:
            return cuenta_json(sistema.mesa().pagar(mesa, cuerpo.comensal, cuerpo.monto, cuerpo.medio))

    @app.post("/api/mesas/{mesa}/llamar")
    def llamar(mesa: int, cuerpo: Llamado, t: str = ""):
        verificar(mesa, t)
        with sistema.candado:
            return cuenta_json(sistema.mesa().llamar_mozo(mesa, cuerpo.comensal, cuerpo.motivo))

    @app.get("/api/mesas/{mesa}/total")
    def total(mesa: int, moneda: str = "PEN", t: str = ""):
        verificar(mesa, t)
        return sistema.mesa().total_en(mesa, moneda)

    # cocina y barra

    @app.get("/api/cocina")
    def cocina():
        servicio = sistema.cocina()
        return {"pendientes": servicio.pendientes(), "platos": servicio.platos(), **sistema.mozo().hora()}

    @app.post("/api/cocina/{mesa}/{item_id}/avanzar")
    def avanzar(mesa: int, item_id: int):
        with sistema.candado:
            return asdict(sistema.cocina().avanzar(mesa, item_id))

    @app.post("/api/platos/{plato_id}/agotado")
    def agotado(plato_id: str, cuerpo: Agotado):
        with sistema.candado:
            sistema.cocina().marcar_agotado(plato_id, cuerpo.agotado)
        return {"ok": True}

    # mozo y panel de adaptadores

    @app.get("/api/mozo")
    def mozo():
        servicio = sistema.mozo()
        return {"mesas": servicio.mesas(), **servicio.hora(), "bots": bots.activo,
                "total_mesas": total_mesas, "restaurante": nombre}

    @app.get("/api/mozo/{mesa}")
    def detalle_mesa(mesa: int):
        return cuenta_json(sistema.mozo().cuenta(mesa))

    @app.post("/api/mozo/{mesa}/atender")
    def atender(mesa: int):
        with sistema.candado:
            sistema.mozo().atender(mesa)
        return {"ok": True}

    @app.get("/api/sistema")
    def ver_sistema():
        return {"eleccion": sistema.eleccion, "opciones": {p: list(o) for p, o in OPCIONES.items()}}

    @app.post("/api/sistema/adaptador")
    def cambiar_adaptador(cuerpo: CambioAdaptador):
        with sistema.candado:
            try:
                sistema.cambiar(cuerpo.puerto, cuerpo.opcion)
            except ValueError as error:
                raise ReglaRota(str(error)) from error
            sistema.adaptadores["avisos"].publicar("todos", {"tipo": "sistema", **sistema.eleccion})
        return {"eleccion": sistema.eleccion}

    @app.post("/api/sistema/reloj")
    def mover_reloj(cuerpo: Hora):
        with sistema.candado:
            if cuerpo.hora is None:
                sistema.cambiar("reloj", "real")
            else:
                if sistema.eleccion["reloj"] != "simulado":
                    sistema.cambiar("reloj", "simulado")
                sistema.adaptadores["reloj"].ir_a(cuerpo.hora)
            sistema.adaptadores["avisos"].publicar("todos", {"tipo": "reloj"})
        return {"eleccion": sistema.eleccion, **sistema.mozo().hora()}

    @app.post("/api/bots")
    async def iniciar_bots(cuerpo: Bots):
        bots.iniciar(cuerpo.mesas, cuerpo.cocina)
        return {"bots": bots.activo}

    @app.delete("/api/bots")
    async def detener_bots():
        bots.detener()
        return {"bots": bots.activo}

    # qr de cada mesa

    def url_mesa(request, mesa):
        base = os.getenv("URL_PUBLICA") or str(request.base_url).rstrip("/")
        return f"{base}/mesa/{mesa}?t={firmar(mesa, secreto)}"

    @app.get("/api/qr")
    def lista_qr(request: Request):
        return {"restaurante": nombre,
                "mesas": [{"mesa": n, "url": url_mesa(request, n)} for n in range(1, total_mesas + 1)]}

    @app.get("/api/qr/{mesa}.svg")
    def imagen_qr(request: Request, mesa: int):
        salida = io.BytesIO()
        segno.make(url_mesa(request, mesa), error="m").save(salida, kind="svg", scale=8, border=2)
        return Response(salida.getvalue(), media_type="image/svg+xml")

    # avisos en vivo

    @app.websocket("/ws")
    async def avisos(websocket: WebSocket, canales: str = "*"):
        await websocket.accept()
        conexion = sistema.hub.conectar(_lista(canales))

        async def enviar():
            while True:
                await websocket.send_json(await conexion.cola.get())

        async def escuchar():
            while True:
                await websocket.receive_text()

        tareas = [asyncio.create_task(enviar()), asyncio.create_task(escuchar())]
        try:
            await asyncio.wait(tareas, return_when=asyncio.FIRST_COMPLETED)
        finally:
            for tarea in tareas:
                tarea.cancel()
            sistema.hub.desconectar(conexion)

    return app
