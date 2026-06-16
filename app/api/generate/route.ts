import { NextResponse } from "next/server";
import { generateInstancePackage } from "@/lib/generators";
import type { WizardConfig } from "@/lib/wizard-context";

// Genera el paquete de instancia (base/openclaw.json + overlay/overlay-config.json
// + instance-manifest.json) en el servidor: la generación usa `crypto` de Node y
// no debe correr en el navegador. Recibe el WizardConfig y devuelve el árbol
// path→contenido. Cero secretos: todo va con placeholders ${ENV}.
export async function POST(req: Request) {
  try {
    const config = (await req.json()) as WizardConfig;
    const files = generateInstancePackage(config);
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
