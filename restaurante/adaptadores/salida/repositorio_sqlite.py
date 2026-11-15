import json
import sqlite3
import threading
from dataclasses import asdict
from pathlib import Path

from restaurante.dominio.cuenta import Cuenta, Item, Pago


def a_texto(cuenta):
    return json.dumps(asdict(cuenta), ensure_ascii=False)


def desde_texto(texto):
    datos = json.loads(texto)
    return Cuenta(
        mesa=datos["mesa"],
        comensales=datos["comensales"],
        items=[Item(**i) for i in datos["items"]],
        pagos=[Pago(**p) for p in datos["pagos"]],
        abierta=datos["abierta"],
        llamado=datos.get("llamado", ""),
        ultimo_llamado=datos.get("ultimo_llamado", ""),
    )


class RepositorioSqlite:
    # un archivo .db: sobrevive a los reinicios
    def __init__(self, ruta):
        Path(ruta).parent.mkdir(parents=True, exist_ok=True)
        self.conexion = sqlite3.connect(ruta, check_same_thread=False)
        self.candado = threading.Lock()
        with self.candado, self.conexion:
            self.conexion.execute(
                "create table if not exists cuentas ("
                " id integer primary key autoincrement,"
                " mesa integer not null,"
                " abierta integer not null,"
                " datos text not null)"
            )
            self.conexion.execute("create table if not exists agotados (plato_id text primary key)")

    def cuenta_abierta(self, mesa):
        with self.candado:
            fila = self.conexion.execute(
                "select datos from cuentas where mesa = ? and abierta = 1", (mesa,)
            ).fetchone()
        return desde_texto(fila[0]) if fila else None

    def guardar(self, cuenta):
        # solo hay una cuenta abierta por mesa, asi que esa es la que se actualiza
        with self.candado, self.conexion:
            cambiadas = self.conexion.execute(
                "update cuentas set abierta = ?, datos = ? where mesa = ? and abierta = 1",
                (int(cuenta.abierta), a_texto(cuenta), cuenta.mesa),
            ).rowcount
            if cambiadas == 0:
                self.conexion.execute(
                    "insert into cuentas (mesa, abierta, datos) values (?, ?, ?)",
                    (cuenta.mesa, int(cuenta.abierta), a_texto(cuenta)),
                )

    def cuentas_abiertas(self):
        with self.candado:
            filas = self.conexion.execute("select datos from cuentas where abierta = 1").fetchall()
        return [desde_texto(f[0]) for f in filas]

    def agotados(self):
        with self.candado:
            return {f[0] for f in self.conexion.execute("select plato_id from agotados")}

    def marcar_agotado(self, plato_id, agotado):
        with self.candado, self.conexion:
            if agotado:
                self.conexion.execute("insert or ignore into agotados values (?)", (plato_id,))
            else:
                self.conexion.execute("delete from agotados where plato_id = ?", (plato_id,))
