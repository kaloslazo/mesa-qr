import { motion } from "motion/react";
import { Basket, BellRinging, ForkKnife, HandWaving, Minus, Moon, Plus, Receipt, Sun } from "@phosphor-icons/react";
import { soles, useTema } from "../../lib/api";
import { ConChispas, Foto, Hoja, Segmentado } from "../../componentes/basicos";

const MOTIVOS = [
  { valor: "atencion", texto: "Que venga a la mesa", Icono: HandWaving },
  { valor: "cubiertos", texto: "Cubiertos o servilletas", Icono: ForkKnife },
  { valor: "cuenta", texto: "Traer la cuenta", Icono: Receipt },
];

export function HojaMozo({ abierta, alCerrar, llamado, llamar }) {
  return (
    <Hoja abierta={abierta} alCerrar={alCerrar}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <motion.span
          className="icono-boton"
          style={{ background: "var(--naranja-suave)", color: "var(--naranja)", border: 0 }}
          animate={{ rotate: [0, -16, 14, -10, 8, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.6 }}
        >
          <BellRinging size={22} weight="fill" />
        </motion.span>
        <div>
          <h2>Llamar al mozo</h2>
          <p className="suave chico">{llamado ? "Ya está avisado; puedes cambiar el motivo en un minuto." : "Le llega al panel del mozo al instante."}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {MOTIVOS.map(({ valor, texto, Icono }) => (
          <motion.button
            key={valor}
            whileTap={{ scale: 0.97 }}
            className={`opcion-grande ${llamado === valor ? "activo" : ""}`}
            onClick={() => llamar(valor)}
          >
            <span className="icono"><Icono size={22} weight="duotone" /></span>
            <b>{texto}</b>
            {llamado === valor && <span className="etiqueta naranja">avisado</span>}
          </motion.button>
        ))}
      </div>
    </Hoja>
  );
}

export function HojaAjustes({ abierta, alCerrar, idioma, setIdioma, yo }) {
  const [tema, , setTema] = useTema();
  return (
    <Hoja abierta={abierta} alCerrar={alCerrar}>
      <h2>Ajustes</h2>
      <p className="suave chico" style={{ marginTop: 2 }}>Estás en la mesa como {yo}.</p>
      <h3 style={{ margin: "18px 0 8px" }}>Idioma de la carta</h3>
      <Segmentado
        id="idioma"
        valor={idioma}
        alCambiar={setIdioma}
        opciones={[{ valor: "es", texto: "Español" }, { valor: "en", texto: "English" }, { valor: "de", texto: "Deutsch" }]}
      />
      <h3 style={{ margin: "18px 0 8px" }}>Apariencia</h3>
      <Segmentado
        id="tema"
        valor={tema}
        alCambiar={setTema}
        opciones={[
          { valor: "claro", texto: "Claro", icono: <Sun size={16} weight="bold" /> },
          { valor: "oscuro", texto: "Oscuro", icono: <Moon size={16} weight="bold" /> },
        ]}
      />
      <p className="suave chico" style={{ marginTop: 20 }}>Fotos de los platos: Wikimedia Commons.</p>
    </Hoja>
  );
}

// lo que se va a pedir, antes de mandarlo a cocina
export function HojaCanasta({ abierta, alCerrar, carrito, catalogo, agregar, enviar, total }) {
  const lineas = Object.entries(carrito).filter(([id]) => catalogo[id]);
  const hayPromo = lineas.some(([id, c]) => catalogo[id].promo && c > 1);

  return (
    <Hoja abierta={abierta} alCerrar={alCerrar}>
      <h2>Tu pedido</h2>
      {lineas.length === 0 ? (
        <div className="vacio">
          <Basket size={34} weight="duotone" />
          <p>Todavía no agregas nada.</p>
          <button className="boton claro" style={{ marginTop: 14 }} onClick={alCerrar}>Ver la carta</button>
        </div>
      ) : (
        <>
          <p className="suave chico" style={{ marginTop: 2 }}>Revísalo antes de mandarlo; después solo se puede cancelar lo que la cocina no empezó.</p>
          <div style={{ marginTop: 12 }}>
            {lineas.map(([id, cantidad]) => {
              const plato = catalogo[id];
              const pagadas = plato.promo ? cantidad - Math.floor(cantidad / 2) : cantidad;
              return (
                <motion.div key={id} layout className="linea-plato" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Foto src={plato.foto} />
                  <div className="nombre">
                    <b>{plato.nombre}</b>
                    <span className="suave chico">{soles(plato.precio * pagadas)}{plato.promo && cantidad > 1 ? " · 2x1" : ""}</span>
                  </div>
                  <div className="paso">
                    <button aria-label="Quitar uno" onClick={() => agregar(id, -1)}><Minus size={14} weight="bold" /></button>
                    <b>{cantidad}</b>
                    <button aria-label="Agregar uno" onClick={() => agregar(id, 1)}><Plus size={14} weight="bold" /></button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="total-canasta">
            <span>Total</span>
            <b>{soles(total)}</b>
          </div>
          {hayPromo && <p className="suave chico">Las bebidas en happy hour ya están con el 2x1.</p>}
          <ConChispas style={{ marginTop: 16 }}>
            <button
              className="boton ancho"
              style={{ padding: 16 }}
              onClick={async () => { if (await enviar(lineas)) alCerrar(); }}
            >
              Enviar a cocina
            </button>
          </ConChispas>
        </>
      )}
    </Hoja>
  );
}
