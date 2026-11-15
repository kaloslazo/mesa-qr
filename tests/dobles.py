from datetime import datetime

from restaurante.adaptadores.salida.repositorio_memoria import RepositorioMemoria
from restaurante.aplicacion.casos_de_uso import ServicioCocina, ServicioMesa
from restaurante.aplicacion.puertos import Propuesta, ResultadoPago, Sugerencia
from restaurante.dominio.plato import Plato

# dobles de prueba: adaptadores de mentira para probar el centro sin internet ni base de datos

CARTA = [
    Plato("lomo", "Lomo saltado", 38.0, "comida", ["soya"], alias=["lomo", "lomito"]),
    Plato("aji", "Ají de gallina", 28.0, "comida", ["gluten", "lacteos"]),
    Plato("quinua", "Ensalada de quinua", 20.0, "comida", []),
    Plato("ceviche", "Ceviche", 32.0, "comida", ["pescado"], picante=True),
    Plato("chicha", "Chicha morada", 8.0, "bebida", [], alias=["chicha"]),
]


class CartaFija:
    def __init__(self, platos=CARTA):
        self._platos = platos

    def platos(self):
        return list(self._platos)


class RelojFijo:
    def __init__(self, momento=datetime(2026, 11, 19, 13, 0)):
        self.momento = momento

    def ahora(self):
        return self.momento


class AvisosAnotados:
    def __init__(self):
        self.enviados = []

    def publicar(self, canal, evento):
        self.enviados.append((canal, evento))


class PagoQueAprueba:
    def __init__(self):
        self.cobros = []

    def cobrar(self, monto, medio, descripcion):
        self.cobros.append(monto)
        return ResultadoPago(aprobado=True, referencia="OK-1")


class PagoQueRechaza:
    def cobrar(self, monto, medio, descripcion):
        return ResultadoPago(aprobado=False, motivo="sin fondos")


class InterpreteFijo:
    # devuelve siempre lo mismo, como si fuera una ia
    def __init__(self, lineas):
        self.lineas = lineas

    def interpretar(self, texto, platos):
        return Propuesta(list(self.lineas), fuente="falso")


class RecomendadorFijo:
    def __init__(self, ids):
        self.ids = ids

    def recomendar(self, deseo, platos):
        return Sugerencia(list(self.ids), fuente="falso")


class TraductorEco:
    def traducir(self, textos, idioma):
        return [f"[{idioma}] {t}" for t in textos]


class CambioFijo:
    def por_sol(self, moneda):
        return {"USD": 0.3}[moneda]


def armar(pagos=None, interprete=None, recomendador=None, reloj=None):
    repo = RepositorioMemoria()
    avisos = AvisosAnotados()
    mesa = ServicioMesa(
        repo=repo,
        carta=CartaFija(),
        reloj=reloj or RelojFijo(),
        avisos=avisos,
        pagos=pagos or PagoQueAprueba(),
        interprete=interprete or InterpreteFijo([]),
        recomendador=recomendador or RecomendadorFijo([]),
        traductor=TraductorEco(),
        cambio=CambioFijo(),
    )
    cocina = ServicioCocina(repo, CartaFija(), avisos)
    return mesa, cocina, repo, avisos
