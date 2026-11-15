import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowSquareOut, BellSimpleRinging, CheckCircle, Clock, CookingPot, X } from "@phosphor-icons/react";
import { api, soles, solesCorto } from "../../lib/api";
import { useAncho } from "../../lib/rutas";
import { useAvisar } from "../../componentes/Avisos";
import { Avatares, Foto, Hoja } from "../../componentes/basicos";
import BarraStaff from "../../componentes/BarraStaff";
import { Actividad, MOTIVOS, usePanel } from "./eventos";

const ESTADO_ITEM = {
  pedido: { texto: "En espera", Icono: Clock, clase: "" },
  preparando: { texto: "Preparando", Icono: CookingPot, clase: "ambar" },
  servido: { texto: "Servido", Icono: CheckCircle, clase: "verde" },
};

function estadoDe(m) {
  if (!m) return { clase: "libre", texto: "Libre" };
  if (m.llamado) return { clase: "llamando", texto: MOTIVOS[m.llamado] };
  if (m.sin_servir > 0) return { clase: "ocupada", texto: `${m.sin_servir} sin servir` };
  if (m.total === 0) return { clase: "ocupada", texto: "Aún no piden" };
  if (m.saldo === 0) return { clase: "servida", texto: "Pagado" };
  return { clase: "servida", texto: "Todo servido" };
}

function MesaPlano({ numero, m, seleccionada, alElegir }) {
  const estado = estadoDe(m);
  const sentados = m?.comensales.length || 0;
  return (
    <motion.button
      layout
      className={`mesa-plano ${estado.clase} ${seleccionada ? "elegida" : ""}`}
      onClick={alElegir}
      whileTap={{ scale: 0.97 }}
    >
      <div className="sillas arriba">{[0, 1].map((i) => <span key={i} className={i < sentados ? "llena" : ""} />)}</div>
      <div className="tablero-mesa">
        <span className="numero">{numero}</span>
        {m && <span className="monto">{solesCorto(m.saldo)}</span>}
        {estado.clase === "llamando" && (
          <motion.span className="campana" animate={{ rotate: [0, -16, 14, -10, 0] }} transition={{ duration: 0.7, repeat: Infinity, repeatDelay: 1.2 }}>
            <BellSimpleRinging size={15} weight="fill" />
          </motion.span>
        )}
      </div>
      <div className="sillas abajo">{[2, 3].map((i) => <span key={i} className={i < sentados ? "llena" : ""} />)}</div>
      <div className="pie-mesa">
        <span>{estado.texto}</span>
        {sentados > 4 && <span className="suave">+{sentados - 4}</span>}
      </div>
    </motion.button>
  );
}

