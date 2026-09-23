#!/usr/bin/env python3
"""Balaye la bibliothèque (ou des fichiers donnés) à la recherche de résidus d'acheteur
et de DRM dans les EPUB. Lecture seule. N'affiche que des noms de porteurs, jamais leur
contenu.

Usage :
  python3 scan_residus.py [--library PATH]          # tous les EPUB déclarés en base
  python3 scan_residus.py --ids 7390,7395           # quelques livres
  python3 scan_residus.py --paths ~/Téléchargements # fichiers ou dossiers hors bibliothèque
  … --deep                                          # + e-mails / mentions d'achat dans le texte

Parcourt la table `data` (pas un `find` du disque) : chaque résultat porte son id, et
les chemins avec espaces ne cassent rien. Signale aussi les EPUB déclarés mais absents.
"""
import argparse
import collections
import os
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402
from epub_quality import residues  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    lib_config.library_arg(ap)
    ap.add_argument('--ids')
    ap.add_argument('--paths', nargs='+')
    ap.add_argument('--deep', action='store_true')
    a = ap.parse_args()
    if a.paths:
        items = [(None, p) for p in lib_config.find_epubs(a.paths)]
    else:
        cfg = lib_config.load(a.library)
        items = lib_config.epub_paths(lib_config.connect_ro(cfg['library']), cfg['library'],
                                      lib_config.parse_ids(a.ids) if a.ids else None)

    total, missing, broken = 0, [], []
    per_kind = collections.Counter()
    hits = []
    for bid, p in items:
        total += 1
        if not os.path.exists(p):
            missing.append((bid, p))
            continue
        try:
            with zipfile.ZipFile(p) as z:
                found = residues(z, a.deep)
        except Exception as e:
            broken.append((bid, p, str(e)[:60]))
            continue
        if found:
            hits.append((bid, p, found))
            for f in found:
                # « type:porteur » sans chemin ni compte (e-mail×3 → e-mail) : une ligne par type
                kind, _, what = f.partition(':')
                per_kind[f"{kind}:{what.split('/')[-1].split('×')[0]}"] += 1

    print(f'EPUB examinés : {total} | avec résidus : {len(hits)} | absents : {len(missing)} | illisibles : {len(broken)}')
    for k, v in per_kind.most_common():
        print(f'  {k:<40} {v}')
    for bid, p, found in hits:
        print(f"{bid if bid is not None else '-':>6}  {os.path.basename(p)[:50]:<50} {', '.join(found)}")
    for bid, p in missing:
        print(f'{bid if bid is not None else "-":>6}  ABSENT du disque : {p}')
    for bid, p, e in broken:
        print(f'{bid if bid is not None else "-":>6}  ILLISIBLE ({e}) : {p}')


if __name__ == '__main__':
    main()
