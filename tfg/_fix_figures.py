"""Replace \\centerfloat with \\centering and [H] with [htbp] inside figure environments only.
Tables (\\begin{table}) are left untouched.
"""
import re
import os

files = [
    'sections/06-planificacio.tex',
    'sections/08-disseny.tex',
    'sections/09-implementacio.tex',
    'sections/10-avaluacio.tex',
    'sections/11-costos.tex',
    'sections/12-legislacio.tex',
    'sections/15-annexos.tex',
]

total = 0
for f in files:
    if not os.path.exists(f):
        print(f'SKIP missing: {f}')
        continue
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    original = content

    def fig_centerfloat(m):
        return (
            m.group(1).replace('[H]', '[htbp]')
            + m.group(2)
            + '\\centering'
        )

    pattern = re.compile(
        r'(\\begin\{figure\}\[H\])(\s*\n\s*)\\centerfloat',
        re.MULTILINE,
    )
    n = len(pattern.findall(content))
    content = pattern.sub(fig_centerfloat, content)

    if content != original:
        with open(f, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(content)
        print(f'{f}: {n} figure(s) converted')
        total += n

print(f'Total: {total}')