function DetalleMesa({ numero, resumen, platos, urlCliente, alCerrar, atender }) {
  const [cuenta, setCuenta] = useState(null);

  useEffect(() => {
    api(`/api/mozo/${numero}`).then(setCuenta).catch(() => setCuenta(null));
  }, [numero, resumen?.saldo, resumen?.sin_servir, resumen?.llamado, resumen?.comensales.length]);

  return (
    <div className="detalle-mesa">
      <div className="detalle-mesa-cabeza">
        <div>
          <span className="staff-etiqueta">Mesa {numero}</span>
          <h2>{cuenta ? `${cuenta.comensales.length} ${cuenta.comensales.length === 1 ? "persona" : "personas"}` : "Libre"}</h2>
        </div>
        <button className="icono-boton" onClick={alCerrar} aria-label="Cerrar"><X size={18} weight="bold" /></button>
      </div>

      {resumen?.llamado && (
        <div className="aviso-llamado">
          <BellSimpleRinging size={18} weight="fill" />
          <span>{MOTIVOS[resumen.llamado]}</span>
          <button className="boton" onClick={() => atender(numero)}>Atender</button>
        </div>
      )}

      {cuenta ? (
        <>
          <div className="detalle-personas">
            <Avatares nombres={cuenta.comensales} max={5} tam={26} />
            <span className="suave chico">{cuenta.comensales.join(", ")}</span>
          </div>
          <div className="detalle-cifras">
            <div><span className="staff-etiqueta">Total</span><b>{soles(cuenta.total)}</b></div>
            <div><span className="staff-etiqueta">Pagado</span><b>{soles(cuenta.pagado)}</b></div>
            <div><span className="staff-etiqueta">Falta</span><b>{soles(cuenta.saldo)}</b></div>
          </div>
          <div className="detalle-items">
            {cuenta.items.length === 0 && <p className="suave chico">Todavía no piden nada.</p>}
            {cuenta.items.map((item) => {
              const info = ESTADO_ITEM[item.estado];
              return (
                <div key={item.id} className="detalle-item">
                  <Foto src={platos[item.plato_id]?.foto} />
                  <div>
                    <b>{item.cantidad} x {item.nombre}</b>
                    <span className="suave chico">{item.comensal}</span>
                  </div>
                  <span className={`etiqueta ${info.clase}`}><info.Icono size={12} weight="bold" />{info.texto}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="suave" style={{ marginTop: 8 }}>Nadie ha escaneado el QR de esta mesa todavía.</p>
      )}

      {urlCliente && (
        <a className="boton claro ancho" href={urlCliente} target="_blank" rel="noreferrer" style={{ marginTop: 14 }}>
          Abrir como cliente <ArrowSquareOut size={16} />
        </a>
      )}
    </div>
  );
}

export default function Salon() {
  const avisar = useAvisar();
  const ancho = useAncho(1000);
  const [elegida, setElegida] = useState(null);
  const [urls, setUrls] = useState({});
  const { datos, platos, eventos, cargar } = usePanel({
    alEvento: (e, texto) => { if (e.tipo === "llamado") avisar(texto); },
  });

  useEffect(() => {
    api("/api/qr").then((q) => setUrls(Object.fromEntries(q.mesas.map((m) => [m.mesa, m.url])))).catch(() => {});
  }, []);

  async function atender(mesa) {
    try {
      await api(`/api/mozo/${mesa}/atender`, { metodo: "POST" });
      cargar();
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  const porMesa = Object.fromEntries(datos.mesas.map((m) => [m.mesa, m]));
  const personas = datos.mesas.reduce((s, m) => s + m.comensales.length, 0);
  const porCobrar = datos.mesas.reduce((s, m) => s + m.saldo, 0);
  const sinServir = datos.mesas.reduce((s, m) => s + m.sin_servir, 0);
  const llamando = datos.mesas.filter((m) => m.llamado).length;

  const detalle = elegida && (
    <DetalleMesa
      numero={elegida}
      resumen={porMesa[elegida]}
      platos={platos}
      urlCliente={urls[elegida]}
      alCerrar={() => setElegida(null)}
      atender={atender}
    />
  );

  return (
    <>
      <BarraStaff actual="salon" restaurante={datos.restaurante} hora={datos.hora} happyHour={datos.happy_hour} />
      <main className="staff-pagina">
        <div className="staff-titulo">
          <h1>Salón</h1>
          <div className="resumen-linea">
            <span><b>{datos.mesas.length}</b> de {datos.total_mesas} mesas ocupadas</span>
            <span><b>{personas}</b> personas</span>
            <span><b>{soles(porCobrar)}</b> por cobrar</span>
            <span><b>{sinServir}</b> platos sin servir</span>
            {llamando > 0 && <span className="naranja"><b>{llamando}</b> {llamando === 1 ? "mesa llama" : "mesas llaman"}</span>}
          </div>
        </div>

        <div className="salon">
          <section className="staff-panel">
            <div className="staff-panel-cabeza">
              <span className="staff-etiqueta">Plano</span>
              <div className="leyenda">
                <span><i className="libre" />Libre</span>
                <span><i className="ocupada" />Ocupada</span>
                <span><i className="llamando" />Llamando</span>
              </div>
            </div>
            <div className="plano">
              {Array.from({ length: datos.total_mesas }, (_, i) => i + 1).map((n) => (
                <MesaPlano key={n} numero={n} m={porMesa[n]} seleccionada={elegida === n} alElegir={() => setElegida(elegida === n ? null : n)} />
              ))}
            </div>
          </section>

          <aside className="salon-lado">
            <AnimatePresence mode="wait">
              {ancho && elegida && (
                <motion.section key={elegida} className="staff-panel" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
                  {detalle}
                </motion.section>
              )}
            </AnimatePresence>
            <section className="staff-panel">
              <div className="staff-panel-cabeza"><span className="staff-etiqueta">Actividad</span></div>
              <Actividad eventos={eventos} />
            </section>
          </aside>
        </div>
      </main>

      {!ancho && <Hoja abierta={!!elegida} alCerrar={() => setElegida(null)}>{detalle}</Hoja>}
    </>
  );
}
