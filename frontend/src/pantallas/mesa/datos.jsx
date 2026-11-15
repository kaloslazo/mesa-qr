import { CheckCircle, Cheese, Clock, CookingPot, Egg, Fish, Grains, Leaf, Plant, Shrimp } from "@phosphor-icons/react";

export const SECCIONES = [
  { valor: "todo", texto: "Todo" },
  { valor: "entradas", texto: "Entradas" },
  { valor: "fondos", texto: "Fondos" },
  { valor: "postres", texto: "Postres" },
  { valor: "bebidas", texto: "Bebidas" },
];

export const ALERGENOS = {
  gluten: { texto: "Gluten", Icono: Grains },
  lacteos: { texto: "Lácteos", Icono: Cheese },
  huevo: { texto: "Huevo", Icono: Egg },
  pescado: { texto: "Pescado", Icono: Fish },
  mariscos: { texto: "Mariscos", Icono: Shrimp },
  mani: { texto: "Maní", Icono: Plant },
  soya: { texto: "Soya", Icono: Leaf },
};

export const ESTADOS = {
  pedido: { texto: "En espera", clase: "", Icono: Clock },
  preparando: { texto: "Preparando", clase: "ambar", Icono: CookingPot },
  servido: { texto: "Servido", clase: "verde", Icono: CheckCircle },
};

export const IDIOMAS = ["es", "en", "de"];
