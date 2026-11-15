import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpenText, Broadcast, ChefHat, Clock, CreditCard, Cpu, CurrencyCircleDollar, Database,
  DeviceMobile, Monitor, Robot, Terminal, TestTube, Translate,
} from "@phosphor-icons/react";

export const PUERTOS = {
  carta: { texto: "Carta", Icono: BookOpenText, opciones: { json: "Archivo JSON", sheets: "Google Sheets" } },
  repositorio: { texto: "Base de datos", Icono: Database, opciones: { sqlite: "SQLite", memoria: "Memoria" } },
  pagos: { texto: "Pagos", Icono: CreditCard, opciones: { simulado: "Simulado", caido: "Caído" } },
  avisos: { texto: "Avisos en vivo", Icono: Broadcast, opciones: { websocket: "WebSocket", consola: "Consola" } },
  reloj: { texto: "Reloj", Icono: Clock, opciones: { real: "Real", simulado: "Simulado" } },
  ia: { texto: "Mesero con IA", Icono: Cpu, opciones: { respaldo: "En cadena", groq: "Groq", gemini: "Gemini", local: "Local", palabras: "Sin IA" } },
  traductor: { texto: "Traductor", Icono: Translate, opciones: { fijo: "Fijo", ia: "IA" } },
  cambio: { texto: "Tipo de cambio", Icono: CurrencyCircleDollar, opciones: { exchangerate: "ExchangeRate", fijo: "Fijo" } },
};

const ENTRADAS = [
  { id: "web", texto: "Web de la mesa", Icono: DeviceMobile },
  { id: "cocina", texto: "Pantalla de cocina", Icono: ChefHat },
  { id: "mozo", texto: "Panel del mozo", Icono: Monitor },
  { id: "bots", texto: "Comensales virtuales", Icono: Robot },
  { id: "cli", texto: "Línea de comandos", Icono: Terminal },
  { id: "pruebas", texto: "Pruebas", Icono: TestTube },
];

// punto del borde del hexagono (viewBox 300x300) para una altura dada
function bordeX(y, lado) {
  const desde = Math.abs(150 - y) / 130 * 65;
  return lado === "izq" ? 10 + desde : 290 - desde;
}

function Latido({ cuando }) {
  return (
    <AnimatePresence>
      {cuando && Date.now() - cuando < 1500 && (
        <motion.span
          key={cuando}
          className="latido"
          initial={{ scale: 0.4, opacity: 1 }}
          animate={{ scale: [1, 2.4, 1], opacity: [1, 0.3, 1] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
        />
      )}
    </AnimatePresence>
  );
}

export default function Hexagono({ eleccion, cambiar, pulsos }) {
  const caja = useRef(null);
  const nucleo = useRef(null);
  const nodos = useRef({});
  const [lineas, setLineas] = useState([]);

  useLayoutEffect(() => {
    const medir = () => {
      if (!caja.current || !nucleo.current) return;
      const base = caja.current.getBoundingClientRect();
      const hex = nucleo.current.getBoundingClientRect();
      const escala = hex.width / 300;
      const nuevas = [];
      const izquierda = ENTRADAS.map((e) => e.id);
      const derecha = Object.keys(PUERTOS);

      const anclar = (ids, lado) =>
        ids.forEach((id, i) => {
          const el = nodos.current[id];
          if (!el) return;
          const r = el.getBoundingClientRect();
          const yVista = 60 + (180 * (i + 0.5)) / ids.length;
          const x2 = hex.left - base.left + bordeX(yVista, lado) * escala;
          const y2 = hex.top - base.top + yVista * escala;
          const x1 = lado === "izq" ? r.right - base.left : r.left - base.left;
          const y1 = r.top - base.top + r.height / 2;
          const curva = (x2 - x1) * 0.5;
          nuevas.push({ id, d: `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}`, x2, y2 });
        });

      anclar(izquierda, "izq");
      anclar(derecha, "der");
      setLineas(nuevas);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(caja.current);
    return () => observador.disconnect();
  }, [eleccion]);

  const reciente = (id) => pulsos[id] && Date.now() - pulsos[id] < 1500;

  return (
    <div className="hexa" ref={caja}>
      <svg className="conectores" aria-hidden="true">
        {lineas.map((l) => (
          <g key={l.id}>
            <motion.path
              d={l.d}
              fill="none"
              stroke={reciente(l.id) ? "var(--naranja)" : "var(--superficie-3)"}
              strokeWidth={reciente(l.id) ? 2.5 : 1.5}
              strokeDasharray="5 7"
              animate={{ strokeDashoffset: [0, -24] }}
              transition={{ duration: reciente(l.id) ? 0.4 : 1.6, repeat: Infinity, ease: "linear" }}
            />
            <circle cx={l.x2} cy={l.y2} r={4} fill={reciente(l.id) ? "var(--naranja)" : "var(--superficie-3)"} />
          </g>
        ))}
      </svg>

      <div className="lado">
        <span className="suave chico" style={{ fontWeight: 600 }}>Adaptadores de entrada</span>
        {ENTRADAS.map(({ id, texto, Icono }) => (
          <div key={id} className="nodo" ref={(el) => (nodos.current[id] = el)}>
            <div className="nombre"><Icono size={17} weight="duotone" />{texto}</div>
            <Latido cuando={pulsos[id]} />
          </div>
        ))}
      </div>

      <div className="nucleo">
        <svg viewBox="0 0 300 300" ref={nucleo}>
          <motion.polygon
            points="75,20 225,20 290,150 225,280 75,280 10,150"
            fill="var(--naranja-suave)"
            stroke="var(--naranja)"
            strokeWidth="2"
            animate={{ scale: pulsos.nucleo && Date.now() - pulsos.nucleo < 900 ? [1, 1.03, 1] : 1 }}
            transition={{ duration: 0.5 }}
            style={{ transformOrigin: "150px 150px" }}
          />
          <polygon points="100,62 200,62 244,150 200,238 100,238 56,150" fill="var(--superficie)" stroke="var(--naranja)" strokeWidth="1" strokeDasharray="4 5" opacity="0.9" />
          <text x="150" y="44" textAnchor="middle" fontSize="11" fill="var(--naranja-tinta)" fontWeight="600">casos de uso</text>
          <text x="150" y="112" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--tinta)" style={{ fontFamily: "var(--fuente-titulo)" }}>Dominio</text>
          {["cuenta compartida", "agotados", "happy hour 2x1", "no pagar de más", "juntos o separados"].map((regla, i) => (
            <text key={regla} x="150" y={140 + i * 19} textAnchor="middle" fontSize="12" fill="var(--suave)">{regla}</text>
          ))}
        </svg>
      </div>

      <div className="puertos">
        <span className="suave chico" style={{ fontWeight: 600, gridColumn: "1 / -1" }}>Puertos de salida · toca para cambiar el adaptador</span>
        {Object.entries(PUERTOS).map(([id, { texto, Icono, opciones }]) => (
          <motion.div key={id} className="nodo" ref={(el) => (nodos.current[id] = el)} layout>
            <div className="nombre"><Icono size={17} weight="duotone" />{texto}</div>
            <div className="opciones">
              {Object.entries(opciones).map(([valor, etiqueta]) => (
                <button key={valor} className={eleccion[id] === valor ? "activo" : ""} onClick={() => cambiar(id, valor)}>
                  {etiqueta}
                </button>
              ))}
            </div>
            <Latido cuando={pulsos[id]} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
