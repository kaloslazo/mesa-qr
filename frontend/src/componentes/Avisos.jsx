import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";

const Contexto = createContext(() => {});

export function ProveedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([]);

  const avisar = useCallback((texto, tipo = "info") => {
    const id = Date.now() + Math.random();
    setAvisos((todos) => [...todos.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setAvisos((todos) => todos.filter((a) => a.id !== id)), 3400);
  }, []);

  const iconos = { info: Info, ok: CheckCircle, error: WarningCircle };

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="avisos" aria-live="polite">
        <AnimatePresence>
          {avisos.map((a) => {
            const Icono = iconos[a.tipo] || Info;
            return (
              <motion.div
                key={a.id}
                layout
                className={`aviso ${a.tipo === "error" ? "error" : ""}`}
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                <Icono size={18} weight="fill" />
                {a.texto}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Contexto.Provider>
  );
}

export const useAvisar = () => useContext(Contexto);
