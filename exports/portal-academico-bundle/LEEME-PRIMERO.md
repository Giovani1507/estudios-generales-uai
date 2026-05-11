# Paquete completo de datos — Portal Académico UAI

Este paquete contiene **todo lo necesario** para que otra instancia del Portal
Académico arranque con los mismos datos que la tuya.

## Contenido

| Archivo / Carpeta | Para qué sirve |
|---|---|
| `portal-academico-dump.sql` | Respaldo SQL completo de la base PostgreSQL (27 tablas con todos los datos: docentes, asistencias, planificación, nóminas, justificaciones, usuarios, etc.) |
| `attached_assets/CONSOLIDADO_REGISTRO_DE_MATRÍCULA_*.xlsx` | Padrón de matriculados de Recaudaciones (lo usa el script `generar-alumnos-info.ts` para el reporte por alumno) |
| `attached_assets/DATA_CERRADA_*PLANIFICACION_PREGRADO_2026-1*.xlsx` | Data cerrada de planificación (lo usa `extract-docentes-dni.ts`) |
| `attached_assets/Ingresantes_con_pagos_*.xlsx` | Lista de ingresantes con códigos (lo usa `reimport-ingresantes.ts`) |
| `attached_assets/PLANIFICACIÓN_*.xlsx` (5 archivos) | Planificación por sede/filial (lo usa `import-planificacion-2026-1.ts`) |
| `attached_assets/asistencia_2026_1_extracted/` | Carpeta con Excels de asistencia organizados por sede (lo usa `import-asistencia-2026-1.ts`) |

## Cómo usarlo en la otra instancia

### Opción 1 — Sólo la base de datos (rápido, recomendado)

Si el otro Replit ya tiene el código del portal, basta con cargarle la base:

```bash
# 1. Descomprimir el paquete (ya descomprimido si descargaste sólo el .sql)
# 2. Importar a la base de datos PostgreSQL del Replit destino
psql "$DATABASE_URL" -f portal-academico-dump.sql

# 3. Verificar que las 27 tablas existan
psql "$DATABASE_URL" -c "\dt"

# 4. Reiniciar el workflow del API Server
```

Con esto ya queda funcional con todos los datos. Los archivos `attached_assets/`
**no son necesarios** si se importa la base — los datos ya están adentro.

### Opción 2 — Cargar desde cero usando los Excels (lento)

Sólo si no quieres usar el dump de la base. En el Replit destino:

```bash
# 1. Copiar la carpeta attached_assets/ a la raíz del proyecto
# 2. Crear las tablas vacías
pnpm --filter @workspace/api-server run db:push

# 3. Correr los scripts de importación, en este orden
pnpm --filter @workspace/api-server exec tsx scripts/extract-docentes-dni.ts
pnpm --filter @workspace/api-server exec tsx scripts/import-planificacion-2026-1.ts
pnpm --filter @workspace/api-server exec tsx scripts/reimport-ingresantes.ts
pnpm --filter @workspace/api-server exec tsx scripts/update-ingresantes-codigo.ts
pnpm --filter @workspace/api-server exec tsx scripts/import-asistencia-2026-1.ts
pnpm --filter @workspace/api-server exec tsx scripts/import-delegados.ts

# 4. Generar el JSON de alumnos (carrera/local)
pnpm --filter @workspace/school-portal exec tsx scripts/generar-alumnos-info.ts \
  "../../attached_assets/CONSOLIDADO_REGISTRO_DE_MATRÍCULA_-_RECAUDACIONES_PREGRADO_20_1778533921636.xlsx"
```

## Aviso de privacidad

Este paquete contiene **información sensible**: DNIs de docentes, datos de
alumnos, asistencias reales, credenciales de delegados, etc. **Compártelo
únicamente por canales privados** (no por chat público, no por correo sin
cifrar). Bórralo de los equipos donde no se necesite.
