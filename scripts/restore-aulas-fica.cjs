#!/usr/bin/env node
/**
 * Restaura aulas, pabellones y laboratorios en planificacion-fica-2026-1.json
 * tomándolas de planificacion-fica-2026-1.json.bak2 cuando la fila actual
 * está vacía. Empareja por (local, carrera, ciclo, seccion, codigo, dia, hora).
 */
const fs = require("fs");
const path = require("path");

const ROOT = "/home/runner/workspace/artifacts/school-portal/public";
const CURRENT = path.join(ROOT, "planificacion-fica-2026-1.json");
const SOURCE = path.join(ROOT, "planificacion-fica-2026-1.json.bak2");

const cur = JSON.parse(fs.readFileSync(CURRENT, "utf8"));
const old = JSON.parse(fs.readFileSync(SOURCE, "utf8"));

const norm = (v) => (v == null ? "" : String(v).trim().toUpperCase());
const key = (e) =>
  [
    norm(e.local),
    norm(e.carrera),
    norm(e.ciclo),
    norm(e.seccion),
    norm(e.codigo),
    norm(e.dia),
    norm(e.hora),
  ].join("|");

// Index por clave; si hay múltiples (caso raro), nos quedamos con la primera con aula
const oldIdx = new Map();
for (const e of old) {
  const k = key(e);
  if (!oldIdx.has(k) || (!oldIdx.get(k).aula && e.aula)) oldIdx.set(k, e);
}

let restAula = 0,
  restPab = 0,
  restLab = 0;
for (const e of cur) {
  const m = oldIdx.get(key(e));
  if (!m) continue;
  if (!e.aula && m.aula) {
    e.aula = m.aula;
    restAula++;
  }
  if (!e.pabellon && m.pabellon) {
    e.pabellon = m.pabellon;
    restPab++;
  }
  if (!e.laboratorio && m.laboratorio) {
    e.laboratorio = m.laboratorio;
    restLab++;
  }
}

// Backup antes de sobrescribir
const backups = fs
  .readdirSync(ROOT)
  .filter((f) => f.startsWith("planificacion-fica-2026-1.json.bak"));
const next = `planificacion-fica-2026-1.json.bak${backups.length + 1}`;
fs.copyFileSync(CURRENT, path.join(ROOT, next));
fs.writeFileSync(CURRENT, JSON.stringify(cur, null, 2));

console.log(`Backup creado: ${next}`);
console.log(`Restauradas → aulas: ${restAula}  pabellones: ${restPab}  laboratorios: ${restLab}`);
const final = {};
for (const s of ["PRINCIPAL", "FILIAL", "HUAURA"]) {
  const r = cur.filter((x) => x.local === s);
  final[s] = { rows: r.length, conAula: r.filter((x) => x.aula).length };
}
console.log("Resumen final:", final);
