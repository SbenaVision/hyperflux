/**
 * statsStore — persists global edit counter across server restarts.
 * Lives next to overridePersistence so the same data/ dir pattern applies.
 */
import fs from "node:fs";
import path from "node:path";

const STATS_FILE = path.join(process.cwd(), "data", "stats.json");

interface Stats {
  editCount: number;
}

function readStats(): Stats {
  try {
    if (!fs.existsSync(STATS_FILE)) return { editCount: 0 };
    return JSON.parse(fs.readFileSync(STATS_FILE, "utf-8")) as Stats;
  } catch {
    return { editCount: 0 };
  }
}

function writeStats(stats: Stats): void {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

export function getEditCount(): number {
  return readStats().editCount;
}

export function incrementEditCount(): number {
  const stats = readStats();
  stats.editCount += 1;
  writeStats(stats);
  return stats.editCount;
}
