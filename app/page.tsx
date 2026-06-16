import { redirect } from "next/navigation";
import { FIRST_ROUTE } from "@/lib/wizard/steps";

// El configurador no tiene landing comercial: la entrada es directamente el
// asistente de configuración (wizard), reestructurado por fases. "/" redirige
// al primer paso de la Fase 1 (OpenClaw base).
export default function Home() {
  redirect(FIRST_ROUTE);
}
