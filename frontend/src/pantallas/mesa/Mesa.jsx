import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Basket, BellSimpleRinging, ChatCircleText, ForkKnife, GearSix, Receipt } from "@phosphor-icons/react";
import { api, guardar, leer, solesCorto, useAvisos, useCada } from "../../lib/api";
import { Avatares } from "../../componentes/basicos";
import { useAvisar } from "../../componentes/Avisos";
import Carta from "./Carta";
import Asistente from "./Asistente";
import Cuenta from "./Cuenta";
import { Cerrada, Entrar, Invalido } from "./Entrada";
import { HojaAjustes, HojaCanasta, HojaMozo } from "./Hojas";

const VISTAS = [
  { valor: "carta", texto: "Carta", Icono: ForkKnife },
  { valor: "asistente", texto: "Asistente", Icono: ChatCircleText },
  { valor: "cuenta", texto: "Cuenta", Icono: Receipt },
];

const MOTIVOS = { atencion: "llamó al mozo", cubiertos: "pidió cubiertos", cuenta: "pidió la cuenta" };

export default function Mesa() {
  const mesa = Number(location.pathname.split("/").pop());
  const firma = new URLSearchParams(location.search).get("t") || "";
  const ruta = (r) => `/api/mesas/${mesa}${r}${r.includes("?") ? "&" : "?"}t=${firma}`;
  const claveNombre = `mesa-${mesa}-nombre`;
  const avisar = useAvisar();

  const [fase, setFase] = useState("cargando");
  const [yo, setYo] = useState(() => leer(claveNombre) || "");
  const [restaurante, setRestaurante] = useState("");
  const [cuenta, setCuenta] = useState(null);
  const [carta, setCarta] = useState({ platos: [], happy_hour: false });
  const [todos, setTodos] = useState([]);
  const [idioma, setIdioma] = useState("es");
  const [sin, setSin] = useState([]);
  const [sinPicante, setSinPicante] = useState(false);
  const [carrito, setCarrito] = useState({});
  const [vista, setVista] = useState("carta");
  const [ultimoPago, setUltimoPago] = useState(0);
  const [hoja, setHoja] = useState(null); // "canasta" | "mozo" | "ajustes"

  // catalogo completo (sin filtros) para fotos y nombres
  const catalogo = useMemo(() => Object.fromEntries(todos.map((p) => [p.id, p])), [todos]);

  async function cargarCarta() {
    try {
      const filtros = `idioma=${idioma}&sin=${sin.join(",")}&sin_picante=${sinPicante}`;
      const [filtrada, completa] = await Promise.all([api(`/api/carta?${filtros}`), api(`/api/carta?idioma=${idioma}`)]);
      setCarta(filtrada);
      setTodos(completa.platos);
      // si algo del pedido se agoto, se saca
      setCarrito((actual) => Object.fromEntries(Object.entries(actual).filter(([id]) => completa.platos.some((p) => p.id === id))));
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  async function cargarCuenta() {
    try {
      const c = await api(ruta("/cuenta"));
      if (!c || !c.comensales.includes(yo)) {
        if (fase === "app") setFase("cerrada");
        return;
      }
      setCuenta(c);
    } catch (error) {
      if (error.status === 403) setFase("invalido");
    }
  }

  useEffect(() => {
    api("/api/info").then((d) => setRestaurante(d.restaurante)).catch(() => {});
    api(ruta("/cuenta"))
      .then((c) => {
        setCuenta(c);
        setFase(c && yo && c.comensales.includes(yo) ? "app" : "entrar");
      })
      .catch((error) => setFase(error.status === 403 ? "invalido" : "entrar"));
  }, []);

  useEffect(() => {
    if (fase === "app" || fase === "entrar") cargarCarta();
  }, [fase, idioma, sin.join(","), sinPicante]);

  useAvisos([`mesa:${mesa}`], (evento) => {
    if (["carta", "reloj", "sistema"].includes(evento.tipo)) {
      if (evento.tipo === "carta" && evento.agotado) avisar("Un plato se acaba de agotar");
      cargarCarta();
      return;
    }
    // mis propios pagos y llamados ya los muestra su pantalla
    if (["pago", "llamado"].includes(evento.tipo) && evento.comensal === yo) return;
    if (evento.tipo === "pedido" && evento.comensal !== yo) avisar(`${evento.comensal} pidió ${evento.platos.join(", ")}`);
    if (evento.tipo === "estado" && evento.item.estado === "servido") avisar(`Ya sale: ${evento.item.nombre}`, "ok");
    if (evento.tipo === "pago") avisar(`${evento.comensal} pagó S/ ${evento.monto.toFixed(2)}`);
    if (evento.tipo === "llamado") avisar(`${evento.comensal} ${MOTIVOS[evento.motivo]}`);
    if (evento.tipo === "atendido") avisar("El mozo atendió a la mesa", "ok");
    cargarCuenta();
  });

  useCada(5000, () => fase === "app" && cargarCuenta());

  async function entrar(nombre) {
    try {
      const c = await api(ruta("/unirse"), { metodo: "POST", cuerpo: { nombre } });
      guardar(claveNombre, nombre);
      setYo(nombre);
      setCuenta(c);
      setVista("carta");
      setFase("app");
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  async function enviar(lineas) {
    try {
      await api(ruta("/pedidos"), {
        metodo: "POST",
        cuerpo: { comensal: yo, lineas: lineas.map(([plato_id, cantidad]) => ({ plato_id, cantidad })) },
      });
      setCarrito({});
      avisar("Pedido enviado a cocina", "ok");
      cargarCuenta();
      return true;
    } catch (error) {
      avisar(error.message, "error");
      return false;
    }
  }

  async function llamarMozo(motivo) {
    try {
      setCuenta(await api(ruta("/llamar"), { metodo: "POST", cuerpo: { comensal: yo, motivo } }));
      avisar("Listo, el mozo ya está avisado", "ok");
      setHoja(null);
    } catch (error) {
      avisar(error.message, "error");
    }
  }

  const agregar = (id, cantidad = 1) =>
    setCarrito((actual) => {
      const nuevo = Math.min(10, Math.max(0, (actual[id] || 0) + cantidad));
      const copia = { ...actual, [id]: nuevo };
      if (!nuevo) delete copia[id];
      return copia;
    });

  if (fase === "cargando") return null;
  if (fase === "invalido") return <Invalido />;
  if (fase === "entrar") return <Entrar mesa={mesa} restaurante={restaurante} cuenta={cuenta} catalogo={todos} nombreGuardado={yo} alEntrar={entrar} />;
  if (fase === "cerrada") return <Cerrada mesa={mesa} monto={ultimoPago} alAbrirOtra={() => setFase("entrar")} />;

  const sinServir = cuenta?.items.filter((i) => i.estado !== "servido").length || 0;
  const enCanasta = Object.values(carrito).reduce((s, c) => s + c, 0);
  const totalCanasta = Object.entries(carrito).reduce((s, [id, c]) => {
    const plato = catalogo[id];
    if (!plato) return s;
    return s + plato.precio * (plato.promo ? c - Math.floor(c / 2) : c);
  }, 0);
  const personas = cuenta?.comensales || [];

  return (
    <>
      <div className="mesa">
        <header className="mesa-cabecera">
          <div className="lugar">
            <div className="insignia" aria-label={`Mesa ${mesa}`}>
              <small>MESA</small>
              <b>{mesa}</b>
            </div>
            <div style={{ minWidth: 0 }}>
              <b className="local">{restaurante}</b>
              <div className="quienes">
                <Avatares nombres={personas} max={3} tam={20} />
                <span>{personas.length === 1 ? "solo tú" : `${personas.length} en la mesa`}</span>
              </div>
            </div>
          </div>
          <div className="acciones">
            <motion.button
              className={`icono-boton ${cuenta?.llamado ? "llamando" : ""}`}
              aria-label="Llamar al mozo"
              onClick={() => setHoja("mozo")}
              animate={cuenta?.llamado ? { rotate: [0, -14, 12, -8, 6, 0] } : { rotate: 0 }}
              transition={cuenta?.llamado ? { duration: 0.7, repeat: Infinity, repeatDelay: 2 } : {}}
            >
              <BellSimpleRinging size={20} weight={cuenta?.llamado ? "fill" : "bold"} />
              {cuenta?.llamado && <span className="punto" />}
            </motion.button>
            <button className="icono-boton" aria-label="Ajustes" onClick={() => setHoja("ajustes")}>
              <GearSix size={20} weight="bold" />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={vista}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
          >
            {vista === "carta" && (
              <Carta
                yo={yo} carta={carta} catalogo={catalogo} carrito={carrito} agregar={agregar}
                sin={sin} setSin={setSin} sinPicante={sinPicante} setSinPicante={setSinPicante}
                irAlAsistente={() => setVista("asistente")}
              />
            )}
            {vista === "asistente" && (
              <Asistente ruta={ruta} catalogo={catalogo} enviar={enviar} agregar={agregar} sin={sin} sinPicante={sinPicante} />
            )}
            {vista === "cuenta" && cuenta && (
              <Cuenta
                cuenta={cuenta} yo={yo} ruta={ruta} catalogo={catalogo} recargar={cargarCuenta}
                alCerrarse={(monto) => { setUltimoPago(monto); setFase("cerrada"); }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="inferior">
        <AnimatePresence>
          {enCanasta > 0 && (
            <motion.button
              className="ver-pedido"
              onClick={() => setHoja("canasta")}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.span key={enCanasta} className="n" initial={{ scale: 0.5 }} animate={{ scale: 1 }}>{enCanasta}</motion.span>
              <span>Ver pedido</span>
              <b>{solesCorto(Math.round(totalCanasta * 100) / 100)}</b>
            </motion.button>
          )}
        </AnimatePresence>
        <nav className="tabbar">
          <div className="tabbar-interior">
            {VISTAS.map(({ valor, texto, Icono }) => (
              <button key={valor} className={vista === valor ? "activo" : ""} onClick={() => setVista(valor)}>
                <span className="icono">
                  <Icono size={24} weight={vista === valor ? "fill" : "regular"} />
                  {valor === "cuenta" && sinServir > 0 && (
                    <motion.i key={sinServir} className="globo" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>{sinServir}</motion.i>
                  )}
                </span>
                <span>{texto}</span>
              </button>
            ))}
            <button className={hoja === "canasta" ? "activo" : ""} onClick={() => setHoja("canasta")}>
              <span className="icono">
                <Basket size={24} weight={enCanasta > 0 ? "fill" : "regular"} />
                {enCanasta > 0 && <motion.i key={enCanasta} className="globo" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>{enCanasta}</motion.i>}
              </span>
              <span>Pedido</span>
            </button>
          </div>
        </nav>
      </div>

      <HojaCanasta
        abierta={hoja === "canasta"} alCerrar={() => setHoja(null)}
        carrito={carrito} catalogo={catalogo} agregar={agregar} enviar={enviar} total={totalCanasta}
      />
      <HojaMozo abierta={hoja === "mozo"} alCerrar={() => setHoja(null)} llamado={cuenta?.llamado} llamar={llamarMozo} />
      <HojaAjustes abierta={hoja === "ajustes"} alCerrar={() => setHoja(null)} idioma={idioma} setIdioma={setIdioma} yo={yo} />
    </>
  );
}
