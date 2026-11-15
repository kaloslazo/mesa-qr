import { useEffect, useState } from "react";

// cambia de pantalla sin recargar la pagina
export function navegar(ruta) {
  history.pushState({}, "", ruta);
  window.dispatchEvent(new Event("navegar"));
}

export function useRuta() {
  const [ruta, setRuta] = useState(location.pathname);
  useEffect(() => {
    const actualizar = () => setRuta(location.pathname);
    addEventListener("popstate", actualizar);
    addEventListener("navegar", actualizar);
    return () => {
      removeEventListener("popstate", actualizar);
      removeEventListener("navegar", actualizar);
    };
  }, []);
  return ruta;
}

// para usar en enlaces: navega dentro de la app salvo que abran en otra pestaña
export const alNavegar = (ruta) => (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navegar(ruta);
};

// true cuando la pantalla es al menos de ese ancho
export function useAncho(minimo) {
  const consulta = `(min-width: ${minimo}px)`;
  const [cumple, setCumple] = useState(() => matchMedia(consulta).matches);
  useEffect(() => {
    const mq = matchMedia(consulta);
    const cambiar = () => setCumple(mq.matches);
    mq.addEventListener("change", cambiar);
    return () => mq.removeEventListener("change", cambiar);
  }, [consulta]);
  return cumple;
}
