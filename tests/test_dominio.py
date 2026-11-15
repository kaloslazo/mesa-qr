from datetime import datetime

import pytest

from restaurante.dominio.cuenta import Cuenta
from restaurante.dominio.division import dividir
from restaurante.dominio.errores import ReglaRota
from restaurante.dominio.horario import es_happy_hour, precio_a_cobrar
from restaurante.dominio.plato import Plato, carta_visible, restricciones

MEDIODIA = datetime(2026, 11, 19, 13, 0)
HAPPY_HOUR = datetime(2026, 11, 19, 18, 30)

lomo = Plato("lomo", "Lomo saltado", 38.0, "comida", ["soya"])
ceviche = Plato("ceviche", "Ceviche", 32.0, "comida", ["pescado"], picante=True)
chicha = Plato("chicha", "Chicha morada", 8.0, "bebida", [])
sin_alergenos = Plato("raro", "Plato raro", 20.0, "comida", None)
precio_malo = Plato("gratis", "Gratis", -5.0, "comida", [])


def mesa_con(*nombres):
    cuenta = Cuenta(mesa=3)
    for nombre in nombres:
        cuenta.unir(nombre)
    return cuenta


def test_la_carta_esconde_platos_invalidos_y_agotados():
    visibles = carta_visible([lomo, ceviche, sin_alergenos, precio_malo], agotados={"ceviche"})
    assert [p.id for p in visibles] == ["lomo"]


def test_la_carta_filtra_alergenos_y_picante():
    assert [p.id for p in carta_visible([lomo, ceviche], set(), sin_alergenos={"soya"})] == ["ceviche"]
    assert [p.id for p in carta_visible([lomo, ceviche], set(), sin_picante=True)] == ["lomo"]


def test_restricciones_se_leen_del_texto():
    alergenos, sin_picante = restricciones("algo SIN GLUTEN y que no pique, soy alérgico al maní")
    assert alergenos == {"gluten", "mani"}
    assert sin_picante


def test_happy_hour_es_de_6_a_8():
    assert es_happy_hour(HAPPY_HOUR)
    assert not es_happy_hour(MEDIODIA)
    assert not es_happy_hour(datetime(2026, 11, 19, 20, 0))


def test_en_happy_hour_las_bebidas_van_2x1():
    assert precio_a_cobrar(chicha, 3, HAPPY_HOUR) == 16.0
    assert precio_a_cobrar(chicha, 3, MEDIODIA) == 24.0
    assert precio_a_cobrar(lomo, 2, HAPPY_HOUR) == 76.0


def test_varios_comensales_comparten_la_cuenta():
    cuenta = mesa_con("Ana", "Beto")
    cuenta.agregar(lomo, 1, "Ana", MEDIODIA, set())
    cuenta.agregar(chicha, 2, "Beto", MEDIODIA, set())
    assert cuenta.total == 54.0
    assert cuenta.consumo_de("Beto") == 16.0


def test_no_se_pide_sin_unirse_ni_platos_agotados():
    cuenta = mesa_con("Ana")
    with pytest.raises(ReglaRota):
        cuenta.agregar(lomo, 1, "Intruso", MEDIODIA, set())
    with pytest.raises(ReglaRota, match="agotado"):
        cuenta.agregar(lomo, 1, "Ana", MEDIODIA, {"lomo"})
    with pytest.raises(ReglaRota):
        cuenta.agregar(lomo, 11, "Ana", MEDIODIA, set())


def test_el_plato_pasa_por_sus_estados():
    cuenta = mesa_con("Ana")
    item = cuenta.agregar(lomo, 1, "Ana", MEDIODIA, set())
    assert cuenta.avanzar(item.id).estado == "preparando"
    assert cuenta.avanzar(item.id).estado == "servido"
    with pytest.raises(ReglaRota):
        cuenta.avanzar(item.id)


def test_solo_cancelas_lo_tuyo_y_antes_de_cocina():
    cuenta = mesa_con("Ana", "Beto")
    item = cuenta.agregar(lomo, 1, "Ana", MEDIODIA, set())
    with pytest.raises(ReglaRota):
        cuenta.cancelar(item.id, "Beto")
    cuenta.avanzar(item.id)
    with pytest.raises(ReglaRota, match="ya empezó"):
        cuenta.cancelar(item.id, "Ana")


def test_no_se_paga_de_mas_y_la_cuenta_se_cierra_en_cero():
    cuenta = mesa_con("Ana")
    cuenta.agregar(lomo, 1, "Ana", MEDIODIA, set())
    with pytest.raises(ReglaRota, match="de más"):
        cuenta.registrar_pago("Ana", 50, "yape")
    cuenta.registrar_pago("Ana", 38, "yape")
    assert cuenta.saldo == 0
    assert not cuenta.abierta


def test_dividir_en_partes_iguales_cuadra_al_centimo():
    cuenta = mesa_con("Ana", "Beto", "Caro")
    cuenta.agregar(Plato("x", "X", 10.0, "comida", []), 1, "Ana", MEDIODIA, set())
    partes = dividir(cuenta, "iguales")
    assert partes == {"Ana": 3.34, "Beto": 3.33, "Caro": 3.33}
    assert round(sum(partes.values()), 2) == cuenta.total


def test_dividir_por_consumo_descuenta_lo_ya_pagado():
    cuenta = mesa_con("Ana", "Beto")
    cuenta.agregar(lomo, 1, "Ana", MEDIODIA, set())
    cuenta.agregar(chicha, 1, "Beto", MEDIODIA, set())
    cuenta.registrar_pago("Ana", 20, "yape")
    assert dividir(cuenta, "consumo") == {"Ana": 18.0, "Beto": 8.0}


def test_dividir_eligiendo_platos():
    cuenta = mesa_con("Ana", "Beto")
    a = cuenta.agregar(lomo, 1, "Ana", MEDIODIA, set())
    b = cuenta.agregar(chicha, 1, "Beto", MEDIODIA, set())
    assert dividir(cuenta, "platos", comensal="Beto", items=[a.id, b.id]) == {"Beto": 46.0}


def test_llamar_al_mozo_tiene_un_minuto_de_espera():
    cuenta = mesa_con("Ana")
    cuenta.llamar_mozo("Ana", "cuenta", MEDIODIA)
    assert cuenta.llamado == "cuenta"
    with pytest.raises(ReglaRota, match="ya está avisado"):
        cuenta.llamar_mozo("Ana", "atencion", MEDIODIA.replace(second=30))
    cuenta.atender_llamado()
    cuenta.llamar_mozo("Ana", "atencion", MEDIODIA.replace(minute=1, second=1))
    assert cuenta.llamado == "atencion"


def test_no_se_llama_al_mozo_sin_estar_en_la_mesa_ni_por_cualquier_motivo():
    cuenta = mesa_con("Ana")
    with pytest.raises(ReglaRota):
        cuenta.llamar_mozo("Intruso", "cuenta", MEDIODIA)
    with pytest.raises(ReglaRota, match="motivo"):
        cuenta.llamar_mozo("Ana", "karaoke", MEDIODIA)
