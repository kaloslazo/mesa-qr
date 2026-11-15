from dataclasses import asdict, dataclass

from restaurante.dominio.cuenta import MAXIMO_POR_PLATO, Cuenta
from restaurante.dominio.division import dividir
from restaurante.dominio.errores import ReglaRota
from restaurante.dominio.horario import es_happy_hour, tiene_promo
from restaurante.dominio.plato import carta_visible, restricciones

# puertos de entrada: un servicio por cada tipo de usuario.
# reciben los puertos de salida ya armados; no saben que adaptador hay detras


@dataclass
class PlatoEnCarta:
    id: str
    nombre: str
    descripcion: str
    precio: float
    categoria: str
    alergenos: list[str]
    picante: bool
    promo: bool
    seccion: str
    foto: str


class ServicioMesa:
    # lo que hace un cliente desde su mesa
    def __init__(self, repo, carta, reloj, avisos, pagos, interprete, recomendador, traductor, cambio):
        self.repo = repo
        self.carta = carta
        self.reloj = reloj
        self.avisos = avisos
        self.pagos = pagos
        self.interprete = interprete
        self.recomendador = recomendador
        self.traductor = traductor
        self.cambio = cambio

    def _validos(self):
        return [p for p in self.carta.platos() if p.es_valido()]

    def _cuenta(self, mesa):
        cuenta = self.repo.cuenta_abierta(mesa)
        if not cuenta:
            raise ReglaRota("la mesa no tiene una cuenta abierta")
        return cuenta

    def _en_carta(self, plato, ahora, nombre=None, descripcion=None):
        return PlatoEnCarta(
            id=plato.id,
            nombre=nombre or plato.nombre,
            descripcion=descripcion if descripcion is not None else plato.descripcion,
            precio=plato.precio,
            categoria=plato.categoria,
            alergenos=plato.alergenos,
            picante=plato.picante,
            promo=tiene_promo(plato, ahora),
            seccion=plato.seccion,
            foto=plato.foto,
        )

    def ver_carta(self, idioma="es", sin_alergenos=(), sin_picante=False):
        ahora = self.reloj.ahora()
        platos = carta_visible(self.carta.platos(), self.repo.agotados(), sin_alergenos, sin_picante)
        nombres = [p.nombre for p in platos]
        descripciones = [p.descripcion for p in platos]
        if idioma != "es" and platos:
            traducidos = self.traductor.traducir(nombres + descripciones, idioma)
            nombres, descripciones = traducidos[: len(platos)], traducidos[len(platos):]
        return {
            "happy_hour": es_happy_hour(ahora),
            "hora": ahora.strftime("%H:%M"),
            "ahora": ahora.isoformat(timespec="seconds"),
            "platos": [self._en_carta(p, ahora, n, d) for p, n, d in zip(platos, nombres, descripciones)],
        }

    def unirse(self, mesa, nombre):
        cuenta = self.repo.cuenta_abierta(mesa) or Cuenta(mesa=mesa)
        es_nuevo = nombre.strip() not in cuenta.comensales
        cuenta.unir(nombre)
        self.repo.guardar(cuenta)
        if es_nuevo:
            evento = {"tipo": "comensal", "mesa": mesa, "nombre": nombre.strip()}
            self.avisos.publicar(f"mesa:{mesa}", evento)
            self.avisos.publicar("mozo", evento)
        return cuenta

    def ver_cuenta(self, mesa):
        return self.repo.cuenta_abierta(mesa)

    def pedir(self, mesa, comensal, lineas):
        if not lineas:
            raise ReglaRota("el pedido está vacío")
        cuenta = self._cuenta(mesa)
        platos = {p.id: p for p in self.carta.platos()}
        ahora = self.reloj.ahora()
        agotados = self.repo.agotados()
        nuevos = []
        for plato_id, cantidad in lineas:
            if plato_id not in platos:
                raise ReglaRota("ese plato no está en la carta")
            nuevos.append(cuenta.agregar(platos[plato_id], cantidad, comensal, ahora, agotados))
        self.repo.guardar(cuenta)

        for item in nuevos:
            self.avisos.publicar("cocina", {"tipo": "nuevo", "mesa": mesa, "item": asdict(item)})
        resumen = {"tipo": "pedido", "mesa": mesa, "comensal": comensal,
                   "platos": [f"{i.cantidad} x {i.nombre}" for i in nuevos]}
        self.avisos.publicar(f"mesa:{mesa}", resumen)
        self.avisos.publicar("mozo", resumen)
        return nuevos

    def interpretar(self, texto):
        if not texto.strip():
            raise ReglaRota("escribe tu pedido")
        validos = self._validos()
        propuesta = self.interprete.interpretar(texto, validos)

        # la ia propone, el dominio decide
        por_id = {p.id: p for p in validos}
        agotados = self.repo.agotados()
        lineas, descartados = [], []
        for plato_id, cantidad in propuesta.lineas:
            plato = por_id.get(plato_id)
            if not plato:
                descartados.append({"plato": str(plato_id), "motivo": "no está en la carta"})
            elif plato.id in agotados:
                descartados.append({"plato": plato.nombre, "motivo": "está agotado"})
            elif not 1 <= int(cantidad) <= MAXIMO_POR_PLATO:
                descartados.append({"plato": plato.nombre, "motivo": "cantidad fuera de rango"})
            else:
                lineas.append({"plato_id": plato.id, "nombre": plato.nombre, "cantidad": int(cantidad)})
        return {"lineas": lineas, "descartados": descartados, "fuente": propuesta.fuente}

    def recomendar(self, deseo, sin_alergenos=(), sin_picante=False):
        if not deseo.strip():
            raise ReglaRota("cuéntale al mesero qué se te antoja")
        alergenos_texto, picante_texto = restricciones(deseo)
        sin_alergenos = set(sin_alergenos) | alergenos_texto
        sin_picante = sin_picante or picante_texto

        agotados = self.repo.agotados()
        disponibles = [p for p in self._validos() if p.id not in agotados]
        sugerencia = self.recomendador.recomendar(deseo, disponibles)

        # la ia solo sugiere: alergenos y picante los filtra el dominio
        ahora = self.reloj.ahora()
        por_id = {p.id: p for p in disponibles}
        permitidos = {p.id for p in carta_visible(disponibles, agotados, sin_alergenos, sin_picante)}
        aceptados, descartados = [], []
        for plato_id in dict.fromkeys(sugerencia.ids):
            plato = por_id.get(plato_id)
            if not plato:
                descartados.append({"plato": str(plato_id), "motivo": "no está en la carta"})
            elif plato_id in permitidos:
                aceptados.append(self._en_carta(plato, ahora))
            elif plato.contiene(sin_alergenos):
                choque = sorted(set(plato.alergenos) & sin_alergenos)
                descartados.append({"plato": plato.nombre, "motivo": f"tiene {', '.join(choque)}"})
            else:
                descartados.append({"plato": plato.nombre, "motivo": "es picante"})
        return {
            "platos": aceptados,
            "descartados": descartados,
            "fuente": sugerencia.fuente,
            "restricciones": {"sin": sorted(sin_alergenos), "sin_picante": sin_picante},
        }

    def cancelar(self, mesa, comensal, item_id):
        cuenta = self._cuenta(mesa)
        item = cuenta.cancelar(item_id, comensal)
        self.repo.guardar(cuenta)
        evento = {"tipo": "cancelado", "mesa": mesa, "item_id": item.id, "plato": item.nombre}
        self.avisos.publicar("cocina", evento)
        self.avisos.publicar(f"mesa:{mesa}", evento)
        return item

    def dividir(self, mesa, forma, comensal=None, items=()):
        return dividir(self._cuenta(mesa), forma, comensal=comensal, items=items)

    def pagar(self, mesa, comensal, monto, medio):
        cuenta = self._cuenta(mesa)
        # primero las reglas, despues el cobro
        cuenta.validar_pago(comensal, monto)
        resultado = self.pagos.cobrar(monto, medio, f"Mesa {mesa} - {comensal}")
        if not resultado.aprobado:
            raise ReglaRota(f"pago rechazado: {resultado.motivo}")
        cuenta.registrar_pago(comensal, monto, medio, resultado.referencia)
        self.repo.guardar(cuenta)

        evento = {"tipo": "pago", "mesa": mesa, "comensal": comensal, "monto": round(monto, 2),
                  "medio": medio, "cerrada": not cuenta.abierta}
        self.avisos.publicar(f"mesa:{mesa}", evento)
        self.avisos.publicar("mozo", evento)
        return cuenta

    def total_en(self, mesa, moneda):
        cuenta = self._cuenta(mesa)
        if moneda == "PEN":
            return {"moneda": "PEN", "tasa": 1.0, "total": cuenta.total, "saldo": cuenta.saldo}
        tasa = self.cambio.por_sol(moneda)
        return {"moneda": moneda, "tasa": tasa,
                "total": round(cuenta.total * tasa, 2), "saldo": round(cuenta.saldo * tasa, 2)}

    def llamar_mozo(self, mesa, comensal, motivo):
        cuenta = self._cuenta(mesa)
        cuenta.llamar_mozo(comensal, motivo, self.reloj.ahora())
        self.repo.guardar(cuenta)
        evento = {"tipo": "llamado", "mesa": mesa, "comensal": comensal, "motivo": motivo}
        self.avisos.publicar("mozo", evento)
        self.avisos.publicar(f"mesa:{mesa}", evento)
        return cuenta


