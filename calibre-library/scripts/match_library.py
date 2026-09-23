#!/usr/bin/env python3
"""Confronte des EPUB candidats (hors bibliothèque) à la base, titre et auteur normalisés.
Lecture seule.

Usage :
  python3 match_library.py FICHIER_OU_DOSSIER [...] [--library PATH] [--csv sortie.csv]

Pour chaque EPUB : titre/auteurs lus dans son OPF interne, puis verdict :
  EN BASE        titre normalisé identique et au moins un nom d'auteur commun
  AUTEUR≠        titre identique, auteurs sans nom commun : homonyme ou auteur mal saisi
  PROCHE         titre similaire (≥ 0,88) avec un nom d'auteur commun : variante à vérifier
  NOUVEAU        rien de comparable en base
Et des indices pour le tri livre / article / notice : nom horodaté, nombre de mots, résidus.

La normalisation (minuscules, accents, ligatures et ponctuation retirés, article initial
ignoré, « tome II » = « tome 2 ») attrape ce que `find_duplicates` rate : apostrophe
droite/typographique, accent manquant, tiret, article, numérotation.
Un verdict n'est qu'un indice : comparer le CONTENU avant toute décision (epub_quality.py --compare).
"""
import argparse
import csv
import difflib
import html
import os
import re
import sys
import unicodedata
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402
from epub_quality import analyse  # noqa: E402

STAMP = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}[-:]?\d{2}')


def norm(s):
    s = (s or '').lower().replace('œ', 'oe').replace('æ', 'ae')
    s = ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))
    return ' '.join(re.sub(r'[^\w]+', ' ', s).split())


ARTICLES = {'le', 'la', 'les', 'l', 'un', 'une', 'des', 'the', 'a', 'an'}
ROMAN = {r: str(i) for i, r in enumerate(
    'i ii iii iv v vi vii viii ix x xi xii xiii xiv xv xvi xvii xviii xix xx'.split(), 1)}


def title_key(s):
    """Clé de comparaison : norm() + article initial retiré + chiffres romains isolés → arabes."""
    toks = norm(s).split()
    if len(toks) > 1 and toks[0] in ARTICLES:
        toks = toks[1:]
    # « v », « x » ou « i » seuls ne sont convertis qu'après un mot de volume
    out = [ROMAN.get(t, t) if (len(t) > 1 or (k and toks[k - 1] in {'tome', 'volume', 'livre', 'partie', 'vol', 't'}))
           else t for k, t in enumerate(toks)]
    return ' '.join(out)


def author_tokens(names):
    toks = set()
    for n in names:
        toks |= {t for t in norm(n.replace('|', ' ')).split() if len(t) >= 3}
    return toks - {'various', 'unknown', 'inconnu', 'collectif'}


def epub_meta(path):
    try:
        with zipfile.ZipFile(path) as z:
            c = z.read('META-INF/container.xml').decode('utf8', 'replace')
            o = z.read(re.search(r'full-path="([^"]+)"', c).group(1)).decode('utf8', 'replace')
    except Exception:
        return os.path.splitext(os.path.basename(path))[0], []
    t = re.search(r'<dc:title[^>]*>(.*?)</dc:title>', o, re.S)
    authors = [html.unescape(a).strip() for a in re.findall(r'<dc:creator[^>]*>(.*?)</dc:creator>', o, re.S)]
    title = html.unescape(t.group(1)).strip() if t else os.path.splitext(os.path.basename(path))[0]
    return title, authors


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('paths', nargs='+')
    lib_config.library_arg(ap)
    ap.add_argument('--csv', help='écrit aussi le résultat en CSV')
    ap.add_argument('--no-text', action='store_true', help='ne pas analyser le texte (plus rapide)')
    a = ap.parse_args()
    cfg = lib_config.load(a.library)
    con = lib_config.connect_ro(cfg['library'])

    books = con.execute("""select b.id, b.title, group_concat(a.name, '|')
                           from books b left join books_authors_link l on l.book=b.id
                           left join authors a on a.id=l.author group by b.id""").fetchall()
    by_title = {}
    for bid, title, auth in books:
        by_title.setdefault(title_key(title), []).append((bid, title, author_tokens((auth or '').split('|'))))
    titles = list(by_title)

    rows = []
    for f in lib_config.find_epubs(a.paths):
        title, authors = epub_meta(f)
        nt, at = title_key(title), author_tokens(authors)
        verdict, match = 'NOUVEAU', ''
        cands = by_title.get(nt, [])
        same = [c for c in cands if c[2] & at]
        if same:
            verdict, match = 'EN BASE', ','.join(str(c[0]) for c in same)
        elif cands:
            verdict, match = 'AUTEUR≠', ','.join(f'{c[0]}' for c in cands)
        else:
            close = difflib.get_close_matches(nt, titles, n=5, cutoff=0.88)
            near = [c for t in close for c in by_title[t] if c[2] & at]
            if near:
                verdict, match = 'PROCHE', ','.join(f'{c[0]}:{c[1][:30]}' for c in near)
        info = {'mots': '', 'résidus': ''}
        if not a.no_text:
            r = analyse(f)
            info = {'mots': r.get('mots', r.get('err', '')), 'résidus': ','.join(r['résidus']) if isinstance(r.get('résidus'), list) else ''}
        flags = 'horodaté' if STAMP.search(os.path.basename(f)) else ''
        rows.append({'verdict': verdict, 'ids_base': match, 'titre': title, 'auteurs': ' & '.join(authors),
                     'mots': info['mots'], 'indices': flags, 'résidus': info['résidus'], 'fichier': f})

    order = {'EN BASE': 0, 'AUTEUR≠': 1, 'PROCHE': 2, 'NOUVEAU': 3}
    rows.sort(key=lambda r: (order[r['verdict']], r['titre']))
    for r in rows:
        print(f"{r['verdict']:<8} {r['ids_base'][:28]:<28} {r['titre'][:40]:<40} {r['auteurs'][:25]:<25} "
              f"{str(r['mots']):>7} {r['indices']} {r['résidus']}")
    counts = {k: sum(r['verdict'] == k for r in rows) for k in order}
    print(f'\n{len(rows)} fichiers : ' + ', '.join(f'{k} {v}' for k, v in counts.items()))
    if a.csv:
        with open(a.csv, 'w', newline='', encoding='utf8') as fo:
            w = csv.DictWriter(fo, fieldnames=list(rows[0]) if rows else ['verdict'])
            w.writeheader()
            w.writerows(rows)
        print(f'CSV : {a.csv}')


if __name__ == '__main__':
    main()
