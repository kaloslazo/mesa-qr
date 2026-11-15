import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, CreditCard, DeviceMobile, Money } from "@phosphor-icons/react";
import { api, soles } from "../../lib/api";
import { useAvisar } from "../../componentes/Avisos";
import { Avatar, ConChispas, Contador, Foto, Hoja, Segmentado } from "../../componentes/basicos";
import { ESTADOS } from "./datos";

const MONEDAS = { PEN: "S/ ", USD: "US$ ", EUR: "€ " };
const MEDIOS = [
  { valor: "yape", texto: "Yape", Icono: DeviceMobile },
  { valor: "tarjeta", texto: "Tarjeta", Icono: CreditCard },
  { valor: "efectivo", texto: "Efectivo", Icono: Money },
];

function Estado({ estado }) {
  const info = ESTADOS[estado];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={estado}
        className={`etiqueta ${info.clase}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
      >
        <info.Icono size={13} weight="bold" />{info.texto}
      </motion.span>
    </AnimatePresence>
  );
}

export default function Cuenta({ cuenta, yo, ruta, catalogo, recargar, alCerrarse }) {
  const avisar = useAvisar();
  const [moneda, setMoneda] = useState("PEN");
  const [cambio, setCambio] = useState(null);
  const [forma, setForma] = useState("consumo");
  const [elegidos, setElegidos] = useState([]);
  const [monto, setMonto] = useState("");
  const [escrito, setEscrito] = useState(false);
  const [sugerido, setSugerido] = useState(0);
  const [medio, setMedio] = useState("yape");
  const [pagando, setPagando] = useState(false);
  const [pagado, setPagado] = useState(null);

  // totales en otra moneda (adaptador de tipo de cambio)
  useEffect(() => {
    if (moneda === "PEN") return setCambio(null);
    api(ruta(`/total?moneda=${moneda}`)).then(setCambio).catch((e) => avisar(e.message, "error"));
  }, [moneda, cuenta.total, cuenta.saldo]);

  // cuanto le toca a cada uno segun la forma de dividir
  useEffect(() => {
    if (forma === "platos" && elegidos.length === 0) {
      setSugerido(0);
      if (!escrito) setMonto("");
      return;
    }
    api(ruta(`/dividir?forma=${forma}&comensal=${encodeURIComponent(yo)}&items=${elegidos.join(",")}`))
      .then((partes) => {
        const mio = partes[yo] ?? 0;
        setSugerido(mio);
        if (!escrito) setMonto(mio ? mio.toFixed(2) : "");
      })
      .catch(() => {});
  }, [forma, elegidos.join(","), cuenta.saldo, cuenta.items.length]);

  const tasa = cambio?.tasa ?? 1;
  const enMoneda = (n) => MONEDAS[moneda] + (n * tasa).toFixed(2);

  const personas = [yo, ...cuenta.comensales.filter((c) => c !== yo)];

  async function pagar() {
    setPagando(true);
    try {
      const valor = Number(monto);
      const r = await api(ruta("/pagos"), { metodo: "POST", cuerpo: { comensal: yo, monto: valor, medio } });
      setEscrito(false);
      setElegidos([]);
      setPagado({ monto: valor, medio, cerrada: !r.abierta });
      if (r.abierta) recargar();
    } catch (error) {
      avisar(error.message, "error");
    } finally {
      setPagando(false);
    }
  }

  return (
    <>
      <div className="saludo">
        <p>Cuenta compartida</p>
        <h1>{cuenta.comensales.length} {cuenta.comensales.length === 1 ? "persona" : "personas"} en la mesa</h1>
      </div>

      <section className="tarjeta resumen">
        <span style={{ opacity: 0.7 }}>Total de la mesa</span>
        <div className="total"><Contador valor={cuenta.total * tasa} formato={(n) => MONEDAS[moneda] + n.toFixed(2)} /></div>
        <div className="partes">
          <div><span style={{ opacity: 0.7 }} className="chico">Pagado</span><b><Contador valor={cuenta.pagado * tasa} formato={(n) => MONEDAS[moneda] + n.toFixed(2)} /></b></div>
          <div><span style={{ opacity: 0.7 }} className="chico">Falta</span><b><Contador valor={cuenta.saldo * tasa} formato={(n) => MONEDAS[moneda] + n.toFixed(2)} /></b></div>
        </div>
        <Segmentado
          id="moneda"
          valor={moneda}
          alCambiar={setMoneda}
          opciones={[{ valor: "PEN", texto: "Soles" }, { valor: "USD", texto: "Dólares" }, { valor: "EUR", texto: "Euros" }]}
        />
      </section>

      {cuenta.items.length === 0 && <div className="vacio">Todavía no piden nada.</div>}

      {personas.map((persona) => {
        const items = cuenta.items.filter((i) => i.comensal === persona);
        if (!items.length) return null;
        const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
        return (
          <section className="persona" key={persona}>
            <div className="persona-cabeza">
              <Avatar nombre={persona} />
              <b>{persona === yo ? "Tú" : persona}</b>
              <span className="suave num">{enMoneda(subtotal)}</span>
            </div>
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  className="item"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                >
                  {forma === "platos" && (
                    <input
                      type="checkbox"
                      aria-label={`Pagar ${item.nombre}`}
                      checked={elegidos.includes(item.id)}
                      onChange={(e) => { setEscrito(false); setElegidos(e.target.checked ? [...elegidos, item.id] : elegidos.filter((x) => x !== item.id)); }}
                    />
                  )}
                  <Foto src={catalogo[item.plato_id]?.foto} />
                  <div className="centro">
                    <b>{item.cantidad} x {catalogo[item.plato_id]?.nombre || item.nombre}</b>
                    <Estado estado={item.estado} />
                  </div>
                  <div className="derecha">
                    <b className="num">{enMoneda(item.subtotal)}</b>
                    {persona === yo && item.estado === "pedido" && (
                      <button
                        className="quitar"
                        onClick={() =>
                          api(ruta(`/items/${item.id}?comensal=${encodeURIComponent(yo)}`), { metodo: "DELETE" })
                            .then(recargar)
                            .catch((e) => avisar(e.message, "error"))
                        }
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        );
      })}

      {cuenta.saldo > 0 && (
        <section className="tarjeta pagar">
          <h2>¿Juntos o separados?</h2>
          <div style={{ marginTop: 12 }}>
            <Segmentado
              id="forma"
              valor={forma}
              alCambiar={(f) => { setForma(f); setElegidos([]); setEscrito(false); }}
              opciones={[{ valor: "iguales", texto: "Iguales" }, { valor: "consumo", texto: "Lo mío" }, { valor: "platos", texto: "Elegir" }]}
            />
          </div>
          <label className="monto">
            <span>S/</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={monto}
              placeholder="0.00"
              aria-label="Monto a pagar"
              onChange={(e) => { setMonto(e.target.value); setEscrito(true); }}
            />
          </label>
          <p className="suave chico">
            {forma === "platos" && elegidos.length === 0
              ? "Marca arriba los platos que vas a pagar."
              : `Te toca ${soles(sugerido)}. En total falta ${soles(cuenta.saldo)}.`}
          </p>
          <div className="medios">
            {MEDIOS.map(({ valor, texto, Icono }) => (
              <motion.button key={valor} whileTap={{ scale: 0.95 }} className={`medio ${medio === valor ? "activo" : ""}`} onClick={() => setMedio(valor)}>
                <Icono size={24} weight={medio === valor ? "fill" : "regular"} />{texto}
              </motion.button>
            ))}
          </div>
          <ConChispas>
            <button className="boton ancho" style={{ padding: 16 }} disabled={pagando || !(Number(monto) > 0)} onClick={pagar}>
              Pagar {Number(monto) > 0 ? soles(Number(monto)) : ""}
            </button>
          </ConChispas>
        </section>
      )}

      <Hoja abierta={!!pagado} alCerrar={() => { if (pagado?.cerrada) alCerrarse(pagado.monto); setPagado(null); }}>
        {pagado && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "10px 0 6px" }}>
            <motion.div className="circulo-ok" initial={{ scale: 0.3, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
              <CheckCircle size={52} weight="fill" />
            </motion.div>
            <h2>Pagaste {soles(pagado.monto)}</h2>
            <p className="suave">
              Con {MEDIOS.find((m) => m.valor === pagado.medio)?.texto.toLowerCase()}.
              {pagado.cerrada ? " Con esto la cuenta de la mesa queda en cero." : " El resto de la mesa ya lo ve en su celular."}
            </p>
            <button className="boton ancho negro" onClick={() => { if (pagado.cerrada) alCerrarse(pagado.monto); setPagado(null); }}>
              Listo
            </button>
          </div>
        )}
      </Hoja>
    </>
  );
}
