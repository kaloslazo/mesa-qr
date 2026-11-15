from datetime import time

INICIO_HAPPY_HOUR = time(18, 0)
FIN_HAPPY_HOUR = time(20, 0)


def es_happy_hour(ahora):
    return INICIO_HAPPY_HOUR <= ahora.time() < FIN_HAPPY_HOUR


def tiene_promo(plato, ahora):
    return plato.categoria == "bebida" and es_happy_hour(ahora)


def precio_a_cobrar(plato, cantidad, ahora):
    # en happy hour las bebidas van 2x1: de cada dos se paga una
    pagadas = cantidad - cantidad // 2 if tiene_promo(plato, ahora) else cantidad
    return round(plato.precio * pagadas, 2)
