import sys

from restaurante.dominio.errores import ReglaRota
from restaurante.sistema import Sistema, eleccion_del_env

# otro adaptador de entrada: los mismos casos de uso, desde la terminal
#   python -m restaurante.adaptadores.entrada.cli carta
#   python -m restaurante.adaptadores.entrada.cli pedir 1 Kalos "2 lomitos y una chicha"
#   python -m restaurante.adaptadores.entrada.cli cuenta 1


def carta(servicio):
    datos = servicio.ver_carta()
    print(f"hora {datos['hora']}{'  (happy hour)' if datos['happy_hour'] else ''}")
    for plato in datos["platos"]:
        promo = "  2x1" if plato.promo else ""
        print(f"  {plato.id:<15} {plato.nombre:<22} S/ {plato.precio:>6.2f}{promo}")


def pedir(servicio, mesa, nombre, texto):
    propuesta = servicio.interpretar(texto)
    print(f"lo entendió: {propuesta['fuente']}")
    for linea in propuesta["lineas"]:
        print(f"  {linea['cantidad']} x {linea['nombre']}")
    for descarte in propuesta["descartados"]:
        print(f"  no va: {descarte['plato']} ({descarte['motivo']})")
    if propuesta["lineas"]:
        servicio.unirse(mesa, nombre)
        servicio.pedir(mesa, nombre, [(l["plato_id"], l["cantidad"]) for l in propuesta["lineas"]])
        print(f"pedido enviado a cocina para la mesa {mesa}")


def cuenta(servicio, mesa):
    actual = servicio.ver_cuenta(mesa)
    if not actual:
        print(f"la mesa {mesa} no tiene cuenta abierta")
        return
    print(f"mesa {mesa}: {', '.join(actual.comensales)}")
    for item in actual.items:
        print(f"  {item.cantidad} x {item.nombre:<22} {item.comensal:<10} {item.estado:<11} S/ {item.subtotal:.2f}")
    print(f"total S/ {actual.total:.2f}   falta S/ {actual.saldo:.2f}")


def main(argumentos):
    # en la terminal no hay pantallas en vivo: los avisos salen por consola
    sistema = Sistema(eleccion_del_env() | {"avisos": "consola"})
    servicio = sistema.mesa()
    try:
        if argumentos[:1] == ["carta"]:
            carta(servicio)
        elif argumentos[:1] == ["pedir"] and len(argumentos) == 4:
            pedir(servicio, int(argumentos[1]), argumentos[2], argumentos[3])
        elif argumentos[:1] == ["cuenta"] and len(argumentos) == 2:
            cuenta(servicio, int(argumentos[1]))
        else:
            print("uso: carta | pedir <mesa> <nombre> \"<texto>\" | cuenta <mesa>")
            return 1
    except ReglaRota as error:
        print(f"no se pudo: {error}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
