import random
import uuid

from restaurante.aplicacion.puertos import ResultadoPago


class PagoSimulado:
    # hace de pasarela de pagos; con tasa_rechazo se simula un proveedor caido
    def __init__(self, tasa_rechazo=0.0):
        self.tasa_rechazo = tasa_rechazo

    def cobrar(self, monto, medio, descripcion):
        if random.random() < self.tasa_rechazo:
            return ResultadoPago(aprobado=False, motivo="la pasarela no respondió")
        return ResultadoPago(aprobado=True, referencia=f"{medio.upper()}-{uuid.uuid4().hex[:8]}")
