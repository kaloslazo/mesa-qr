import asyncio
from dataclasses import dataclass


@dataclass
class Conexion:
    canales: set
    cola: asyncio.Queue
    bucle: asyncio.AbstractEventLoop


class HubWebSocket:
    # reparte cada aviso a las pantallas suscritas a ese canal
    def __init__(self):
        self.conexiones = []

    def conectar(self, canales):
        conexion = Conexion(set(canales), asyncio.Queue(), asyncio.get_running_loop())
        self.conexiones.append(conexion)
        return conexion

    def desconectar(self, conexion):
        if conexion in self.conexiones:
            self.conexiones.remove(conexion)

    def publicar(self, canal, evento):
        mensaje = {"canal": canal, **evento}
        for conexion in list(self.conexiones):
            if canal == "todos" or canal in conexion.canales or "*" in conexion.canales:
                # puede llamarse desde otro hilo, por eso call_soon_threadsafe
                conexion.bucle.call_soon_threadsafe(conexion.cola.put_nowait, mensaje)


class AvisosConsola:
    # sin pantallas en vivo: solo se imprime en la terminal
    def publicar(self, canal, evento):
        print(f"[aviso] {canal}: {evento}", flush=True)
