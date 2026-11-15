import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "../../lib/api";
import { useAvisar } from "../../componentes/Avisos";
import BarraStaff from "../../componentes/BarraStaff";
import Hexagono, { PUERTOS } from "./Hexagono";
import { Actividad, usePanel } from "./eventos";

export default function Arquitectura() {
  const avisar = useAvisar();
  const [sistema, setSistema] = useState({ eleccion: {}, opciones: {} });
  const [cocinaSola, setCocinaSola] = useState(true);
  const cargarSistema = () => api("/api/sistema").then(setSistema).catch(() => {});
  const { datos, eventos, pulsos, cargar } = usePanel({
    alEvento: (e) => { if (e.tipo === "sistema" || e.tipo === "reloj") cargarSistema(); },
  });

  useEffect(() => { cargarSistema(); }, []);

  async function cambiar(puerto, opcion) {
    try {
      await api("/api/sistema/adaptador", { metodo: "POST", cuerpo: { puerto, opcion } });
      avisar(`${PUERTOS[puerto].texto}: ahora con ${PUERTOS[puerto].opciones[opcion]}`, "ok");
      cargarSistema();
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  async function moverReloj(hora) {
    try {
      await api("/api/sistema/reloj", { metodo: "POST", cuerpo: { hora } });
      cargar();
      cargarSistema();
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  async function alternarBots() {
    try {
      if (datos.bots) await api("/api/bots", { metodo: "DELETE" });
      else await api("/api/bots", { metodo: "POST", cuerpo: { mesas: 6, cocina: cocinaSola } });
      cargar();
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  return (
    <>
      <BarraStaff actual="arquitectura" restaurante={datos.restaurante} hora={datos.hora} happyHour={datos.happy_hour} />
      <main className="staff-pagina">
        <div className="staff-titulo">
          <h1>Arquitectura hexagonal</h1>
          <p className="suave">Cada evento ilumina por dónde entró y qué puertos usó. Para cambiar un adaptador, tócalo.</p>
        </div>

        <section className="staff-panel">
          <Hexagono eleccion={sistema.eleccion} cambiar={cambiar} pulsos={pulsos} />
        </section>

        <div className="staff-dos">
          <section className="staff-panel">
            <div className="staff-panel-cabeza"><span className="staff-etiqueta">Controles de la demo</span></div>

            <div className="control">
              <div>
                <b>Comensales virtuales</b>
                <p className="suave chico">Llenan las mesas 2 a 7 con los mismos casos de uso que la web. La mesa 1 queda para personas.</p>
                <label className="chico" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <input type="checkbox" checked={cocinaSola} onChange={(e) => setCocinaSola(e.target.checked)} style={{ accentColor: "var(--naranja)" }} />
                  La cocina avanza sola
                </label>
              </div>
              <button className={`interruptor ${datos.bots ? "activo" : ""}`} onClick={alternarBots} aria-label="Encender o apagar los comensales virtuales">
                <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} style={{ left: datos.bots ? 23 : 3 }} />
              </button>
            </div>

            <div className="control">
              <div>
                <b>Reloj · {sistema.eleccion.reloj === "simulado" ? "simulado" : "real"}</b>
                <p className="suave chico">El happy hour va de 6 a 8 pm. Con el reloj simulado se adelanta la hora.</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  <button className="boton claro chico-boton" onClick={() => moverReloj("18:00")}>6 pm</button>
                  <button className="boton claro chico-boton" onClick={() => moverReloj("21:00")}>9 pm</button>
                  <button className="boton claro chico-boton" onClick={() => moverReloj(null)}>Hora real</button>
                </div>
              </div>
              <span className="staff-reloj grande">{datos.hora}</span>
            </div>
          </section>

          <section className="staff-panel">
            <div className="staff-panel-cabeza"><span className="staff-etiqueta">Actividad</span></div>
            <Actividad eventos={eventos} alto={300} />
          </section>
        </div>
      </main>
    </>
  );
}
