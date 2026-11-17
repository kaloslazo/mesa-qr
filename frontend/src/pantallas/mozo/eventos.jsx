import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellSimpleRinging, ChefHat, Clock, Coins, CookingPot, ForkKnife, Plugs, Receipt, UserPlus } from "@phosphor-icons/react";
import { api, soles, useAvisos, useCada } from "../../lib/api";
import { PUERTOS } from "./Hexagono";

export const MOTIVOS = {
  atencion: "pide que vayas a la mesa",
  cubiertos: "pide cubiertos o servilletas",
  cuenta: "pide la cuenta",
};

const ESTADOS = { preparando: "en preparación", servido: "servido", pedido: "en espera" };

// solo estos avisos se muestran, para no repetir el mismo evento por varios canales
const mostrable = (e) => e.canal === "mozo" || e.canal === "todos" || (e.canal === "cocina" && ["estado", "cancelado"].includes(e.tipo));

// que entradas y puertos toca cada evento (para iluminarlos en el diagrama)
export function tocados(e, botsActivos) {
  const cliente = botsActivos && e.mesa >= 2 && e.mesa <= 7 ? "bots" : "web";
  const mapa = {
    comensal: [cliente, "repositorio", "avisos"],
    pedido: [cliente, "repositorio", "avisos"],
    pago: [cliente, "pagos", "repositorio", "avisos"],
    cancelado: [cliente, "repositorio", "avisos"],
    llamado: [cliente, "repositorio", "avisos"],
    estado: [botsActivos ? "bots" : "cocina", "repositorio", "avisos"],
    carta: ["cocina", "repositorio", "avisos"],
    atendido: ["mozo", "repositorio", "avisos"],
    reloj: ["mozo", "reloj", "avisos"],
    sistema: ["mozo", "avisos"],
  };
  return [...(mapa[e.tipo] || ["avisos"]), "nucleo"];
}

function describir(e, platos, eleccionAnterior) {
  switch (e.tipo) {
    case "comensal": return { Icono: UserPlus, texto: `${e.nombre} se sentó en la mesa ${e.mesa}` };
    case "pedido": return { Icono: ForkKnife, texto: `Mesa ${e.mesa} · ${e.comensal} pidió ${e.platos.join(", ")}` };
    case "estado": return { Icono: CookingPot, texto: `Mesa ${e.mesa} · ${e.item.nombre} ${ESTADOS[e.item.estado]}` };
    case "cancelado": return { Icono: ForkKnife, texto: `Mesa ${e.mesa} · se canceló ${e.plato}` };
    case "pago": return { Icono: Coins, texto: `Mesa ${e.mesa} · ${e.comensal} pagó ${soles(e.monto)} con ${e.medio}${e.cerrada ? "; cuenta cerrada" : ""}` };
    case "carta": return { Icono: ChefHat, texto: `${platos[e.plato_id]?.nombre || e.plato_id} ${e.agotado ? "se agotó" : "vuelve a la carta"}` };
    case "llamado": return { Icono: BellSimpleRinging, texto: `Mesa ${e.mesa} · ${e.comensal} ${MOTIVOS[e.motivo]}`, importante: true };
    case "atendido": return { Icono: BellSimpleRinging, texto: `Mesa ${e.mesa} · llamado atendido` };
    case "reloj": return { Icono: Clock, texto: "Se movió el reloj del restaurante" };
    case "sistema": {
      const cambio = Object.keys(PUERTOS).find((p) => e[p] && eleccionAnterior[p] && e[p] !== eleccionAnterior[p]);
      return { Icono: Plugs, texto: cambio ? `${PUERTOS[cambio].texto} ahora usa ${PUERTOS[cambio].opciones[e[cambio]]}` : "Se cambió un adaptador" };
    }
    default: return { Icono: Receipt, texto: e.tipo };
  }
}

// datos del salon + avisos en vivo, compartido por las pantallas del personal
export function usePanel({ alEvento } = {}) {
  const [datos, setDatos] = useState({ mesas: [], hora: "", happy_hour: false, bots: false, total_mesas: 8, restaurante: "" });
  const [platos, setPlatos] = useState({});
  const [eventos, setEventos] = useState([]);
  const [pulsos, setPulsos] = useState({});
  const [, setTic] = useState(0);
  const eleccion = useRef({});

  const cargar = () => api("/api/mozo").then(setDatos).catch(() => {});

  useEffect(() => {
    cargar();
    api("/api/cocina").then((c) => setPlatos(Object.fromEntries(c.platos.map((p) => [p.id, p])))).catch(() => {});
    api("/api/sistema").then((s) => (eleccion.current = s.eleccion)).catch(() => {});
  }, []);

  useCada(3000, cargar);

  useAvisos(["*"], (evento) => {
    if (!mostrable(evento)) return;
    const ahora = Date.now();
    const { texto, Icono, importante } = describir(evento, platos, eleccion.current);
    if (evento.tipo === "sistema") eleccion.current = { ...eleccion.current, ...evento };
    setPulsos((p) => ({ ...p, ...Object.fromEntries(tocados(evento, datos.bots).map((k) => [k, ahora])) }));
    setTimeout(() => setTic((t) => t + 1), 1600);
    setEventos((lista) => [
      { id: ahora + Math.random(), texto, Icono, importante, hora: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) },
      ...lista,
    ].slice(0, 40));
    alEvento?.(evento, texto);
    cargar();
  });

  return { datos, platos, eventos, pulsos, cargar };
}

export function Actividad({ eventos, alto = 360 }) {
  return (
    <div className="actividad" style={{ maxHeight: alto }}>
      {eventos.length === 0 && <p className="suave chico">Todavía no pasa nada. Cuando alguien pida, pague o llame, aparece aquí.</p>}
      <AnimatePresence initial={false}>
        {eventos.map((e) => (
          <motion.div
            key={e.id}
            layout
            className={`evento ${e.importante ? "importante" : ""}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <e.Icono size={16} weight="duotone" />
            <span>{e.texto}</span>
            <time>{e.hora.slice(0, 5)}</time>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
