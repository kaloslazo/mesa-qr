import copy


class RepositorioMemoria:
    # todo vive en la ram: rapido, pero se pierde al reiniciar
    def __init__(self):
        self._abiertas = {}
        self._cerradas = []
        self._agotados = set()

    def cuenta_abierta(self, mesa):
        cuenta = self._abiertas.get(mesa)
        return copy.deepcopy(cuenta) if cuenta else None

    def guardar(self, cuenta):
        # se guarda una copia para que nadie la cambie sin pasar por aqui
        if cuenta.abierta:
            self._abiertas[cuenta.mesa] = copy.deepcopy(cuenta)
        else:
            self._abiertas.pop(cuenta.mesa, None)
            self._cerradas.append(copy.deepcopy(cuenta))

    def cuentas_abiertas(self):
        return [copy.deepcopy(c) for c in self._abiertas.values()]

    def agotados(self):
        return set(self._agotados)

    def marcar_agotado(self, plato_id, agotado):
        if agotado:
            self._agotados.add(plato_id)
        else:
            self._agotados.discard(plato_id)
