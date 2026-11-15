import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "motion/react";
import { ForkKnife, Moon, Sun } from "@phosphor-icons/react";
import { colorDe, iniciales, useTema } from "../lib/api";

// foto con respaldo si no carga
export function Foto({ src, alt = "", className = "", style }) {
  const [fallo, setFallo] = useState(!src);
  useEffect(() => setFallo(!src), [src]);
  return (
    <div className={`foto ${className}`} style={style}>
      {!fallo && <img src={src} alt={alt} loading="lazy" onError={() => setFallo(true)} />}
      {fallo && <div className="respaldo"><ForkKnife size={22} weight="duotone" /></div>}
    </div>
  );
}

export function Avatar({ nombre, tam = 30 }) {
  return (
    <span className="avatar" title={nombre} style={{ background: colorDe(nombre), width: tam, height: tam, fontSize: tam * 0.4 }}>
      {iniciales(nombre)}
    </span>
  );
}

export function Avatares({ nombres = [], max = 4, tam = 30 }) {
  const extra = nombres.length - max;
  return (
    <div className="avatares">
      {nombres.slice(0, max).map((n) => <Avatar key={n} nombre={n} tam={tam} />)}
      {extra > 0 && <span className="avatar" style={{ background: "var(--superficie-3)", color: "var(--tinta)", width: tam, height: tam }}>+{extra}</span>}
    </div>
  );
}

export function BotonTema() {
  const [tema, cambiar] = useTema();
  return (
    <button className="icono-boton" onClick={cambiar} aria-label="Cambiar entre modo claro y oscuro">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={tema}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          style={{ display: "grid" }}
        >
          {tema === "oscuro" ? <Sun size={20} weight="bold" /> : <Moon size={20} weight="bold" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

// numero que corre hasta su valor nuevo
export function Contador({ valor, formato = (n) => n.toFixed(0), duracion = 0.8 }) {
  const mv = useMotionValue(valor);
  const texto = useTransform(mv, (v) => formato(v));
  useEffect(() => {
    const control = animate(mv, valor, { duration: duracion, ease: [0.22, 1, 0.36, 1] });
    return () => control.stop();
  }, [valor]);
  return <motion.span className="num">{texto}</motion.span>;
}

// las palabras aparecen desenfocadas y se aclaran una tras otra
export function TextoRevelado({ texto, como = "h1", retraso = 0, className }) {
  const Etiqueta = motion[como];
  return (
    <Etiqueta className={className} initial="oculto" animate="visible" transition={{ staggerChildren: 0.06, delayChildren: retraso }}>
      {texto.split(" ").map((palabra, i) => (
        <motion.span
          key={i}
          style={{ display: "inline-block", marginRight: "0.25em" }}
          variants={{
            oculto: { opacity: 0, y: 10, filter: "blur(8px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
          }}
        >
          {palabra}
        </motion.span>
      ))}
    </Etiqueta>
  );
}

// segmentado con una pildora que se desliza entre opciones
export function Segmentado({ opciones, valor, alCambiar, id, className = "" }) {
  return (
    <div className={`segmentado ${className}`}>
      {opciones.map(({ valor: v, texto, icono }) => (
        <button key={v} className={v === valor ? "activo" : ""} onClick={() => alCambiar(v)} type="button">
          {v === valor && <motion.div layoutId={`pildora-${id}`} className="pildora" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span>{icono}{texto}</span>
        </button>
      ))}
    </div>
  );
}

// hoja que sube desde abajo; se cierra arrastrandola
export function Hoja({ abierta, alCerrar, children }) {
  return (
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div className="velo" onClick={alCerrar} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="hoja"
            role="dialog"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) alCerrar(); }}
          >
            <div className="agarre" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// chispas que salen del boton al tocarlo
export function ConChispas({ children, className = "", style }) {
  const [rafagas, setRafagas] = useState([]);
  const caja = useRef(null);
  const disparar = (e) => {
    const r = caja.current.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRafagas((todas) => [...todas, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRafagas((todas) => todas.filter((t) => t.id !== id)), 650);
  };
  return (
    <div ref={caja} className={className} style={{ position: "relative", ...style }} onPointerDown={disparar}>
      {children}
      {rafagas.map((r) =>
        Array.from({ length: 8 }, (_, i) => {
          const angulo = (i / 8) * Math.PI * 2;
          return (
            <motion.span
              key={`${r.id}-${i}`}
              className="chispa"
              style={{ left: r.x, top: r.y, rotate: `${(angulo * 180) / Math.PI + 90}deg` }}
              initial={{ x: 0, y: 0, opacity: 1, scaleY: 1 }}
              animate={{ x: Math.cos(angulo) * 34, y: Math.sin(angulo) * 34, opacity: 0, scaleY: 0.3 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          );
        })
      )}
    </div>
  );
}

export function Puntos() {
  return (
    <span className="puntos" aria-label="cargando">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}
