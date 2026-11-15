# Mesa QR

Pedidos por QR para un restaurante, hecho con arquitectura hexagonal (puertos y adaptadores).

Cada mesa tiene su QR. Los que lo escanean comparten la misma cuenta, ven en vivo lo que piden los demás, pueden pedir escribiendo como le hablarían al mozo, preguntarle al mesero con IA y al final dividir la cuenta ("¿juntos o separados?").

## Cómo correrlo

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # poner un SECRETO_QR cualquiera
.venv/bin/uvicorn restaurante.main:app --host 0.0.0.0 --port 8790
```

- Panel del mozo: http://localhost:8790/mozo
- Cocina y barra: http://localhost:8790/cocina
- QR de las mesas: http://localhost:8790/qr

Pruebas:

```bash
.venv/bin/python -m pytest -q
```

Para empezar de cero, borrar `datos/restaurante.db`.

### La interfaz

Las pantallas son una app de React (Vite, Motion para las animaciones, Phosphor para los íconos) en `frontend/`. Ya viene compilada en `web/`, así que para correr el proyecto no hace falta Node. Solo si se cambia algo de la interfaz:

```bash
cd frontend
npm install
npm run build        # deja el resultado en ../web
npm run dev          # o trabajar en vivo en http://localhost:5190 (usa el backend del 8790)
```

Tiene modo claro y oscuro (botón arriba a la derecha). Para la API, la interfaz es un adaptador de entrada más: se reemplazó entera sin tocar el dominio ni los casos de uso.

Las fotos de los platos vienen de Wikimedia Commons; autores y licencias en `datos/creditos-fotos.md`.

## La arquitectura

```
restaurante/
  dominio/         reglas del restaurante, sin nada de afuera
  aplicacion/      casos de uso (puertos de entrada) y puertos de salida
  adaptadores/
    entrada/       api web, websocket, comensales virtuales, linea de comandos
    salida/        carta, base de datos, pagos, avisos, reloj, ia, traductor, tipo de cambio
  sistema.py       arma la app: elige que adaptador va en cada puerto
  main.py          punto de arranque
```

La regla: las dependencias apuntan hacia adentro. `dominio` no importa nada de afuera y `aplicacion` solo conoce el dominio y las interfaces de sus puertos. `tests/test_arquitectura.py` falla si alguien rompe esto.

### Reglas del dominio

- Una cuenta por mesa, compartida por todos los que escanean su QR.
- Las bebidas van a la barra y la comida a la cocina. Cada plato pasa por en espera, preparando y servido.
- Solo se cancela lo que pediste tú y antes de que la cocina empiece.
- Un plato agotado desaparece de la carta y no se puede pedir.
- Happy hour de 6 a 8 pm: bebidas 2x1.
- La carta puede venir de cualquier fuente, pero un plato con precio inválido o sin alérgenos declarados no se muestra.
- La IA propone y el dominio decide: si recomienda algo con un alérgeno que el cliente pidió evitar, o algo picante cuando dijo "que no pique", se descarta.
- No se paga de más. Las reglas se revisan antes de llamar a la pasarela, y si el pago se rechaza la cuenta no cambia.
- Tres formas de dividir: partes iguales, lo que pidió cada uno o eligiendo platos (patrón strategy).
- La cuenta se cierra sola cuando ya no falta pagar nada.

### Puertos de salida y sus adaptadores

| Puerto | Adaptadores |
| --- | --- |
| Carta | archivo JSON, Google Sheets |
| Repositorio | SQLite, memoria |
| Pagos | simulado, caído (rechaza todo) |
| Avisos | WebSocket, consola |
| Reloj | real, simulado |
| Interprete y recomendador | Groq, Gemini, modelo local (Ollama), palabras clave, o en cadena con respaldo |
| Traductor | textos fijos, IA |
| Tipo de cambio | ExchangeRate (real), fijo |

Se cambian en vivo desde el panel del mozo, o al arrancar desde el `.env`.

La opción "respaldo" del mesero prueba en orden Groq, Gemini, el modelo local y por último palabras clave. Si uno falla (sin llave, sin internet o sin cupo gratis), responde el siguiente y la pantalla muestra cuál respondió.

### Adaptadores de entrada

- API web y WebSocket (`adaptadores/entrada/api.py`).
- Comensales virtuales (`bots.py`): llenan las mesas 2 a 7 llamando a los mismos casos de uso, sin pasar por la web.
- Línea de comandos:

```bash
.venv/bin/python -m restaurante.adaptadores.entrada.cli carta
.venv/bin/python -m restaurante.adaptadores.entrada.cli pedir 1 Kalos "2 lomitos y una chicha"
.venv/bin/python -m restaurante.adaptadores.entrada.cli cuenta 1
```

- Las pruebas, con adaptadores de mentira en `tests/dobles.py`.

## Configuración opcional

**IA gratis.** Las llaves se sacan en console.groq.com y aistudio.google.com, y van en el `.env` (que no se sube al repo). Sin llaves funciona igual con el modelo local o con palabras clave. Para el modelo local: instalar Ollama y `ollama pull qwen2.5-coder:3b`.

**Carta en Google Sheets.** Importar `datos/carta.csv` en una hoja, ir a Archivo > Compartir > Publicar en la web, elegir CSV y pegar el link en `CARTA_SHEETS_URL`. En la columna de alérgenos, "ninguno" significa que no tiene; una celda vacía significa que nadie los declaró, y ese plato no se muestra.

**Celulares.** En la misma red wifi basta con la IP de la laptop (por ejemplo http://192.168.1.20:8790). Si la red no deja, se usa un túnel:

```bash
ngrok http 8790
```

y se pone la URL que da en `URL_PUBLICA` para que los QR apunten ahí.