class ServicioCocina:
    # lo que hacen la cocina y la barra
    def __init__(self, repo, carta, avisos):
        self.repo = repo
        self.carta = carta
        self.avisos = avisos

    def pendientes(self):
        lista = []
        for cuenta in self.repo.cuentas_abiertas():
            for item in cuenta.items:
                if item.estado != "servido":
                    lista.append({"mesa": cuenta.mesa, **asdict(item)})
        return sorted(lista, key=lambda i: i["hora"])

    def avanzar(self, mesa, item_id):
        cuenta = self.repo.cuenta_abierta(mesa)
        if not cuenta:
            raise ReglaRota("la mesa no tiene una cuenta abierta")
        item = cuenta.avanzar(item_id)
        self.repo.guardar(cuenta)
        evento = {"tipo": "estado", "mesa": mesa, "item": asdict(item)}
        self.avisos.publicar(f"mesa:{mesa}", evento)
        self.avisos.publicar("cocina", evento)
        return item

    def platos(self):
        agotados = self.repo.agotados()
        return [{"id": p.id, "nombre": p.nombre, "estacion": p.estacion, "foto": p.foto,
                 "agotado": p.id in agotados}
                for p in self.carta.platos() if p.es_valido()]

    def marcar_agotado(self, plato_id, agotado):
        if plato_id not in {p.id for p in self.carta.platos()}:
            raise ReglaRota("ese plato no está en la carta")
        self.repo.marcar_agotado(plato_id, agotado)
        self.avisos.publicar("todos", {"tipo": "carta", "plato_id": plato_id, "agotado": agotado})


