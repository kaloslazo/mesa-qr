import { useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle, QrCode } from "@phosphor-icons/react";
import { soles } from "../../lib/api";
import { Avatares, BotonTema, Foto, TextoRevelado } from "../../componentes/basicos";

export function Entrar({ mesa, restaurante, cuenta, catalogo, nombreGuardado, alEntrar }) {
  const [nombre, setNombre] = useState(nombreGuardado || "");
  const fotos = ["ceviche", "lomo", "chicha"].map((id) => catalogo.find((p) => p.id === id)?.foto);
  const yaEstan = cuenta?.comensales || [];

  return (
    <div className="mesa" style={{ paddingBottom: 40 }}>
      <header className="mesa-cabecera">
        <div className="lugar">
          <div className="insignia" aria-label={`Mesa ${mesa}`}><small>MESA</small><b>{mesa}</b></div>
          <b className="local">{restaurante}</b>
        </div>
        <BotonTema />
      </header>

      <div className="collage-entrada">
        {fotos.map((src, i) => (
          <motion.div
            key={i}
            style={{ position: "absolute", left: ["2%", "34%", "62%"][i], top: [30, 0, 44][i], zIndex: i === 1 ? 2 : 1 }}
            initial={{ opacity: 0, y: 40, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: [-8, 3, 10][i] }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 160, damping: 16 }}
          >
            <Foto src={src} style={{ position: "static", width: [150, 160, 140][i], height: [170, 190, 160][i] }} />
          </motion.div>
        ))}
      </div>

      <TextoRevelado texto="Bienvenido a la mesa" retraso={0.25} />
      <p className="suave" style={{ marginTop: 8 }}>
        Todos los que escanean este QR comparten la misma cuenta: ven lo que pide cada uno y al final deciden cómo pagar.
      </p>

      {yaEstan.length > 0 && (
        <div className="tarjeta" style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, marginTop: 16 }}>
          <Avatares nombres={yaEstan} />
          <span className="chico"><b>{yaEstan.join(", ")}</b> ya {yaEstan.length === 1 ? "está" : "están"} en la mesa · {soles(cuenta.total)}</span>
        </div>
      )}

      <form
        style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}
        onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) alEntrar(nombre.trim()); }}
      >
        <input className="campo" style={{ padding: "16px 18px", fontSize: 17 }} placeholder="¿Cómo te llamas?" maxLength={20} autoComplete="given-name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <button className="boton ancho" style={{ padding: 16 }} disabled={!nombre.trim()}>
          Entrar a la mesa <ArrowRight size={18} weight="bold" />
        </button>
      </form>
    </div>
  );
}

export function Invalido() {
  return (
    <div className="mesa centro-pantalla" style={{ textAlign: "center", alignItems: "center" }}>
      <QrCode size={64} weight="duotone" color="var(--naranja)" />
      <h1>Este QR no es de esta mesa</h1>
      <p className="suave">Vuelve a escanear el código que está en tu mesa.</p>
    </div>
  );
}

export function Cerrada({ mesa, monto, alAbrirOtra }) {
  return (
    <div className="mesa centro-pantalla" style={{ textAlign: "center", alignItems: "center" }}>
      <motion.div className="circulo-ok" initial={{ scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 240, damping: 14 }}>
        <CheckCircle size={52} weight="fill" />
      </motion.div>
      <h1>Cuenta cerrada</h1>
      <p className="suave">La mesa {mesa} ya pagó todo{monto ? `; tu último pago fue de ${soles(monto)}` : ""}. Gracias por venir.</p>
      <button className="boton claro" onClick={alAbrirOtra}>Abrir una cuenta nueva</button>
    </div>
  );
}
