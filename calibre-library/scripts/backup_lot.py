#!/usr/bin/env python3
"""Sauvegarde préalable à un lot d'écritures. N'écrit que dans le dossier de sauvegarde.

Usage :
  python3 backup_lot.py <LOT> [--library PATH]
      → <backup_dir>/metadata-PRE-<LOT>-<AAAA-MM-JJ>.db (suffixe -HHMM si le nom existe)
  python3 backup_lot.py <LOT> --trash <fichier-ou-dossier> [...]
      → copie aussi chaque chemin dans <backup_dir>/trash/<LOT>/ avant remplacement
        ou suppression (le fichier d'origine n'est pas touché)

La copie de la base passe par l'API de sauvegarde SQLite (cohérente même si un lecteur
est ouvert), puis est vérifiée par `PRAGMA integrity_check`.
"""
import argparse
import datetime
import os
import re
import shutil
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('lot', help='nom court du lot, ex. TAGS-CASSE ou AJOUT-EPUB')
    lib_config.library_arg(ap)
    ap.add_argument('--trash', nargs='+', default=[], help='fichiers/dossiers à copier dans trash/<LOT>/')
    a = ap.parse_args()
    cfg = lib_config.load(a.library)
    lot = re.sub(r'[^A-Za-z0-9_-]+', '-', a.lot).strip('-').upper()
    bdir = cfg['backup_dir']
    os.makedirs(bdir, exist_ok=True)

    now = datetime.datetime.now()
    dst = os.path.join(bdir, f'metadata-PRE-{lot}-{now:%Y-%m-%d}.db')
    if os.path.exists(dst):
        dst = dst[:-3] + f'-{now:%H%M}.db'
    if os.path.exists(dst):
        sys.exit(f'{dst} existe déjà : attendre une minute ou changer le nom du lot')
    src = lib_config.connect_ro(cfg['library'])
    out = sqlite3.connect(dst)
    src.backup(out)
    ok = out.execute('pragma integrity_check').fetchone()[0]
    n = out.execute('select count(*) from books').fetchone()[0]
    out.close()
    if ok != 'ok':
        sys.exit(f'✖ copie corrompue ({ok}) : {dst}')
    print(f'base sauvegardée : {dst} ({os.path.getsize(dst) / 1e6:.1f} Mo, {n} livres, intégrité ok)')

    if a.trash:
        tdir = os.path.join(bdir, 'trash', lot)
        os.makedirs(tdir, exist_ok=True)
        for p in a.trash:
            p = os.path.abspath(p)
            target = os.path.join(tdir, os.path.basename(p.rstrip('/')))
            if os.path.exists(target):
                sys.exit(f'✖ {target} existe déjà : rien n\'est écrasé')
            if os.path.isdir(p):
                shutil.copytree(p, target)
            else:
                shutil.copy2(p, target)
            print(f'copié dans trash : {target}')


if __name__ == '__main__':
    main()
