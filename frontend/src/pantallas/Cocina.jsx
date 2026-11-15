import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Clock, CookingPot, Martini } from "@phosphor-icons/react";
import { api, useAvisos, useCada } from "../lib/api";
import { useAvisar } from "../componentes/Avisos";
import { Foto, Segmentado } from "../componentes/basicos";
import BarraStaff from "../componentes/BarraStaff";

const COLUMNAS = [
  { estado: "pedido", titulo: "En espera", Icono: Clock, accion: "Empezar" },
  { estado: "preparando", titulo: "Preparando", Icono: CookingPot, accion: "Servir" },
];

// minutos desde que se pidio, con la hora del servidor
function minutos(hora, ahora) {
  return Math.max(0, Math.round((new Date(ahora) - new Date(hora)) / 60000));
}

function colorTiempo(min) {
  if (min >= 15) return "rojo";
  if (min >= 8) return "ambar";
  return "verde";
}

export default function Cocina() {
  const avisar = useAvisar();
  const [datos, setDatos] = useState({ pendientes: [], platos: [], ahora: null, hora: "" });
  const [estacion, setEstacion] = useState("todo");
  const [restaurante, setRestaurante] = useState("");

  async function cargar() {
    try {
      setDatos(await api("/api/cocina"));
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  useEffect(() => {
    cargar();
    api("/api/info").then((d) => setRestaurante(d.restaurante)).catch(() => {});
  }, []);
  useAvisos(["cocina"], cargar);
  useCada(5000, cargar);

  const fotos = Object.fromEntries(datos.platos.map((p) => [p.plato_id ?? p.id, p.foto]));
  const visibles = datos.pendientes.filter((i) => estacion === "todo" || i.estacion === estacion);

  async function avanzar(item) {
    try {
      await api(`/api/cocina/${item.mesa}/${item.id}/avanzar`, { metodo: "POST" });
      cargar();
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  async function agotar(plato) {
    try {
      await api(`/api/platos/${plato.id}/agotado`, { metodo: "POST", cuerpo: { agotado: !plato.agotado } });
      avisar(plato.agotado ? `${plato.nombre} vuelve a la carta` : `${plato.nombre} salió de la carta`, "ok");
      cargar();
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  return (
    <>
    <BarraStaff actual="cocina" restaurante={restaurante} hora={datos.hora} happyHour={datos.happy_hour} />
    <div className="staff-pagina">
      <div className="staff-titulo con-acciones">
        <div>
          <h1>Cocina y barra</h1>
          <p className="suave">{visibles.length} platos por preparar. Toca el botón de cada comanda para avanzarla.</p>
        </div>
        <Segmentado
          id="estacion"
          valor={estacion}
          alCambiar={setEstacion}
          opciones={[
            { valor: "todo", texto: "Todo" },
            { valor: "cocina", texto: "Cocina", icono: <CookingPot size={15} weight="bold" /> },
            { valor: "barra", texto: "Barra", icono: <Martini size={15} weight="bold" /> },
          ]}
        />
      </div>

      <LayoutGroup>
        <div className="tablero">
          {COLUMNAS.map(({ estado, titulo, Icono, accion }) => {
            const items = visibles.filter((i) => i.estado === estado);
            return (
              <section className="columna" key={estado}>
                <div className="columna-cabeza">
                  <Icono size={22} weight="duotone" color="var(--naranja)" />
                  <h2>{titulo}</h2>
                  <span className="etiqueta">{items.length}</span>
                </div>
                <div className="comandas">
                  <AnimatePresence mode="popLayout">
                    {items.map((item) => {
                      const min = datos.ahora ? minutos(item.hora, datos.ahora) : 0;
                      return (
                        <motion.article
                          key={`${item.mesa}-${item.id}`}
                          layout
                          layoutId={`${item.mesa}-${item.id}`}
                          className="comanda"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        >
                          <div className="arriba">
                            <Foto src={fotos[item.plato_id]} />
                            <div style={{ minWidth: 0 }}>
                              <div className="mesa-n">Mesa {item.mesa}</div>
                              <div className="que">{item.cantidad} x {item.nombre}</div>
                            </div>
                          </div>
                          <div className="abajo">
                            <span className="suave chico">{item.comensal}</span>
                            <span className={`etiqueta ${colorTiempo(min)}`}><Clock size={12} weight="bold" />{min} min</span>
                          </div>
                          <motion.button className={`boton ${estado === "pedido" ? "claro" : ""}`} whileTap={{ scale: 0.95 }} onClick={() => avanzar(item)}>
                            {accion}
                          </motion.button>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                  {items.length === 0 && <p className="suave" style={{ padding: "18px 6px" }}>Nada por aquí.</p>}
                </div>
              </section>
            );
          })}
        </div>
      </LayoutGroup>

      <section style={{ marginTop: 26 }}>
        <h2>Agotados</h2>
        <p className="suave">Toca un plato para sacarlo de la carta; desaparece al instante en todos los celulares.</p>
        <div className="agotados">
          {datos.platos.map((plato) => (
            <motion.button key={plato.id} whileTap={{ scale: 0.96 }} className={`agotable ${plato.agotado ? "agotado" : ""}`} onClick={() => agotar(plato)}>
              <Foto src={plato.foto} />
              <b>{plato.nombre}</b>
              <div className="estado">{plato.agotado ? "Agotado" : "Disponible"}</div>
            </motion.button>
          ))}
        </div>
      </section>
    </div>
    </>
  );
}
