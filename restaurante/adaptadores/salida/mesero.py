import json
import re
from pathlib import Path

from restaurante.aplicacion.puertos import Propuesta, Sugerencia
from restaurante.dominio.plato import normalizar

from .ia_clientes import IANoDisponible


def _carta_texto(platos):
    # a la ia no se le pasan los alergenos: de eso se encarga el dominio
    lineas = []
    for p in platos:
        tambien = f" (también le dicen: {', '.join(p.alias)})" if p.alias else ""
        lineas.append(f"- id={p.id}: {p.nombre}, {p.categoria}{tambien}. {p.descripcion}")
    return "\n".join(lineas)


INSTRUCCIONES_PEDIDO = (
    "Eres el mesero de un restaurante peruano. Convierte el pedido del cliente en JSON con la forma "
    '{"items": [{"id": "<id de la carta o null>", "nombre": "<lo que pidio>", "cantidad": <entero>}]}. '
    "Busca cada cosa en la carta por su nombre o por como tambien le dicen (lomito = lomo, chela = cerveza). "
    "Si algo no esta en la carta, ponlo con id null. Responde solo el JSON.\n"
    'Ejemplo: "3 lomitos y un ceviche" -> {"items": [{"id": "lomo", "nombre": "lomitos", "cantidad": 3}, '
    '{"id": "ceviche", "nombre": "ceviche", "cantidad": 1}]}'
)

INSTRUCCIONES_RECOMENDAR = (
    "Eres el mesero de un restaurante peruano. Recomienda hasta 3 platos de la carta para lo que "
    'pide el cliente. Responde solo JSON con la forma {"ids": ["<id>", "<id>"]}.'
)


