"""Disable empty section headers (sections with only commented prose).
Comments out the \\section{...} line so it doesn't appear in PDF/TOC.
"""
import re

# Map file -> list of (kind, title) pairs. Kind = "section" or "subsection".
PLAN = {
    'sections/09-implementacio.tex': [
        ("section", r"UI optimista amb React 19 (useOptimistic + useTransition)"),
        ("section", r"Gestió de xats amb mode bulk-select"),
        ("section", r"Reordenació manual amb fractional indexing"),
        ("section", r"Visualitzador de graph neural"),
        ("section", r"Física del graph: tethering estil Obsidian"),
        ("section", r"Suggeriment automàtic d'etiquetes amb LLM estructurat"),
        ("section", r"Gestió d'etiquetes atòmica amb RLS"),
        ("section", r"Eines MCP per exploració del graph (exposició externa)"),
        ("section", r"Backlinks \texttt{[[N]]}: l'aresta EXTRACTED al graph de notes"),
        ("section", r"Polit del graph viewer: clusters, favourites i focus"),
        ("section", r"Autocomplete de backlinks i camp títol explícit"),
        ("section", r"Bug defensable: \texttt{search\_path} a funcions Postgres"),
    ],
    'sections/10-avaluacio.tex': [
        ("section", r"Verificació funcional de la plataforma base (Part~A)"),
        ("subsection", r"Desplegament i superfície funcional (abril 2026)"),
        ("subsection", r"Bugs detectats i resolts en acceptació (2026-04-23)"),
        ("subsection", r"Verificació accessibilitat de Radix Dialog"),
        ("subsection", r"Percepció de latència i actualitzacions optimistes (2026-04-24)"),
        ("subsection", r"Gestió d'historial del xat (2026-04-24)"),
        ("section", r"Auditoria estructural via graphify"),
        ("subsection", r"Reducció de context via retrieval sobre la graph"),
        ("subsection", r"Correspondència disseny <-> implementació"),
        ("subsection", r"Limitacions detectades de l'extractor AST+LLM"),
    ],
    'sections/08-disseny.tex': [
        ("section", r"Validació estructural del disseny via graphify"),
    ],
}

for path, entries in PLAN.items():
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for kind, title in entries:
        cmd = '\\\\' + kind  # match \section or \subsection
        # Skip if already disabled
        if '%% \\' + kind + '{' + title + '}' in content:
            print(f'  {path}: already disabled "{title[:50]}..."')
            continue
        pattern = re.compile(
            r'^\\' + kind + r'\{' + re.escape(title) + r'\}',
            re.MULTILINE,
        )
        new_content, n = pattern.subn(
            r'%% \\' + kind + r'{' + title + r'} % DISABLED (prose commented out)',
            content,
        )
        if n > 0:
            content = new_content
            print(f'  {path}: disabled {kind} "{title[:50]}..."')
        else:
            print(f'  {path}: NOT FOUND {kind} "{title[:50]}..."')
    if content != original:
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        print(f'Wrote {path}\n')
