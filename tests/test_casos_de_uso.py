from datetime import datetime

import pytest

from restaurante.dominio.errores import ReglaRota
from tests.dobles import InterpreteFijo, PagoQueRechaza, RecomendadorFijo, RelojFijo, armar


def test_pedir_avisa_a_la_cocina_y_a_la_mesa():
    mesa, cocina, _, avisos = armar()
    mesa.unirse(1, "Ana")
    mesa.pedir(1, "Ana", [("lomo", 1), ("chicha", 2)])
    canales = [canal for canal, _ in avisos.enviados]
    assert canales.count("cocina") == 2
    assert "mesa:1" in canales
    assert [p["plato_id"] for p in cocina.pendientes()] == ["lomo", "chicha"]


def test_un_plato_agotado_desaparece_de_la_carta_y_no_se_puede_pedir():
    mesa, cocina, _, _ = armar()
    mesa.unirse(1, "Ana")
    cocina.marcar_agotado("lomo", True)
    assert "lomo" not in [p.id for p in mesa.ver_carta()["platos"]]
    with pytest.raises(ReglaRota, match="agotado"):
        mesa.pedir(1, "Ana", [("lomo", 1)])


def test_en_happy_hour_la_carta_marca_las_bebidas():
    mesa, _, _, _ = armar(reloj=RelojFijo(datetime(2026, 11, 19, 18, 30)))
    carta = mesa.ver_carta()
    assert carta["happy_hour"]
    promos = {p.id for p in carta["platos"] if p.promo}
    assert promos == {"chicha"}


def test_la_carta_se_traduce_con_el_adaptador():
    mesa, _, _, _ = armar()
    primero = mesa.ver_carta(idioma="de")["platos"][0]
    assert primero.nombre.startswith("[de]")


def test_la_ia_propone_y_el_dominio_descarta_lo_que_no_va():
    interprete = InterpreteFijo([("lomo", 2), ("hamburguesa", 1), ("chicha", 50)])
    mesa, cocina, _, _ = armar(interprete=interprete)
    cocina.marcar_agotado("lomo", True)
    resultado = mesa.interpretar("dos lomitos, una hamburguesa y 50 chichas")
    assert resultado["lineas"] == []
    motivos = {d["plato"]: d["motivo"] for d in resultado["descartados"]}
    assert motivos == {"Lomo saltado": "está agotado", "hamburguesa": "no está en la carta",
                       "Chicha morada": "cantidad fuera de rango"}


def test_la_ia_recomienda_pero_el_dominio_quita_alergenos_y_picante():
    recomendador = RecomendadorFijo(["aji", "ceviche", "quinua"])
    mesa, _, _, _ = armar(recomendador=recomendador)
    resultado = mesa.recomendar("algo sin gluten que no pique")
    assert [p.id for p in resultado["platos"]] == ["quinua"]
    assert {d["plato"] for d in resultado["descartados"]} == {"Ají de gallina", "Ceviche"}


def test_si_el_pago_se_rechaza_la_cuenta_no_cambia():
    mesa, _, repo, _ = armar(pagos=PagoQueRechaza())
    mesa.unirse(1, "Ana")
    mesa.pedir(1, "Ana", [("lomo", 1)])
    with pytest.raises(ReglaRota, match="rechazado"):
        mesa.pagar(1, "Ana", 38, "yape")
    assert repo.cuenta_abierta(1).saldo == 38


def test_las_reglas_se_revisan_antes_de_cobrar():
    mesa, _, _, _ = armar()
    pagos = mesa.pagos
    mesa.unirse(1, "Ana")
    mesa.pedir(1, "Ana", [("lomo", 1)])
    with pytest.raises(ReglaRota, match="de más"):
        mesa.pagar(1, "Ana", 100, "yape")
    assert pagos.cobros == []


def test_juntos_o_separados_y_la_mesa_se_cierra():
    mesa, _, repo, _ = armar()
    mesa.unirse(1, "Ana")
    mesa.unirse(1, "Beto")
    mesa.pedir(1, "Ana", [("lomo", 1)])
    mesa.pedir(1, "Beto", [("chicha", 1)])
    partes = mesa.dividir(1, "consumo")
    for persona, monto in partes.items():
        mesa.pagar(1, persona, monto, "yape")
    assert repo.cuenta_abierta(1) is None


def test_total_en_otra_moneda():
    mesa, _, _, _ = armar()
    mesa.unirse(1, "Ana")
    mesa.pedir(1, "Ana", [("lomo", 1)])
    assert mesa.total_en(1, "USD")["total"] == 11.4


def test_llamar_al_mozo_avisa_al_panel_y_a_la_mesa():
    mesa, _, repo, avisos = armar()
    mesa.unirse(1, "Ana")
    mesa.llamar_mozo(1, "Ana", "cubiertos")
    canales = [canal for canal, evento in avisos.enviados if evento["tipo"] == "llamado"]
    assert canales == ["mozo", "mesa:1"]
    assert repo.cuenta_abierta(1).llamado == "cubiertos"
