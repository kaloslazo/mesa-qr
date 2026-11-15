import { motion } from "motion/react";
import { ChefHat, Hexagon, QrCode, Storefront, Table } from "@phosphor-icons/react";
import { alNavegar } from "../lib/rutas";
import { BotonTema } from "./basicos";

const SECCIONES = [
  { id: "salon", texto: "Salón", ruta: "/mozo", Icono: Table },
  { id: "arquitectura", texto: "Arquitectura", ruta: "/arquitectura", Icono: Hexagon },
  { id: "cocina", texto: "Cocina", ruta: "/cocina", Icono: ChefHat },
  { id: "qr", texto: "QR", ruta: "/qr", Icono: QrCode },
];

// barra de arriba para las pantallas del personal
export default function BarraStaff({ actual, restaurante, hora, happyHour }) {
  return (
    <header className="staff-barra">
      <div className="staff-interior">
        <a className="staff-marca" href="/mozo" onClick={alNavegar("/mozo")}>
          <span className="staff-logo"><Storefront size={19} weight="fill" /></span>
          <span>
            <b>{restaurante || "La Esquina"}</b>
            <small>Personal</small>
          </span>
        </a>

        <nav className="staff-tabs">
          {SECCIONES.map(({ id, texto, ruta, Icono }) => (
            <a key={id} href={ruta} onClick={alNavegar(ruta)} className={actual === id ? "activo" : ""}>
              <Icono size={18} weight={actual === id ? "fill" : "regular"} />
              <span>{texto}</span>
              {actual === id && <motion.span layoutId="subrayado-staff" className="subrayado" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            </a>
          ))}
        </nav>

        <div className="staff-derecha">
          {happyHour && <span className="etiqueta naranja">Happy hour</span>}
          {hora && <span className="staff-reloj">{hora}</span>}
          <BotonTema />
        </div>
      </div>
    </header>
  );
}
