import ast
from pathlib import Path

import pytest

# la regla de oro: el centro no importa nada de afuera

RAIZ = Path(__file__).resolve().parent.parent / "restaurante"
PROHIBIDOS = ["restaurante.adaptadores", "restaurante.sistema", "restaurante.main",
              "fastapi", "httpx", "sqlite3", "segno", "uvicorn", "dotenv"]


def imports_de(archivo):
    arbol = ast.parse(archivo.read_text(encoding="utf-8"))
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            yield from (a.name for a in nodo.names)
        elif isinstance(nodo, ast.ImportFrom) and nodo.module and nodo.level == 0:
            yield nodo.module


@pytest.mark.parametrize("capa", ["dominio", "aplicacion"])
def test_el_centro_no_depende_de_los_adaptadores(capa):
    for archivo in (RAIZ / capa).glob("*.py"):
        for modulo in imports_de(archivo):
            assert not any(modulo.startswith(p) for p in PROHIBIDOS), f"{archivo.name} importa {modulo}"


def test_el_dominio_no_depende_ni_de_la_aplicacion():
    for archivo in (RAIZ / "dominio").glob("*.py"):
        for modulo in imports_de(archivo):
            assert not modulo.startswith("restaurante.aplicacion"), f"{archivo.name} importa {modulo}"
