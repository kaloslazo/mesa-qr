import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cloud, Cpu, ListMagnifyingGlass, PaperPlaneRight, Plus, XCircle } from "@phosphor-icons/react";
import { api, soles } from "../../lib/api";
import { ConChispas, Foto, Puntos, Segmentado } from "../../componentes/basicos";

const EJEMPLOS = {
  pedir: ["2 lomitos y una chicha", "un cebiche y dos chelas bien heladas", "una causa, un suspiro y una hamburguesa"],
  recomendar: ["algo sin gluten que no pique", "tengo mucha sed", "algo ligero, sin mariscos"],
};

const PROVEEDORES = {
  groq: { texto: "Groq", Icono: Cloud },
  gemini: { texto: "Gemini", Icono: Cloud },
  local: { texto: "Modelo local", Icono: Cpu },
  "palabras clave": { texto: "Palabras clave (sin IA)", Icono: ListMagnifyingGlass },
};

// "local (antes: falta GROQ_API_KEY; ...)" -> quien respondio y que fallo antes
function Fuente({ texto }) {
  const [quien, ...resto] = texto.split(" (antes: ");
  const info = PROVEEDORES[quien] || { texto: quien, Icono: Cpu };
  const antes = resto.join("").replace(/\)$/, "");
  return (
    <div style={{ marginTop: 14 }}>
      <div className="fuente" style={{ marginTop: 0 }}>
        <info.Icono size={15} weight="duotone" />
        Respondió <b style={{ color: "var(--tinta)" }}>{info.texto}</b>
      </div>
      {antes && <p className="suave" style={{ fontSize: 12, marginTop: 2 }}>Antes no respondió: {antes}</p>}
    </div>
  );
}

function Descartados({ lista }) {
  return lista.map((d, i) => (
    <motion.div
      key={d.plato + i}
      className="descartado"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + i * 0.07 }}
    >
      <XCircle size={18} weight="fill" />
      <span><b>{d.plato}</b>: {d.motivo}</span>
    </motion.div>
  ));
}

export default function Asistente({ ruta, catalogo, enviar, agregar, sin, sinPicante }) {
  const [modo, setModo] = useState("pedir");
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  async function preguntar(e) {
    e?.preventDefault();
    if (!texto.trim()) return;
    setCargando(true);
    setError("");
    setResultado(null);
    try {
      const r = modo === "pedir"
        ? await api(ruta("/interpretar"), { metodo: "POST", cuerpo: { texto } })
        : await api(ruta("/recomendar"), { metodo: "POST", cuerpo: { deseo: texto, sin, sin_picante: sinPicante } });
      setResultado({ modo, ...r });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <div className="saludo">
        <p>Asistente</p>
        <h1>{modo === "pedir" ? "Dilo como se lo dirías al mozo" : "¿No sabes qué pedir?"}</h1>
      </div>

      <Segmentado
        id="modo"
        valor={modo}
        alCambiar={(m) => { setModo(m); setResultado(null); setError(""); setTexto(""); }}
        opciones={[{ valor: "pedir", texto: "Pedir con texto" }, { valor: "recomendar", texto: "Recomiéndame" }]}
      />

      <form className="tarjeta asistente-caja" onSubmit={preguntar}>
        <textarea
          className="campo"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={modo === "pedir" ? "Ej.: dos lomitos y una chicha para la mesa" : "Ej.: algo sin gluten que no pique"}
        />
        <div className="pie">
          <span className="suave chico">En el iPhone puedes dictarlo con el micrófono del teclado.</span>
          <motion.button className="boton" whileTap={{ scale: 0.94 }} disabled={cargando || !texto.trim()} aria-label="Enviar">
            <PaperPlaneRight size={18} weight="fill" />
          </motion.button>
        </div>
      </form>

      <div className="ejemplos">
        {EJEMPLOS[modo].map((ej) => (
          <button key={ej} className="ejemplo" onClick={() => setTexto(ej)}>{ej}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {cargando && (
          <motion.div key="cargando" className="tarjeta respuesta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Puntos /> <span className="suave">{modo === "pedir" ? "Leyendo tu pedido" : "Buscando en la carta"}</span>
          </motion.div>
        )}

        {error && (
          <motion.div key="error" className="tarjeta respuesta" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="descartado"><XCircle size={18} weight="fill" />{error}</div>
          </motion.div>
        )}

        {resultado?.modo === "pedir" && (
          <motion.div key="pedido" className="tarjeta respuesta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h3>{resultado.lineas.length ? "Esto entendí" : "No encontré platos de la carta"}</h3>
            {resultado.lineas.map((l, i) => (
              <motion.div key={l.plato_id} className="linea-plato" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                <Foto src={catalogo[l.plato_id]?.foto} />
                <div className="nombre"><b>{l.nombre}</b><span className="suave chico">{soles(catalogo[l.plato_id]?.precio || 0)} c/u</span></div>
                <span className="etiqueta naranja">x {l.cantidad}</span>
              </motion.div>
            ))}
            <Descartados lista={resultado.descartados} />
            <Fuente texto={resultado.fuente} />
            {resultado.lineas.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="boton claro" onClick={() => { resultado.lineas.forEach((l) => agregar(l.plato_id, l.cantidad)); setResultado(null); setTexto(""); }}>
                  Revisar antes
                </button>
                <ConChispas style={{ flex: 1, display: "flex" }}>
                  <button
                    className="boton ancho"
                    onClick={async () => {
                      if (await enviar(resultado.lineas.map((l) => [l.plato_id, l.cantidad]))) { setResultado(null); setTexto(""); }
                    }}
                  >
                    Enviar a cocina
                  </button>
                </ConChispas>
              </div>
            )}
          </motion.div>
        )}

        {resultado?.modo === "recomendar" && (
          <motion.div key="recomendacion" className="tarjeta respuesta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h3>{resultado.platos.length ? "Te recomiendo" : "No encontré algo que cumpla"}</h3>
            {(resultado.restricciones.sin.length > 0 || resultado.restricciones.sin_picante) && (
              <div className="fila-etiquetas" style={{ margin: "8px 0 2px" }}>
                {resultado.restricciones.sin.map((a) => <span key={a} className="etiqueta">sin {a}</span>)}
                {resultado.restricciones.sin_picante && <span className="etiqueta">sin picante</span>}
              </div>
            )}
            {resultado.platos.map((p, i) => (
              <motion.div key={p.id} className="linea-plato" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                <Foto src={p.foto} />
                <div className="nombre"><b>{p.nombre}</b><span className="suave chico">{soles(p.precio)}</span></div>
                <motion.button className="mas" whileTap={{ scale: 0.85 }} aria-label={`Agregar ${p.nombre}`} onClick={() => agregar(p.id, 1)}>
                  <Plus size={16} weight="bold" />
                </motion.button>
              </motion.div>
            ))}
            {resultado.descartados.length > 0 && <p className="suave chico" style={{ marginTop: 10 }}>La IA también sugirió estos, pero no cumplen:</p>}
            <Descartados lista={resultado.descartados} />
            <Fuente texto={resultado.fuente} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
