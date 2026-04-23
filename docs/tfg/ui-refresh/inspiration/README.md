# Inspiration — components curats de 21st.dev

Biblioteca de components que han cridat l'atenció del Sergi navegant
[21st.dev/community/components](https://21st.dev/community/components).
**Aquí només com a referència**: cap d'ells forma part del build de
Synapse Notes. Quan un el volguem integrar, el copiarem a
`src/components/ui/` amb els ajustos de paleta/anti-pattern
corresponents.

## Índex

| # | Component | Fitxer | Estat | Encaix a Synapse |
|---|-----------|--------|-------|------------------|
| 1 | Background Paths | [`01-background-paths.tsx`](./01-background-paths.tsx) | ⚠️ Reskin + reserva | Landing pública si cal hero impactant |
| 2 | Radial Orbital Timeline | [`02-radial-orbital-timeline.tsx`](./02-radial-orbital-timeline.tsx) | ⚠️ Retuning necessari | Viz de les 6 eines MCP, o Gantt del memoir com a mapa radial |
| 3 | Spline Interactive 3D | [`03-spline-scene.tsx`](./03-spline-scene.tsx) | ❌ Overkill | Landing hero si vols presumir 3D; fora per al dashboard |
| 4 | Aurora Background | [`04-aurora-background.tsx`](./04-aurora-background.tsx) | ❌ Anti-pattern explícit | Només si retonem blues/violets a gold/topographic |
| 5 | CPU Architecture | [`05-cpu-architecture.tsx`](./05-cpu-architecture.tsx) | ⚠️ Retuning necessari | **Diagrama animat §9.3 del TFG** (arquitectura MCP) |
| 6 | Animated AI Input | [`06-animated-ai-input.tsx`](./06-animated-ai-input.tsx) | ✅ **Candidat fort** | Composer del chat a UI-3 / UI-4 |

Els shadcn primitives que aquests components demanen (Button, Card,
Badge, Textarea, DropdownMenu) ja estan a `src/components/ui/`. Els
dependencies no-shadcn — Spotlight (Aceternity i Ibelick) — estan a
[`dependencies/`](./dependencies/).

## Conflictes amb anti-patterns de la branca `feat/ui-refresh`

Recordatori del que vam acordar **evitar**:

- Aurora backgrounds / gradient borealis
- Purple / violet / pink gradients ("AI purple")
- Glassmorphism pesat / frosted-glass cards
- Element 3D decoratiu sense funció
- Decoració que competeixi amb informació densa

Els components que trepitgen aquestes regles:

- **#4 Aurora Background** — el component *és* l'anti-pattern. La
  paleta per defecte usa `--blue-500`, `--indigo-300`, `--violet-200`,
  `--blue-400`. Només val la pena adoptar-lo si es retonen els 4
  `--aurora` al parchment-gold + topographic-green de Midnight
  Cartography. I encara així: només per a landing, mai per al
  dashboard.
- **#1 Background Paths** — decoratiu però controlable. Els paths són
  grisos semitransparents, no purple. Acceptable a landing si es
  redueix `opacity` a 40% i no competeix amb el CTA.
- **#2 Radial Orbital Timeline** — el node central té
  `bg-gradient-to-br from-purple-500 via-blue-500 to-teal-500`, la
  barra d'energia `from-blue-500 to-purple-500`. Bàsicament el patró
  "AI purple" al centre. Cal sobreescriure ambdós gradients abans de
  pujar a `main`.
- **#5 CPU Architecture** — dels 8 orbs de llum, dos són pinkish
  (`#830CD1`, `#FF008B`) i un és orange (`#f97316`). Retonar a
  parchment-gold + topographic-green + un neutre. Conservar les 8
  línies animades, canviar només els 8 `radialGradient`.
- **#3 Spline 3D** — el problema no és la paleta, és el bundle
  (`@splinetool/runtime` + `@splinetool/react-spline` = ~2 MB). Mai
  val la pena fora d'un hero de landing.

Els components **sense conflicte greu**:

- **#6 Animated AI Input** — l'únic focus problemàtic és el
  `focus-visible:ring-blue-500`, que es pot canviar a
  `focus-visible:ring-primary` en 30 segons per agafar l'accent de la
  paleta. Tot el demés (blacks neutres amb opacitats) encaixa
  directament.

## Recomanació operativa

Dels sis, el que **integraria immediatament** és:

### **#6 Animated AI Input** → substituir el composer actual del chat (`src/components/chat/chat-interface.tsx`)

Raons:
1. Directament útil — resol la feina d'UI-3 del chat composer
2. Cap conflicte de paleta
3. Porta auto-resize textarea, dropdown de model, attachments handle
4. Base sòlida per ampliar al picker de tools MCP a UI-4
5. Usa `motion` (ja instal·lat) per les transicions del picker

I el que **val la pena per al TFG memoir**, no per l'app:

### **#5 CPU Architecture** → al capítol §9.3 (Disseny del servidor MCP)

Retonar colors a parchment-gold + topographic-green + neutres. Exportar
com a screenshot PNG per a la memòria (no cal inclusió al build). Fa de
diagrama animat del flux d'una request per auth → MCP server → Notes
Service → Postgres amb RLS. Visualment superior a un C4 estàtic.

La resta els mantenim com a referència / possibles additions al landing
pública si mai decidim fer-la més "impactant".

## Com integrar-ne un

Quan decidim incorporar un d'aquests components:

1. Copiar el `.tsx` a `src/components/ui/<nom>.tsx`
2. Instal·lar les dependencies noves amb `npm install <pkg>`
3. Ajustar colors i anti-patterns (substituir `blue-500` → `primary`,
   `purple-500` → `secondary`, etc.)
4. Integrar al flux on calgui
5. Capturar abans/després amb Playwright per documentar el canvi
6. Commit amb referència a aquest README i al component origen

## Veure'ls en viu

Cap d'aquests fitxers està al build. Per veure'ls renderitzats cal
copiar-los a `src/components/ui/` i montar-los en una ruta
(`src/app/_demos/` per exemple). No cal fer-ho ara; existirien només
per validació visual, no per entregar.
