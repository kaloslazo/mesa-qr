import { useEffect, useRef, useState } from "react";

export async function api(ruta, { metodo = "GET", cuerpo } = {}) {
  const respuesta = await fetch(ruta, {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || `error ${respuesta.status}`);
    error.status = respuesta.status;
    throw error;
  }
  return datos;
}

export const soles = (monto) => "S/ " + Number(monto ?? 0).toFixed(2);

// version corta para tarjetas: "S/ 38" o "S/ 9.50"
export const solesCorto = (monto) => {
  const n = Number(monto ?? 0);
  return "S/ " + (Number.isInteger(n) ? n : n.toFixed(2));
};

export function leer(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

export function guardar(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
}

// websocket con reconexion; avisa cada evento de los canales pedidos
export function useAvisos(canales, alLlegar) {
  const ref = useRef(alLlegar);
  ref.current = alLlegar;
  const clave = canales.join(",");

  useEffect(() => {
    let socket;
    let cerrado = false;
    let reintento;
    const abrir = () => {
      const protocolo = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocolo}://${location.host}/ws?canales=${clave}`);
      socket.onmessage = (e) => ref.current(JSON.parse(e.data));
      socket.onclose = () => { if (!cerrado) reintento = setTimeout(abrir, 2000); };
    };
    abrir();
    return () => {
      cerrado = true;
      clearTimeout(reintento);
      socket?.close();
    };
  }, [clave]);
}

export function useCada(ms, fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useTema() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema || "claro");
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    guardar("tema", tema);
  }, [tema]);
  return [tema, () => setTema((t) => (t === "oscuro" ? "claro" : "oscuro")), setTema];
}

const COLORES = ["#ff5b14", "#1f7a5c", "#3d5afe", "#b0369a", "#c98a00", "#0e7490", "#7c4a2d", "#5b5b60"];

export function colorDe(nombre = "") {
  let suma = 0;
  for (const letra of nombre) suma += letra.charCodeAt(0);
  return COLORES[suma % COLORES.length];
}

export const iniciales = (nombre = "") => nombre.trim().slice(0, 1).toUpperCase();
