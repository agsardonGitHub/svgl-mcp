# TypeScript Rules

- strict: true siempre. No `any` (salvo justificacion). No @ts-ignore.
- interface para objetos, type para unions.
- async/await siempre. try/catch. Promise.all para paralelo.
- Componentes React funcionales. Props tipadas con interface.
- Named exports. kebab-case archivos. PascalCase componentes. camelCase funciones.
- No imports circulares. No barrel exports en modulos grandes.

## SOLID
- S (Single Responsibility): Un archivo, una responsabilidad. Servicio >300 líneas → descomponer. Componente >500 líneas → extraer subcomponentes.
- O (Open/Closed): Abierto a extensión, cerrado a modificación. Nuevos providers/tipos se añaden sin tocar los existentes (patrón gateway IA, Sign orquestador).
- L (Liskov Substitution): Subtipos deben ser sustituibles por sus supertipos sin romper el programa. No estrechar el contrato de la interfaz en la implementación, no lanzar excepciones nuevas que el supertipo no declara.
- I (Interface Segregation): Interfaces pequeñas y específicas. No forzar a implementar métodos que no se usan.
- D (Dependency Inversion): Servicios dependen de interfaces/tipos, no de implementaciones concretas. Imprescindible para poder testear con mocks.
- Regla práctica: si cambiar algo rompe todo, falta SOLID.
