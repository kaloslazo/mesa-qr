import hashlib
import hmac

# el qr de cada mesa lleva una firma: no se puede pedir a otra mesa cambiando el numero del link


def firmar(mesa, secreto):
    return hmac.new(secreto.encode(), f"mesa-{mesa}".encode(), hashlib.sha256).hexdigest()[:12]


def es_valida(mesa, firma, secreto):
    return hmac.compare_digest(firmar(mesa, secreto), firma or "")
