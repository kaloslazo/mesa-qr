import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Fire, ForkKnife, MagnifyingGlass, Minus, Plus, SlidersHorizontal, Timer } from "@phosphor-icons/react";
import { soles, solesCorto } from "../../lib/api";
import { ConChispas, Foto, Hoja, TextoRevelado } from "../../componentes/basicos";
import { ALERGENOS, SECCIONES } from "./datos";

function Paso({ cantidad, alCambiar }) {
  return (
    <div className="paso" onClick={(e) => e.stopPropagation()}>
      <button aria-label="Quitar uno" onClick={() => alCambiar(-1)}><Minus size={14} weight="bold" /></button>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.b key={cantidad} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>
          {cantidad}
        </motion.b>
      </AnimatePresence>
      <button aria-label="Agregar uno" onClick={() => alCambiar(1)}><Plus size={14} weight="bold" /></button>
    </div>
  );
}

function TarjetaPlato({ plato, cantidad, agregar, abrir }) {
  return (
    <motion.article
      layout
      className="plato"
      onClick={abrir}
      variants={{ oculto: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
      whileTap={{ scale: 0.98 }}
    >
      <Foto src={plato.foto} alt={plato.nombre}>
      </Foto>
      <div className="sellos" style={{ position: "absolute", top: 16, left: 16 }}>
        {plato.promo && <span className="sello naranja">2x1</span>}
        {plato.picante && <span className="sello"><Fire size={12} weight="fill" />Picante</span>}
      </div>
      <h3>{plato.nombre}</h3>
      <p className="detalle">{plato.descripcion}</p>
      <div className="pie">
        <span className="precio">{solesCorto(plato.precio)}</span>
        {cantidad > 0 ? (
          <Paso cantidad={cantidad} alCambiar={(n) => agregar(plato.id, n)} />
        ) : (
          <ConChispas>
            <motion.button
              className="mas"
              aria-label={`Agregar ${plato.nombre}`}
              whileTap={{ scale: 0.85, rotate: 90 }}
              onClick={(e) => { e.stopPropagation(); agregar(plato.id, 1); }}
            >
              <Plus size={18} weight="bold" />
            </motion.button>
          </ConChispas>
        )}
      </div>
    </motion.article>
  );
}

function cuentaRegresiva(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${h > 0 ? h + ":" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Banner({ carta, catalogo, verBebidas, irAlAsistente }) {
  // la hora sale del reloj del servidor (puede ser simulado); aqui solo corre el segundero
  const [ahora, setAhora] = useState(() => (carta.ahora ? new Date(carta.ahora) : new Date()));
  useEffect(() => {
    if (!carta.ahora) return;
    const desfase = new Date(carta.ahora).getTime() - Date.now();
    const tic = () => setAhora(new Date(Date.now() + desfase));
    tic();
    const id = setInterval(tic, 1000);
    return () => clearInterval(id);
  }, [carta.ahora]);

  const fin = new Date(ahora);
  fin.setHours(20, 0, 0, 0);
  const inicio = new Date(ahora);
  inicio.setHours(18, 0, 0, 0);
  const fotos = carta.happy_hour
    ? ["pisco_sour", "chicha", "limonada"]
    : ["lomo", "ceviche", "causa"];

  return (
    <motion.section className="banner" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
      <div className="collage">
        {fotos.map((id, i) => (
          <motion.div
            key={id}
            style={{ position: "absolute", right: [58, 20, -12][i], top: [40, 16, 50][i], zIndex: i === 1 ? 2 : 1 }}
            initial={{ opacity: 0, y: 20, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: [-9, 4, 12][i] }}
            transition={{ delay: 0.15 + i * 0.08, type: "spring", stiffness: 200, damping: 18 }}
          >
            <Foto src={catalogo[id]?.foto} style={{ position: "static" }} />
          </motion.div>
        ))}
      </div>
      {carta.happy_hour ? (
        <>
          <span className="reloj"><Timer size={15} weight="bold" />termina en {cuentaRegresiva(Math.max(0, Math.round((fin - ahora) / 1000)))}</span>
          <div>
            <h2>Happy hour en curso</h2>
            <p>Las bebidas van 2x1 hasta las 8 de la noche.</p>
          </div>
          <button className="boton" onClick={verBebidas}>Ver bebidas <ArrowRight size={16} weight="bold" /></button>
        </>
      ) : (
        <>
          <span className="reloj">
            <Timer size={15} weight="bold" />
            {ahora < inicio ? `happy hour en ${cuentaRegresiva(Math.round((inicio - ahora) / 1000))}` : "happy hour mañana a las 6"}
          </span>
          <div>
            <h2>Pide como le hablas al mozo</h2>
            <p>Escríbelo o díctalo y se arma tu pedido.</p>
          </div>
          <button className="boton" onClick={irAlAsistente}>Probar <ArrowRight size={16} weight="bold" /></button>
        </>
      )}
    </motion.section>
  );
}

export default function Carta({ yo, carta, catalogo, carrito, agregar, sin, setSin, sinPicante, setSinPicante, irAlAsistente }) {
  const [busqueda, setBusqueda] = useState("");
  const [seccion, setSeccion] = useState("todo");
  const [detalle, setDetalle] = useState(null);
  const [cantidadDetalle, setCantidadDetalle] = useState(1);
  const [filtros, setFiltros] = useState(false);

  const platos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return carta.platos.filter(
      (p) => (seccion === "todo" || p.seccion === seccion) && (!texto || p.nombre.toLowerCase().includes(texto))
    );
  }, [carta.platos, seccion, busqueda]);

  const fotoSeccion = (valor) => Object.values(catalogo).find((p) => p.seccion === valor)?.foto;
  const filtrosActivos = sin.length + (sinPicante ? 1 : 0);

  return (
    <>
      <div className="saludo">
        <p>Hola, {yo}</p>
        <TextoRevelado texto="¿Qué van a pedir hoy?" />
      </div>

      <div className="buscador">
        <label className="caja">
          <MagnifyingGlass size={19} color="var(--suave)" />
          <input placeholder="Buscar en la carta" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </label>
        <button className="filtro" onClick={() => setFiltros(true)} aria-label="Filtrar por alérgenos">
          <SlidersHorizontal size={20} weight="bold" />
          {filtrosActivos > 0 && <span className="contador-rojo">{filtrosActivos}</span>}
        </button>
      </div>

      <Banner carta={carta} catalogo={catalogo} verBebidas={() => setSeccion("bebidas")} irAlAsistente={irAlAsistente} />

      <div className="secciones">
        {SECCIONES.map(({ valor, texto }) => (
          <button key={valor} className={`seccion ${seccion === valor ? "activo" : ""}`} onClick={() => setSeccion(valor)}>
            {seccion === valor && <motion.span layoutId="fondo-seccion" className="fondo" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            {valor === "todo" ? (
              <span className="foto" style={{ display: "grid", placeItems: "center", background: "var(--naranja)", color: "#fff" }}>
                <ForkKnife size={17} weight="bold" />
              </span>
            ) : (
              <Foto src={fotoSeccion(valor)} />
            )}
            <span>{texto}</span>
          </button>
        ))}
      </div>

      <div className="titulo-fila">
        <h2>{SECCIONES.find((s) => s.valor === seccion)?.texto === "Todo" ? "Toda la carta" : SECCIONES.find((s) => s.valor === seccion)?.texto}</h2>
        <span className="suave chico">{platos.length} {platos.length === 1 ? "plato" : "platos"}</span>
      </div>

      {platos.length === 0 ? (
        <div className="vacio">
          <ForkKnife size={30} weight="duotone" />
          <p>No hay platos con esos filtros.</p>
        </div>
      ) : (
        <motion.div
          key={seccion + sin.join() + sinPicante}
          className="rejilla-platos"
          initial="oculto"
          animate="visible"
          transition={{ staggerChildren: 0.04 }}
        >
          {platos.map((plato) => (
            <TarjetaPlato
              key={plato.id}
              plato={plato}
              cantidad={carrito[plato.id] || 0}
              agregar={agregar}
              abrir={() => { setDetalle(plato); setCantidadDetalle(1); }}
            />
          ))}
        </motion.div>
      )}

      <Hoja abierta={!!detalle} alCerrar={() => setDetalle(null)}>
        {detalle && (
          <>
            <Foto src={detalle.foto} alt={detalle.nombre} className="detalle-foto" />
            <div className="detalle-cabeza">
              <h2>{detalle.nombre}</h2>
              <span className="precio">{soles(detalle.precio)}</span>
            </div>
            <p className="suave" style={{ marginTop: 8 }}>{detalle.descripcion}</p>
            <div className="fila-etiquetas">
              {detalle.promo && <span className="etiqueta naranja">2x1 en happy hour</span>}
              {detalle.picante && <span className="etiqueta rojo"><Fire size={13} weight="fill" />Picante</span>}
              {detalle.alergenos.length === 0 && <span className="etiqueta verde">Sin alérgenos declarados</span>}
              {detalle.alergenos.map((a) => {
                const info = ALERGENOS[a] || { texto: a };
                const Icono = info.Icono;
                return <span key={a} className="etiqueta">{Icono && <Icono size={13} weight="bold" />}{info.texto}</span>;
              })}
            </div>
            <div className="detalle-pie">
              <Paso cantidad={cantidadDetalle} alCambiar={(n) => setCantidadDetalle((c) => Math.min(10, Math.max(1, c + n)))} />
              <ConChispas style={{ flex: 1, display: "flex" }}>
                <button className="boton ancho" onClick={() => { agregar(detalle.id, cantidadDetalle); setDetalle(null); }}>
                  Agregar · {soles((detalle.promo ? cantidadDetalle - Math.floor(cantidadDetalle / 2) : cantidadDetalle) * detalle.precio)}
                </button>
              </ConChispas>
            </div>
          </>
        )}
      </Hoja>

      <Hoja abierta={filtros} alCerrar={() => setFiltros(false)}>
        <h2>Filtrar la carta</h2>
        <p className="suave" style={{ marginTop: 4 }}>Se esconden los platos que tengan lo que marques.</p>
        <div className="opciones-filtro">
          {Object.entries(ALERGENOS).map(([clave, { texto, Icono }]) => {
            const activo = sin.includes(clave);
            return (
              <motion.button
                key={clave}
                whileTap={{ scale: 0.94 }}
                className={`opcion ${activo ? "activo" : ""}`}
                onClick={() => setSin(activo ? sin.filter((x) => x !== clave) : [...sin, clave])}
              >
                <Icono size={17} weight={activo ? "fill" : "regular"} />Sin {texto.toLowerCase()}
              </motion.button>
            );
          })}
          <motion.button whileTap={{ scale: 0.94 }} className={`opcion ${sinPicante ? "activo" : ""}`} onClick={() => setSinPicante(!sinPicante)}>
            <Fire size={17} weight={sinPicante ? "fill" : "regular"} />Nada picante
          </motion.button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="boton claro" onClick={() => { setSin([]); setSinPicante(false); }}>Limpiar</button>
          <button className="boton ancho" onClick={() => setFiltros(false)}>Ver {carta.platos.length} platos</button>
        </div>
      </Hoja>
    </>
  );
}
