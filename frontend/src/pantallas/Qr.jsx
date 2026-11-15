import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Printer } from "@phosphor-icons/react";
import { api } from "../lib/api";
import BarraStaff from "../componentes/BarraStaff";

export default function Qr() {
  const [datos, setDatos] = useState({ restaurante: "", mesas: [] });
  useEffect(() => { api("/api/qr").then(setDatos).catch(() => {}); }, []);

  return (
    <>
    <BarraStaff actual="qr" restaurante={datos.restaurante} />
    <div className="staff-pagina">
      <div className="staff-titulo con-acciones">
        <div>
          <h1>QR de las mesas</h1>
          <p className="suave">Cada QR lleva una firma: si alguien cambia el número de mesa en el link, no puede pedir a esa mesa.</p>
        </div>
        <button className="boton no-imprimir" onClick={() => print()}><Printer size={18} weight="bold" />Imprimir</button>
      </div>
      <div className="qrs">
        {datos.mesas.map(({ mesa, url }, i) => (
          <motion.div key={mesa} className="tarjeta qr" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <span className="suave chico">{datos.restaurante}</span>
            <h2>Mesa {mesa}</h2>
            <div className="codigo"><img src={`/api/qr/${mesa}.svg`} alt={`QR de la mesa ${mesa}`} /></div>
            <span className="chico">Escanea para ver la carta y pedir</span>
            <a href={url} target="_blank" rel="noreferrer">{url}</a>
          </motion.div>
        ))}
      </div>
    </div>
    </>
  );
}
