# Prisma Rules

## Instanciacion — CRITICO
- NUNCA instanciar PrismaClient sin @prisma/adapter-pg.
- Patron obligatorio:
  ```ts
  import { PrismaClient } from '@prisma/client'
  import { PrismaPg } from '@prisma/adapter-pg'
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  export const prisma = new PrismaClient({ adapter })
  ```
- Un solo cliente compartido. No instanciar por request.

## tenantId — OBLIGATORIO en toda query de aplicacion
- findMany / findFirst / findUnique: SIEMPRE incluir `where: { tenantId }`.
- create: SIEMPRE incluir `data: { tenantId, ... }`.
- update / delete: SIEMPRE incluir `where: { tenantId, id }`.
- Excepcion unica: tablas globales (catalogos, paises, idiomas). Anadir comentario:
  `// global-table: sin tenantId intencionado`
- Esta regla aplica SOLO a *.service.ts — no a seeds, scripts o migraciones.

## Schema — workflow obligatorio
1. Modificar prisma/schema.prisma
2. EJECUTAR: npx prisma generate (desde root del monorepo)
3. Verificar: npx tsc --noEmit → 0 errores antes de continuar
4. Si es migracion nueva: npx prisma migrate dev --name descripcion_corta
5. NUNCA escribir codigo que use el cliente Prisma antes de que generate complete

## Migraciones
- migrate dev: desarrollo local, genera SQL + aplica
- migrate deploy: produccion, solo aplica (no genera)
- migrate status: ver estado antes de deploy
- Si hay conflicto de migracion: resolver manualmente el archivo SQL, no regenerar

## Errores comunes
- "PrismaClientInitializationError": falta adapter-pg o DATABASE_URL no definido
- "Unknown arg `tenantId`": el campo no esta en el schema — verificar y regenerar
- "Can't reach database": verificar DATABASE_URL en .env (raiz + packages/backend/)
- Prisma 7.4+: requiere @prisma/adapter-pg — nunca instanciar sin el
