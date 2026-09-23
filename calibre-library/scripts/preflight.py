#!/usr/bin/env python3
"""Contrôles préalables à toute intervention sur une bibliothèque Calibre. Lecture seule.

Usage :
  python3 preflight.py [--library PATH]          # avant un diagnostic
  python3 preflight.py [--library PATH] --write  # avant un lot d'écritures : échoue (code 2)
                                                  # si le GUI ou un backup_metadata tourne

Affiche : configuration résolue, fichier d'état, compteurs, processus Calibre, espace disque.
"""
import argparse
import os
import shutil
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    lib_config.library_arg(ap)
    ap.add_argument('--write', action='store_true', help='contrôles bloquants avant écriture')
    a = ap.parse_args()
    cfg = lib_config.load(a.library)
    problems, warnings = [], []

    print(f"config        : {cfg['config_file'] or '(aucun fichier — défauts)'}")
    print(f"bibliothèque  : {cfg['library']}")
    for x in cfg['exclude_libraries']:
        print(f'  à ne pas viser : {x}')
    print(f"sauvegardes   : {cfg['backup_dir']}")
    print(f"archives      : {cfg['archive_dir'] or '(non configuré)'}")
    print(f"livrables     : {cfg['work_dir'] or '(non configuré — demander où déposer rapports et CSV)'}")

    st = cfg['state_file']
    if os.path.exists(st):
        age = (time.time() - os.path.getmtime(st)) / 86400
        print(f'fichier d\'état : {st} (modifié il y a {age:.0f} j) → À LIRE EN ENTIER AVANT TOUTE ACTION')
    else:
        print(f'fichier d\'état : ABSENT ({st}) → le créer en fin de chantier (references/fichier-etat.md)')
        warnings.append('pas de fichier d\'état : arbitrages et faux doublons antérieurs inconnus')

    try:
        con = lib_config.connect_ro(cfg['library'])
        q = lambda s: con.execute(s).fetchone()[0]  # noqa: E731
        print(f"compteurs     : livres={q('select count(*) from books')} "
              f"auteurs={q('select count(*) from authors')} séries={q('select count(*) from series')} "
              f"étiquettes={q('select count(*) from tags')} éditeurs={q('select count(*) from publishers')} "
              f"max_id={q('select max(id) from books')}")
        cp = lib_config.countpages_columns(con)
        cols = [f"{label} → {cp[k][0]} « {cp[k][2]} »" for k, label in (('pages', 'pages'), ('words', 'mots')) if k in cp]
        if cols:
            print(f"Count Pages   : {', '.join(cols)}")
    except Exception as e:  # base verrouillée pendant backup_metadata, par exemple
        problems.append(f'lecture de metadata.db impossible : {e}')

    gui = lib_config.gui_pids()
    bkp = lib_config.backup_metadata_pids()
    print(f"GUI calibre   : {'OUVERT (pid ' + ','.join(gui) + ')' if gui else 'fermé'}")
    if bkp:
        print(f"backup_metadata en cours (pid {','.join(bkp)}) : la base est verrouillée, attendre")
    if a.write and gui:
        problems.append('GUI Calibre ouvert : calibredb refusera d\'écrire — demander de le fermer')
    if a.write and bkp:
        problems.append('backup_metadata en cours : attendre sa fin')

    for label, path in (('bibliothèque', cfg['library']), ('archives', cfg['archive_dir'])):
        if path and os.path.exists(path):
            du = shutil.disk_usage(path)
            pct = 100 * du.used / du.total
            print(f'espace {label:<12}: {du.free / 1e9:.1f} Go libres ({pct:.0f} % occupé)')
            if pct > 90:
                warnings.append(f'disque de {label} occupé à {pct:.0f} % : vérifier avant toute archive complète')

    for w in warnings:
        print(f'⚠ {w}')
    for p in problems:
        print(f'✖ {p}')
    sys.exit(2 if problems else 0)


if __name__ == '__main__':
    main()
