"""Render the repository's small, trusted Markdown case notes as static pages.

No external packages; supports only the Markdown used by this portfolio.
Run from any directory: python3 /absolute/path/to/build.py
"""
from pathlib import Path
import html
import re

ROOT = Path(__file__).resolve().parent


def inline(text):
    text = html.escape(text)
    text = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', r'<img alt="\1" src="\2" loading="lazy">', text)
    text = re.sub(r'\[([^\]]*)\]\(([^)]+)\)', r'<a href="\2">\1</a>', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'`([^`]+)`', r'<code>\1</code>', text)


def render(source):
    blocks = []
    for paragraph in source.strip().split('\n\n'):
        if paragraph.startswith('|'):
            rows = paragraph.splitlines()
            cells = lambda row: ''.join('<td>' + inline(cell.strip()) + '</td>' for cell in row.strip('|').split('|'))
            head = cells(rows[0]).replace('<td>', '<th>').replace('</td>', '</th>')
            blocks.append('<div class="table-scroll"><table><thead><tr>' + head + '</tr></thead><tbody>' + ''.join('<tr>' + cells(row) + '</tr>' for row in rows[2:]) + '</tbody></table></div>')
        elif paragraph.startswith('## '):
            blocks.append('<h2>' + inline(paragraph[3:]) + '</h2>')
        elif paragraph.startswith('# '):
            blocks.append('<h1>' + inline(paragraph[2:]) + '</h1>')
        else:
            blocks.append('<p>' + inline(paragraph) + '</p>')
    return '\n'.join(blocks)


for path in [*sorted((ROOT / 'cases').glob('*.md')), ROOT / 'ASSET_SOURCES.md']:
    depth = '../' if path.parent.name == 'cases' else ''
    text = path.read_text()
    text = text.replace('../README.md', '../index.html')
    text = text.replace('../ASSET_SOURCES.md', '../sources.html')
    for case in (ROOT / 'cases').glob('*.md'):
        text = text.replace('](' + case.name + ')', '](' + case.stem + '.html)')
    title = html.escape(text.splitlines()[0].lstrip('# '))
    target = path.with_suffix('.html') if depth else ROOT / 'sources.html'
    target.write_text(f'''<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title} — портфолио Андрея</title><link rel="stylesheet" href="{depth}style.css"><link rel="icon" href="{depth}assets/favicon.svg" type="image/svg+xml"></head><body><header class="wrap header"><a class="identity" href="{depth}index.html">Андрей<span>Сайты, боты и сервисы</span></a><a href="https://t.me/andrey_larp">Написать в Telegram</a></header><main class="wrap reader">{render(text)}</main><footer class="wrap footer"><a href="{depth}index.html">Все проекты</a><a href="https://github.com/slavuus-and-swatik/work#readme">Портфолио на GitHub</a></footer></body></html>''')
    print(target.relative_to(ROOT))
