const fs = require("fs/promises");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "tenants.json");

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify({}, null, 2));
  }
}

async function readAll() {
  await ensureFile();
  const raw = await fs.readFile(FILE, "utf-8");
  return JSON.parse(raw || "{}");
}

async function readConfig(tenantId) {
  const all = await readAll();
  return all[tenantId] || null;
}

async function writeConfig(tenantId, cfg) {
  const all = await readAll();
  all[tenantId] = cfg;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

module.exports = { readConfig, writeConfig };
