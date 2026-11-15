import "@fontsource-variable/familjen-grotesk";
import "./estilos.css";

import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { ProveedorAvisos } from "./componentes/Avisos";
import { useRuta } from "./lib/rutas";
import Mesa from "./pantallas/mesa/Mesa";
import Cocina from "./pantallas/Cocina";
import Salon from "./pantallas/mozo/Salon";
import Arquitectura from "./pantallas/mozo/Arquitectura";
import Qr from "./pantallas/Qr";

// una sola app; la ruta decide que pantalla se ve
function Pantalla() {
  const ruta = useRuta();
  if (ruta.startsWith("/mesa/")) return <Mesa />;
  if (ruta.startsWith("/cocina")) return <Cocina />;
  if (ruta.startsWith("/arquitectura")) return <Arquitectura />;
  if (ruta.startsWith("/qr")) return <Qr />;
  return <Salon />;
}

createRoot(document.getElementById("raiz")).render(
  <MotionConfig reducedMotion="user">
    <ProveedorAvisos>
      <Pantalla />
    </ProveedorAvisos>
  </MotionConfig>
);
