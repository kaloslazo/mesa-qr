from dataclasses import dataclass, field
from datetime import datetime

from .errores import ReglaRota
from .horario import precio_a_cobrar

ESTADOS = ["pedido", "preparando", "servido"]
MAXIMO_POR_PLATO = 10
MOTIVOS_LLAMADO = {"atencion": "necesita atención", "cubiertos": "pide cubiertos o servilletas", "cuenta": "quiere pagar"}
SEGUNDOS_ENTRE_LLAMADOS = 60


@dataclass
class Item:
    id: int
    plato_id: str
    nombre: str
    estacion: str
    cantidad: int
    subtotal: float
    comensal: str
    hora: str
    estado: str = "pedido"


@dataclass
class Pago:
    comensal: str
    monto: float
    medio: str
    referencia: str = ""


@dataclass
class Cuenta:
    # una cuenta por mesa, compartida por todos los que escanean su qr
    mesa: int
    comensales: list[str] = field(default_factory=list)
    items: list[Item] = field(default_factory=list)
    pagos: list[Pago] = field(default_factory=list)
    abierta: bool = True
    llamado: str = ""  # motivo del llamado al mozo que falta atender
    ultimo_llamado: str = ""

    def llamar_mozo(self, comensal, motivo, ahora):
        if comensal not in self.comensales:
            raise ReglaRota("primero únete a la mesa")
        if motivo not in MOTIVOS_LLAMADO:
            raise ReglaRota("motivo desconocido")
        # no se puede insistir antes de un minuto
        if self.ultimo_llamado:
            pasaron = (ahora - datetime.fromisoformat(self.ultimo_llamado)).total_seconds()
            if 0 <= pasaron < SEGUNDOS_ENTRE_LLAMADOS:
                faltan = int(SEGUNDOS_ENTRE_LLAMADOS - pasaron)
                raise ReglaRota(f"el mozo ya está avisado; puedes volver a llamar en {faltan} s")
        self.llamado = motivo
        self.ultimo_llamado = ahora.isoformat(timespec="seconds")

    def atender_llamado(self):
        if not self.llamado:
            raise ReglaRota("esa mesa no está llamando")
        self.llamado = ""

    def unir(self, nombre):
        nombre = nombre.strip()
        if not nombre:
            raise ReglaRota("escribe tu nombre")
        if not self.abierta:
            raise ReglaRota("esta cuenta ya se cerró")
        if nombre not in self.comensales:
            self.comensales.append(nombre)

    def agregar(self, plato, cantidad, comensal, ahora, agotados):
        if not self.abierta:
            raise ReglaRota("esta cuenta ya se cerró")
        if comensal not in self.comensales:
            raise ReglaRota("primero únete a la mesa")
        if not plato.es_valido():
            raise ReglaRota(f"{plato.nombre} no está en la carta")
        if plato.id in agotados:
            raise ReglaRota(f"{plato.nombre} está agotado")
        if not 1 <= cantidad <= MAXIMO_POR_PLATO:
            raise ReglaRota(f"la cantidad va de 1 a {MAXIMO_POR_PLATO}")

        item = Item(
            id=max((i.id for i in self.items), default=0) + 1,
            plato_id=plato.id,
            nombre=plato.nombre,
            estacion=plato.estacion,
            cantidad=cantidad,
            subtotal=precio_a_cobrar(plato, cantidad, ahora),
            comensal=comensal,
            hora=ahora.isoformat(timespec="seconds"),
        )
        self.items.append(item)
        return item

    def buscar_item(self, item_id):
        for item in self.items:
            if item.id == item_id:
                return item
        raise ReglaRota("ese plato no está en la cuenta")

    def avanzar(self, item_id):
        # pedido -> preparando -> servido
        item = self.buscar_item(item_id)
        posicion = ESTADOS.index(item.estado)
        if posicion == len(ESTADOS) - 1:
            raise ReglaRota("ese plato ya se sirvió")
        item.estado = ESTADOS[posicion + 1]
        return item

    def cancelar(self, item_id, comensal):
        # solo lo tuyo y solo si la cocina no empezó
        item = self.buscar_item(item_id)
        if item.comensal != comensal:
            raise ReglaRota("solo puedes cancelar lo que pediste tú")
        if item.estado != "pedido":
            raise ReglaRota("la cocina ya empezó ese plato")
        self.items.remove(item)
        return item

    @property
    def total(self):
        return round(sum(i.subtotal for i in self.items), 2)

    @property
    def pagado(self):
        return round(sum(p.monto for p in self.pagos), 2)

    @property
    def saldo(self):
        return round(self.total - self.pagado, 2)

    def consumo_de(self, comensal):
        return round(sum(i.subtotal for i in self.items if i.comensal == comensal), 2)

    def pagado_por(self, comensal):
        return round(sum(p.monto for p in self.pagos if p.comensal == comensal), 2)

    def validar_pago(self, comensal, monto):
        if not self.abierta:
            raise ReglaRota("esta cuenta ya se cerró")
        if comensal not in self.comensales:
            raise ReglaRota("primero únete a la mesa")
        if monto <= 0:
            raise ReglaRota("el monto tiene que ser mayor a cero")
        if round(monto, 2) > self.saldo:
            raise ReglaRota(f"no se puede pagar de más: el saldo es S/ {self.saldo:.2f}")

    def registrar_pago(self, comensal, monto, medio, referencia=""):
        self.validar_pago(comensal, monto)
        self.pagos.append(Pago(comensal, round(monto, 2), medio, referencia))
        if self.saldo <= 0:
            self.abierta = False
