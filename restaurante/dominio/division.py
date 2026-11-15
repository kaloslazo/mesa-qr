from .errores import ReglaRota

# "¿juntos o separados?": tres formas de dividir la misma cuenta (patron strategy)


class PartesIguales:
    def calcular(self, cuenta, **_):
        personas = cuenta.comensales
        if not personas:
            return {}
        # se reparte en centimos para que la suma cuadre exacto
        centimos = round(cuenta.total * 100)
        base, sobran = divmod(centimos, len(personas))
        montos = {}
        for i, persona in enumerate(personas):
            parte = (base + (1 if i < sobran else 0)) / 100
            debe = max(parte - cuenta.pagado_por(persona), 0)
            montos[persona] = round(min(debe, cuenta.saldo), 2)
        return montos


class PorConsumo:
    def calcular(self, cuenta, **_):
        # cada uno paga lo que pidio menos lo que ya pago
        montos = {}
        for persona in cuenta.comensales:
            debe = max(cuenta.consumo_de(persona) - cuenta.pagado_por(persona), 0)
            montos[persona] = round(min(debe, cuenta.saldo), 2)
        return montos


class PorPlatos:
    def calcular(self, cuenta, comensal=None, items=(), **_):
        # alguien elige que platos paga
        if not comensal:
            raise ReglaRota("falta quién paga")
        monto = sum(cuenta.buscar_item(item_id).subtotal for item_id in items)
        return {comensal: round(min(monto, cuenta.saldo), 2)}


FORMAS = {
    "iguales": PartesIguales(),
    "consumo": PorConsumo(),
    "platos": PorPlatos(),
}


def dividir(cuenta, forma, **datos):
    if forma not in FORMAS:
        raise ReglaRota("forma de dividir desconocida")
    return FORMAS[forma].calcular(cuenta, **datos)