class ServicioMozo:
    # vista general del salon
    def __init__(self, repo, reloj, avisos):
        self.repo = repo
        self.reloj = reloj
        self.avisos = avisos

    def mesas(self):
        return [
            {
                "mesa": c.mesa,
                "comensales": c.comensales,
                "total": c.total,
                "pagado": c.pagado,
                "saldo": c.saldo,
                "sin_servir": sum(1 for i in c.items if i.estado != "servido"),
                "llamado": c.llamado,
            }
            for c in sorted(self.repo.cuentas_abiertas(), key=lambda c: c.mesa)
        ]

    def cuenta(self, mesa):
        return self.repo.cuenta_abierta(mesa)

    def atender(self, mesa):
        cuenta = self.repo.cuenta_abierta(mesa)
        if not cuenta:
            raise ReglaRota("la mesa no tiene una cuenta abierta")
        cuenta.atender_llamado()
        self.repo.guardar(cuenta)
        evento = {"tipo": "atendido", "mesa": mesa}
        self.avisos.publicar("mozo", evento)
        self.avisos.publicar(f"mesa:{mesa}", evento)

    def hora(self):
        ahora = self.reloj.ahora()
        return {"hora": ahora.strftime("%H:%M"), "ahora": ahora.isoformat(timespec="seconds"),
                "happy_hour": es_happy_hour(ahora)}
