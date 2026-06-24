# Guía: Portal Académico UAI en tu PC (Windows)

## 1. Programas que necesitas instalar

| Programa | Para qué | Descarga |
|----------|----------|----------|
| **Node.js 24** (tienes 22; funciona, pero 24 es el de Replit) | Ejecutar el código | https://nodejs.org/ |
| **pnpm** | Gestor de paquetes del proyecto | `npm install -g pnpm` |
| **PostgreSQL 16** | Base de datos | https://www.postgresql.org/download/windows/ |
| **VS Code** o **Cursor** | Editar código | Ya lo tienes |

Durante la instalación de PostgreSQL:

- Anota la **contraseña** del usuario `postgres`.
- Deja el puerto **5432**.

Luego, en **pgAdmin** o **SQL Shell (psql)**:

```sql
CREATE DATABASE estudios_generales;
```

## 2. Abrir el proyecto en VS Code

1. **Archivo → Abrir carpeta**
2. Elige:  
   `C:\Users\GIOVANI_CESPEDES\Downloads\EstudiosGenerales-UAI (1)\EstudiosGenerales-UAI`

## 3. Configurar variables de entorno

Edita `artifacts\api-server\.env`:

```env
PORT=8080
NODE_ENV=development
DATABASE_URL=postgresql://postgres:TU_PASSWORD@localhost:5432/estudios_generales
```

Cambia `TU_PASSWORD` por la contraseña de PostgreSQL.

## 4. Instalar dependencias

En la terminal de VS Code (**Terminal → Nueva terminal**):

```powershell
pnpm install
```

## 5. Crear las tablas

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-db.ps1
```

## 6. Arrancar el portal

**Opción A — un script abre dos ventanas:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-local.ps1
```

**Opción B — dos terminales en VS Code:**

Terminal 1:

```powershell
pnpm --filter @workspace/api-server run dev
```

Terminal 2 (espera 3 segundos):

```powershell
pnpm --filter @workspace/school-portal run dev
```

Abre el navegador: **http://localhost:3000**

### Usuarios de prueba (se crean al iniciar el API)

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin123` | administrador |
| `coord1` | `coord123` | coordinador |
| `administ1` | `admin456` | administrativo |

## 7. Traer los datos de Replit (opcional)

Si en Replit exportaste `portal-academico-dump.sql`:

```powershell
psql "postgresql://postgres:TU_PASSWORD@localhost:5432/estudios_generales" -f ruta\al\portal-academico-dump.sql
```

Sin el dump solo tendrás usuarios de prueba e ingresantes del seed, no toda la data de producción.

## 8. Publicar en la web (después)

En Replit ya tenías **deployment** configurado. Para publicar fuera de Replit, opciones habituales:

| Opción | Frontend | API + DB |
|--------|----------|----------|
| **Seguir en Replit** | Ya configurado | PostgreSQL de Replit |
| **Railway / Render** | Build de `school-portal` | `api-server` + Postgres gestionado |
| **VPS (DigitalOcean, etc.)** | Nginx sirve `dist/public` | Node + PostgreSQL en el servidor |

Build de producción:

```powershell
pnpm run build
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/school-portal run build
```

El API queda en `artifacts/api-server/dist/index.cjs`.  
El portal estático en `artifacts/school-portal/dist/public`.

En producción el router debe enviar `/api` al API (puerto 8080) y el resto al frontend, igual que en Replit.

## Problemas frecuentes

**`psql` no se reconoce**  
Añade PostgreSQL al PATH:  
`C:\Program Files\PostgreSQL\16\bin`

**Error de conexión a la base**  
- ¿PostgreSQL está corriendo? (Servicios de Windows → `postgresql-x64-16`)  
- ¿`DATABASE_URL` tiene la contraseña correcta?

**El portal carga pero el login falla**  
- ¿Está corriendo el API en el puerto 8080?  
- ¿Ejecutaste `setup-db.ps1`?

**Puerto 3000 o 8080 ocupado**  
Cambia `PORT` en `.env` del API y en `artifacts/school-portal/.env`.
