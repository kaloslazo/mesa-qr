import unicodedata
from dataclasses import dataclass, field

ALERGENOS = ["gluten", "lacteos", "huevo", "pescado", "mariscos", "mani", "soya"]
CATEGORIAS = ["comida", "bebida"]


@dataclass
class Plato:
    id: str
    nombre: str
    precio: float
    categoria: str
    alergenos: list[str] | None  # None = nadie los declaro
    descripcion: str = ""
    picante: bool = False
    alias: list[str] = field(default_factory=list)
    seccion: str = ""  # entradas, fondos, postres, bebidas
    foto: str = ""

    @property
    def estacion(self):
        return "barra" if self.categoria == "bebida" else "cocina"

    def problemas(self):
        # la carta puede venir de cualquier lado, aqui se revisa
        errores = []
        if not self.id or not self.nombre:
            errores.append("sin nombre")
        if self.precio is None or self.precio <= 0:
            errores.append("precio invalido")
        if self.categoria not in CATEGORIAS:
            errores.append("categoria invalida")
        if self.alergenos is None:
            errores.append("alergenos sin declarar")
        return errores

    def es_valido(self):
        return not self.problemas()

    def contiene(self, alergenos):
        return bool(set(self.alergenos or []) & set(alergenos))


def carta_visible(platos, agotados, sin_alergenos=(), sin_picante=False):
    # lo que el cliente puede pedir ahora mismo
    visibles = []
    for plato in platos:
        if not plato.es_valido() or plato.id in agotados:
            continue
        if plato.contiene(sin_alergenos):
            continue
        if sin_picante and plato.picante:
            continue
        visibles.append(plato)
    return visibles


def normalizar(texto):
    # minusculas y sin tildes, para comparar palabras
    texto = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


PALABRAS_ALERGENO = {
    "gluten": "gluten",
    "lacteo": "lacteos",
    "leche": "lacteos",
    "queso": "lacteos",
    "huevo": "huevo",
    "pescado": "pescado",
    "marisco": "mariscos",
    "mani": "mani",
    "soya": "soya",
}


def restricciones(texto):
    # si el cliente escribe "sin gluten" o "que no pique", se respeta aunque la ia lo olvide
    texto = normalizar(texto)
    alergenos = set()
    for palabra, alergeno in PALABRAS_ALERGENO.items():
        if f"sin {palabra}" in texto or f"no {palabra}" in texto or f"alergico al {palabra}" in texto:
            alergenos.add(alergeno)
    sin_picante = any(frase in texto for frase in ["no pique", "sin picante", "no picante", "nada picante"])
    return alergenos, sin_picante