def _cantidad(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return 1


class InterpreteIA:
    def __init__(self, cliente):
        self.cliente = cliente
        self.nombre = cliente.nombre

    def interpretar(self, texto, platos):
        datos = self.cliente.pedir_json(INSTRUCCIONES_PEDIDO, f"Carta:\n{_carta_texto(platos)}\n\nPedido: {texto}")
        lineas = []
        for item in datos.get("items", []):
            if isinstance(item, dict):
                clave = item.get("id") or item.get("nombre") or "?"
                lineas.append((str(clave), _cantidad(item.get("cantidad", 1))))
        return Propuesta(lineas, fuente=self.nombre)


class RecomendadorIA:
    def __init__(self, cliente):
        self.cliente = cliente
        self.nombre = cliente.nombre

    def recomendar(self, deseo, platos):
        datos = self.cliente.pedir_json(INSTRUCCIONES_RECOMENDAR, f"Carta:\n{_carta_texto(platos)}\n\nCliente: {deseo}")
        return Sugerencia([str(i) for i in datos.get("ids", [])][:3], fuente=self.nombre)


NUMEROS = {"un": 1, "una": 1, "uno": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5,
           "seis": 6, "siete": 7, "ocho": 8, "nueve": 9, "diez": 10}


class InterpretePalabras:
    # sin ia: busca nombres y alias de la carta en el texto
    nombre = "palabras clave"

    def interpretar(self, texto, platos):
        lineas = []
        for parte in re.split(r",| y |\+|\n", normalizar(texto)):
            plato = self._buscar(parte, platos)
            if plato:
                lineas.append((plato.id, self._cantidad(parte)))
        return Propuesta(lineas, fuente=self.nombre)

    def _buscar(self, parte, platos):
        palabras = parte.split()
        mejor, largo = None, 0
        for plato in platos:
            for clave in [plato.nombre, *plato.alias]:
                clave = normalizar(clave)
                # coincide la frase completa, o la raiz de una palabra (chichita -> chicha)
                raiz = len(clave) >= 5 and " " not in clave and any(p.startswith(clave[:5]) for p in palabras)
                if (clave in parte or raiz) and len(clave) > largo:
                    mejor, largo = plato, len(clave)
        return mejor

    def _cantidad(self, parte):
        for palabra in parte.split():
            if palabra.isdigit():
                return int(palabra)
            if palabra in NUMEROS:
                return NUMEROS[palabra]
        return 1


VACIAS = {"algo", "que", "de", "la", "el", "los", "las", "un", "una", "con", "sin", "no", "para",
          "me", "quiero", "y", "por", "favor", "se", "antoja", "mi", "muy", "pique", "picante", "mas"}


class RecomendadorPalabras:
    # sin ia: cruza las palabras del cliente con la descripcion de cada plato
    nombre = "palabras clave"

    def recomendar(self, deseo, platos):
        palabras = set(re.findall(r"[a-z]+", normalizar(deseo))) - VACIAS
        quiere_tomar = bool(palabras & {"tomar", "beber", "bebida", "sed", "refresco", "trago"})
        puntajes = []
        for plato in platos:
            texto = normalizar(" ".join([plato.nombre, plato.descripcion, *plato.alias]))
            puntaje = sum(1 for p in palabras if len(p) > 3 and p[:5] in texto)
            if quiere_tomar and plato.categoria == "bebida":
                puntaje += 2
            puntajes.append((puntaje, plato))
        elegidos = [p for puntaje, p in sorted(puntajes, key=lambda x: -x[0]) if puntaje > 0][:3]
        if not elegidos:
            elegidos = [p for p in platos if p.categoria == "comida"][:3]
        return Sugerencia([p.id for p in elegidos], fuente=self.nombre)


def _primero_que_responda(opciones, llamar):
    # chain of responsibility: si uno falla, pasa al siguiente
    fallas = []
    for opcion in opciones:
        try:
            respuesta = llamar(opcion)
        except IANoDisponible as error:
            fallas.append(str(error))
            continue
        if fallas:
            respuesta.fuente += f" (antes: {'; '.join(fallas)})"
        return respuesta
    raise IANoDisponible("; ".join(fallas))


class InterpreteConRespaldo:
    def __init__(self, opciones):
        self.opciones = opciones

    def interpretar(self, texto, platos):
        return _primero_que_responda(self.opciones, lambda o: o.interpretar(texto, platos))


class RecomendadorConRespaldo:
    def __init__(self, opciones):
        self.opciones = opciones

    def recomendar(self, deseo, platos):
        return _primero_que_responda(self.opciones, lambda o: o.recomendar(deseo, platos))


IDIOMAS = {"en": "inglés", "de": "alemán"}


class TraductorFijo:
    # traducciones escritas a mano en datos/traducciones.json
    def __init__(self, ruta):
        self.textos = json.loads(Path(ruta).read_text(encoding="utf-8"))

    def traducir(self, textos, idioma):
        return [self.textos.get(t, {}).get(idioma, t) for t in textos]


class TraductorIA:
    # traduce con la ia que responda primero; si ninguna, usa las traducciones fijas
    def __init__(self, clientes, respaldo):
        self.clientes = clientes
        self.respaldo = respaldo
        self.memoria = {}

    def traducir(self, textos, idioma):
        faltan = [t for t in dict.fromkeys(textos) if (t, idioma) not in self.memoria]
        if faltan and not self._pedir(faltan, idioma):
            return self.respaldo.traducir(textos, idioma)
        return [self.memoria.get((t, idioma), t) for t in textos]

    def _pedir(self, textos, idioma):
        instrucciones = (
            f"Traduce al {IDIOMAS.get(idioma, idioma)} los textos de la carta de un restaurante peruano. "
            "Los nombres de platos tipicos se pueden dejar en español con una explicacion corta. "
            'Responde solo JSON con la forma {"traducciones": ["...", "..."]} en el mismo orden.'
        )
        for cliente in self.clientes:
            try:
                datos = cliente.pedir_json(instrucciones, json.dumps({"textos": textos}, ensure_ascii=False))
            except IANoDisponible:
                continue
            traducidos = datos.get("traducciones")
            if isinstance(traducidos, list) and len(traducidos) == len(textos):
                for original, traducido in zip(textos, traducidos):
                    self.memoria[(original, idioma)] = str(traducido)
                return True
        return False
