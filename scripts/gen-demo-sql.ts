// Genera un paquete de instancia DEMO y emite el SQL para registrarlo en clawhub
// (Firm + FirmBaseline promovido + 2 PairingToken). Lo consume el happy-path E2E:
//   npx tsx scripts/gen-demo-sql.ts > /tmp/demo-register.sql 2> /tmp/demo-meta.txt
// El SQL va a stdout; los códigos/metadata a stderr (para no ensuciar el .sql).
import crypto from "node:crypto";
import { generateInstancePackage } from "../lib/generators.ts";
import { PACKAGE_PATHS } from "../lib/contract/types.ts";

// Config DEMO: keyless (ollama) para que instale sin pedir claves en destino;
// equipo núcleo ai-office (planner + asistente) + un ejecutivo.
const config = {
  providers: { ollama: { baseUrl: "http://127.0.0.1:11434/v1", model: "gemma4-gpu" } },
  clawcrewTeam: {
    sector: "custom",
    prefix: "office",
    overlayName: "AI Office Demo",
    agents: [
      { agent: "planner", slug: "office-planner", displayName: "Planificador", icon: "📋", enabled: true },
      { agent: "personal-assistant", slug: "office-pa", displayName: "Asistente", icon: "💬", enabled: true },
      { agent: "executive", slug: "office-executive", displayName: "Iván", icon: "🤝", enabled: true },
    ],
    planMode: { enabled: false, uiVisible: false, autoSuggest: false, plannerAgentId: "office-planner-v1", fallbackPlanFirst: true },
  },
  guardClaw: { sensitivity: "S2" },
  channels: {},
  security: { dmPolicy: "allowlist", allowlist: [] },
  skills: [],
  personality: { name: "AI Office Demo", emoji: "🏢", vibe: "" },
  useCase: { type: "business", agents: [] },
  registration: { plan: "BUSINESS", features: ["kill-switch", "usage-telemetry"] },
  // deno-lint-ignore no-explicit-any
} as unknown as Parameters<typeof generateInstancePackage>[0];

function pairingCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[crypto.randomInt(alphabet.length)];
    if (i === 3) code += "-";
  }
  return code;
}

function dq(content: string, tagBase: string): string {
  // dollar-quoting seguro: busca un tag que NO aparezca en el contenido.
  let tag = `$${tagBase}$`;
  let n = 0;
  while (content.includes(tag)) tag = `$${tagBase}${n++}$`;
  return `${tag}${content}${tag}`;
}

const FIRM_NAME = "AI Office — Demo equipo";
const files = generateInstancePackage(config);
const entries = Object.entries(files).map(([path, content]) => ({
  path,
  category: path === PACKAGE_PATHS.base ? "OPENCLAW_CONFIG" : "OTHER",
  content,
  sha256: crypto.createHash("sha256").update(content, "utf8").digest("hex"),
  sizeBytes: Buffer.byteLength(content, "utf8"),
}));
const totalBytes = entries.reduce((s, e) => s + e.sizeBytes, 0);
const verifyCode = pairingCode();
let handoverCode = pairingCode();
while (handoverCode === verifyCode) handoverCode = pairingCode();

const valuesRows = entries
  .map(
    (e, i) =>
      `    (${dq(e.path, `p${i}`)}, '${e.category}', '${e.sha256}', ${e.sizeBytes}, ${dq(e.content, `c${i}`)})`,
  )
  .join(",\n");

const sql = `with f as (
  insert into clawhub."Firm" ("id","name","plan","seatsPurchased","status","createdAt","updatedAt")
  values (gen_random_uuid(), ${dq(FIRM_NAME, "fn")}, 'BUSINESS'::clawhub."FirmPlan", 5, 'active', now(), now())
  returning "id"
),
b as (
  insert into clawhub."FirmBaseline" ("id","firmId","version","label","fileCount","totalBytes","createdBy","isPromoted","promotedAt","promotedBy","createdAt")
  select gen_random_uuid(), f."id", 1, ${dq("Configurator — Demo equipo", "lbl")}, ${entries.length}, ${totalBytes}, 'configurator', true, now(), 'configurator', now()
  from f returning "id"
),
ins_files as (
  insert into clawhub."FirmBaselineFile" ("id","baselineId","path","category","sha256","sizeBytes","content","isBinary")
  select gen_random_uuid(), b."id", x.path, x.category::clawhub."FirmBaselineFileCategory", x.sha256, x.size, x.content, false
  from b cross join (values
${valuesRows}
  ) as x(path,category,sha256,size,content)
  returning 1
),
tv as (
  insert into clawhub."PairingToken" ("id","firmId","code","expiresAt","createdAt")
  select gen_random_uuid(), f."id", '${verifyCode}', now() + interval '30 days', now() from f returning "code"
),
th as (
  insert into clawhub."PairingToken" ("id","firmId","code","expiresAt","createdAt")
  select gen_random_uuid(), f."id", '${handoverCode}', now() + interval '30 days', now() from f returning "code"
)
select f."id" as firm_id,
       (select "id" from b) as baseline_id,
       (select count(*) from ins_files) as files_inserted,
       (select "code" from tv) as verify_code,
       (select "code" from th) as handover_code
from f;
`;

process.stdout.write(sql);
process.stderr.write(
  JSON.stringify(
    {
      firmName: FIRM_NAME,
      files: entries.map((e) => ({ path: e.path, category: e.category, sizeBytes: e.sizeBytes })),
      totalBytes,
      verifyCode,
      handoverCode,
    },
    null,
    2,
  ) + "\n",
);
