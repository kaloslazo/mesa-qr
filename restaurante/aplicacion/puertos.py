from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from restaurante.dominio.cuenta import Cuenta
from restaurante.dominio.plato import Plato

# puertos de salida: lo que el centro necesita, sin decir quien lo hace.
# los puertos de entrada son los servicios de casos_de_uso.py


@dataclass
class ResultadoPago:
    aprobado: bool
    referencia: str = ""
    motivo: str = ""


@dataclass
class Propuesta:
    # lo que entendio el interprete: [(plato_id, cantidad)]
    lineas: list[tuple[str, int]] = field(default_factory=list)
    fuente: str = ""


@dataclass
class Sugerencia:
    ids: list[str] = field(default_factory=list)
    fuente: str = ""


class Carta(Protocol):
    def platos(self) -> list[Plato]: ...


class Repositorio(Protocol):
    def cuenta_abierta(self, mesa: int) -> Cuenta | None: ...
    def guardar(self, cuenta: Cuenta) -> None: ...
    def cuentas_abiertas(self) -> list[Cuenta]: ...
    def agotados(self) -> set[str]: ...
    def marcar_agotado(self, plato_id: str, agotado: bool) -> None: ...


class Pagos(Protocol):
    def cobrar(self, monto: float, medio: str, descripcion: str) -> ResultadoPago: ...


class Avisos(Protocol):
    def publicar(self, canal: str, evento: dict) -> None: ...


class Reloj(Protocol):
    def ahora(self) -> datetime: ...


class InterpretePedido(Protocol):
    def interpretar(self, texto: str, platos: list[Plato]) -> Propuesta: ...


class Recomendador(Protocol):
    def recomendar(self, deseo: str, platos: list[Plato]) -> Sugerencia: ...


class Traductor(Protocol):
    def traducir(self, textos: list[str], idioma: str) -> list[str]: ...


class TipoDeCambio(Protocol):
    def por_sol(self, moneda: str) -> float: ...
