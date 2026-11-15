from restaurante.adaptadores.entrada.api import crear_api
from restaurante.sistema import Sistema, eleccion_del_env

# punto de arranque: uvicorn restaurante.main:app
app = crear_api(Sistema(eleccion_del_env()))
