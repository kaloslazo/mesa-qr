import asyncio
import logging
import random

from restaurante.dominio.errores import ReglaRota

# comensales virtuales: otro adaptador de entrada.
# usan los mismos casos de uso que la web, sin pasar por http

NOMBRES = ["Lucía", "Mateo", "Valeria", "Diego", "Camila", "Joaquín", "Renata", "Sebastián",
           "Mía", "Thiago", "Ximena", "Gael", "Fernanda", "Bruno", "Alessia", "Rodrigo"]

log = logging.getLogger("mesa-qr.bots")


class ComensalesVirtuales:
    def __init__(self, sistema):
        self.sistema = sistema
        self.tarea = None

    @property
    def activo(self):
        return self.tarea is not None and not self.tarea.done()

    def iniciar(self, mesas=6, cocina=True):
        if not self.activo:
            self.tarea = asyncio.create_task(self._correr(mesas, cocina))

    def detener(self):
        if self.activo:
            self.tarea.cancel()
        self.tarea = None

    async def _correr(self, mesas, cocina):
        # la mesa 1 queda libre para personas de verdad
        tareas = [asyncio.create_task(self._mesa(n)) for n in range(2, 2 + mesas)]
        if cocina:
            tareas.append(asyncio.create_task(self._cocinero()))
        try:
            await asyncio.gather(*tareas)
        finally:
            for tarea in tareas:
                tarea.cancel()

    def _usar(self, accion):
        with self.sistema.candado:
            try:
                return accion()
            except ReglaRota as error:
                log.info("regla: %s", error)
            except Exception as error:
                log.warning("fallo: %s", error)

    async def _mesa(self, mesa):
        await asyncio.sleep(random.uniform(0, 4))
        while True:
            grupo = random.sample(NOMBRES, k=random.randint(2, 4))
            for nombre in grupo:
                self._usar(lambda: self.sistema.mesa().unirse(mesa, nombre))
                await asyncio.sleep(random.uniform(0.5, 2))

            for _ in range(random.randint(2, 4)):
                await asyncio.sleep(random.uniform(4, 10))
                self._usar(lambda: self._pedir_algo(mesa, random.choice(grupo)))

            # esperan a que les sirvan (o se cansan) y pagan lo suyo
            for _ in range(30):
                cuenta = self._usar(lambda: self.sistema.mesa().ver_cuenta(mesa))
                if not cuenta or all(i.estado == "servido" for i in cuenta.items):
                    break
                await asyncio.sleep(3)
            await self._pagar(mesa)
            await asyncio.sleep(random.uniform(6, 14))

    def _pedir_algo(self, mesa, comensal):
        servicio = self.sistema.mesa()
        platos = servicio.ver_carta()["platos"]
        elegidos = random.sample(platos, k=min(len(platos), random.randint(1, 2)))
        lineas = [(p.id, random.randint(1, 2)) for p in elegidos]
        return servicio.pedir(mesa, comensal, lineas)

    async def _pagar(self, mesa):
        for _ in range(10):
            cuenta = self._usar(lambda: self.sistema.mesa().ver_cuenta(mesa))
            if not cuenta:
                return
            partes = self._usar(lambda: self.sistema.mesa().dividir(mesa, "consumo")) or {}
            medios = ["yape", "tarjeta", "efectivo"]
            for comensal, monto in partes.items():
                if monto > 0:
                    self._usar(lambda: self.sistema.mesa().pagar(mesa, comensal, monto, random.choice(medios)))
                    await asyncio.sleep(random.uniform(0.5, 1.5))
            await asyncio.sleep(4)

    async def _cocinero(self):
        # avanza un plato cada pocos segundos, como una cocina que trabaja sola
        while True:
            await asyncio.sleep(random.uniform(1, 2))
            pendientes = self._usar(lambda: self.sistema.cocina().pendientes()) or []
            if pendientes:
                item = pendientes[0]
                self._usar(lambda: self.sistema.cocina().avanzar(item["mesa"], item["id"]))
