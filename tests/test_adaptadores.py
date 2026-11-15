from datetime import datetime

import pytest

from restaurante.adaptadores.salida.carta import plato_desde_fila
from restaurante.adaptadores.salida.ia_clientes import IANoDisponible
from restaurante.adaptadores.salida.mesero import InterpreteConRespaldo, InterpretePalabras
from restaurante.adaptadores.salida.repositorio_memoria import RepositorioMemoria
from restaurante.adaptadores.salida.repositorio_sqlite import RepositorioSqlite
from restaurante.dominio.cuenta import Cuenta
from tests.dobles import CARTA

AHORA = datetime(2026, 11, 19, 13, 0)


@pytest.fixture(params=["memoria", "sqlite"])
def repo(request, tmp_path):
    # la misma bateria de pruebas para los dos repositorios: si pasan, se pueden intercambiar
    if request.param == "memoria":
        return RepositorioMemoria()
    return RepositorioSqlite(tmp_path / "prueba.db")


def test_repositorio_guarda_y_devuelve_la_cuenta(repo):
    cuenta = Cuenta(mesa=4)
    cuenta.unir("Ana")
    cuenta.agregar(CARTA[0], 2, "Ana", AHORA, set())
    repo.guardar(cuenta)
    leida = repo.cuenta_abierta(4)
    assert leida.comensales == ["Ana"]
    assert leida.total == 76.0
    assert [c.mesa for c in repo.cuentas_abiertas()] == [4]


def test_repositorio_no_devuelve_cuentas_cerradas(repo):
    cuenta = Cuenta(mesa=4)
    cuenta.unir("Ana")
    cuenta.agregar(CARTA[0], 1, "Ana", AHORA, set())
    repo.guardar(cuenta)
    cuenta.registrar_pago("Ana", 38, "yape")
    repo.guardar(cuenta)
    assert repo.cuenta_abierta(4) is None
    assert repo.cuentas_abiertas() == []


def test_repositorio_no_se_cambia_sin_guardar(repo):
    cuenta = Cuenta(mesa=4)
    cuenta.unir("Ana")
    repo.guardar(cuenta)
    leida = repo.cuenta_abierta(4)
    leida.unir("Intruso")
    assert repo.cuenta_abierta(4).comensales == ["Ana"]


def test_repositorio_recuerda_agotados(repo):
    repo.marcar_agotado("lomo", True)
    repo.marcar_agotado("chicha", True)
    repo.marcar_agotado("chicha", False)
    assert repo.agotados() == {"lomo"}


def test_interprete_por_palabras_entiende_jerga():
    propuesta = InterpretePalabras().interpretar("2 lomitos y una chichita bien helada", CARTA)
    assert propuesta.lineas == [("lomo", 2), ("chicha", 1)]


def test_si_una_ia_falla_responde_la_siguiente():
    class IACaida:
        def interpretar(self, texto, platos):
            raise IANoDisponible("groq llegó a su límite gratis")

    cadena = InterpreteConRespaldo([IACaida(), InterpretePalabras()])
    propuesta = cadena.interpretar("un lomo", CARTA)
    assert propuesta.lineas == [("lomo", 1)]
    assert "groq llegó a su límite" in propuesta.fuente


def test_fila_de_la_hoja_sin_alergenos_queda_invalida():
    fila = {"id": "x", "nombre": "X", "precio": "10", "categoria": "comida", "alergenos": ""}
    assert not plato_desde_fila(fila).es_valido()
    fila["alergenos"] = "ninguno"
    assert plato_desde_fila(fila).es_valido()
