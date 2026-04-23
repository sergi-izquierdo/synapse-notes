# Backlog — known issues i follow-ups del projecte

Registre de bugs funcionals i TODOs que **no formen part del scope
actiu** però cal resoldre abans de l'entrega final del TFG. Es
revisarà en tancar cada branca major (p. ex. `feat/ui-refresh` →
repassar aquest fitxer abans de merge).

Cada entrada ha de tenir: data de detecció, evidència, hipòtesi de
causa, on mirar, i (quan es resolgui) commit que la tanca.

---

## 1. RAG: recall insuficient a queries en català singular/plural

**Detectat:** 2026-04-23, durant la review de UI-4.

**Evidència** (chat a production):

> **User:** "Noms de gats?"
> **AI:** *"Segons la memòria que tinc, només hi ha una nota amb el
> contingut 'Test', que no conté cap nom de gats. No puc veure una
> llista de noms de gats a les notes actuals. Les etiquetes
> disponibles són 'Idees' i 'Compra', però cap d'elles sembla ser
> específica per a gats. Vols que cerqui en alguna de les categories
> disponibles?"*

A la base de dades existeix la nota:

> *"Noms de gat: Kuro, Shiro"* (tag: Idees)

El model NO hauria d'haver dit "només hi ha una nota amb el contingut
'Test'". La nota existeix, és rellevant i està indexada amb embedding.

**Hipòtesis de causa (per verificar):**

1. **Embedding mismatch singular/plural.** La query *"gats?"* produeix
   un vector que no queda prou a prop del vector de *"Noms de gat:
   Kuro, Shiro"* (singular vs plural + signe de pregunta). El llindar
   `match_threshold: 0.1` a `/api/chat/route.ts:41` hauria de ser prou
   permissiu, però el top-N pot quedar dominat per notes irrellevants
   més properes.
2. **El model no intenta tools agressivament.** El system prompt a
   `/api/chat/route.ts` diu *"ONLY use the 'getNotesByTag' tool if the
   user explicitly asks for a list, category, or tag"*. Una pregunta
   com *"Noms de gats?"* no sol·licita explícitament una etiqueta, així
   que el model no crida `getNotesByTag('Idees')` tot i que seria la
   ruta correcta.
3. **Inducció incorrecta des del RAG context.** El `systemPrompt`
   concatena les 10 notes més properes al context. Si entre aquestes
   10 no hi ha la de "Noms de gat" (per raó 1), el model respon
   només amb les que veu, i s'estable en *"només hi ha 'Test'"*.

**On mirar:**

- `src/app/api/chat/route.ts` — ajustar `match_threshold` a 0.15-0.2,
  o augmentar `match_count` a 20.
- El system prompt: afegir *"si l'usuari pregunta per un tema concret
  i el context no el conté, intenta cridar `getNotesByTag` amb les
  etiquetes més properes abans de dir que no saps"*.
- `/api/mcp` (no aplica ara, però el problema es repetirà a Setmana
  3-5 amb el red-team suite): documentar el llindar OCK al
  capítol 11 de la memòria.

**Prioritat:** mitjana. No bloqueja entrega però afecta la
credibilitat de la demo (el tribunal pot preguntar pel recall i ara
la resposta és fluixa).

**Commit que ho tanca:** _pendent_.

---
