import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export async function GET() {
  try {
    const configPath = join(homedir(), ".openclaw", "openclaw.json");
    const content = await readFile(configPath, "utf-8");
    const json = JSON.parse(content);
    const token: string = json?.gateway?.auth?.token || "";
    const url: string = json?.gateway?.url || "http://localhost:18789";
    return Response.json({ detected: true, token, url });
  } catch {
    return Response.json({ detected: false });
  }
}
