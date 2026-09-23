# Usage : calibre-debug countpages_compute.py -- OUT.jsonl (--missing | --ids 12,15-18 | --all) [--jobs 8] [--limit N] [--library PATH]
#
# Calcule pages et mots avec le code du plugin Count Pages, SANS RIEN ÉCRIRE en base.
# Réglages repris de la bibliothèque (algorithme, caractères par page, colonnes cibles).
# Reprise possible : les ids déjà présents dans OUT.jsonl sont sautés.
#
#   --missing : livres dont l'une des deux colonnes est vide
#   --ids     : liste explicite (ex. les livres qu'on vient d'ajouter)
#   --all     : toute la bibliothèque (recalcul de contrôle)
#
# Pièges gérés : le plugin SUPPRIME le fichier qu'il analyse (on lui passe une copie) ;
# calibre-debug exécute le script d'une façon qui gêne le pickling (voir __main__.run).
# Ordre de grandeur : ~25 min pour 5500 livres avec 10 processus.
import argparse
import json
import multiprocessing
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('out')
g = ap.add_mutually_exclusive_group(required=True)
g.add_argument('--missing', action='store_true')
g.add_argument('--ids')
g.add_argument('--all', action='store_true')
ap.add_argument('--jobs', type=int, default=8)
ap.add_argument('--limit', type=int, default=0)
lib_config.library_arg(ap)
a = ap.parse_args(sys.argv[1:])

cfg = lib_config.load(a.library)
LIB = cfg['library']

from calibre.utils.config import prefs  # noqa: E402
from calibre.customize.ui import find_plugin  # noqa: E402

if not find_plugin('Count Pages'):
    sys.exit('Plugin Count Pages non installé dans ce profil calibre.')
from calibre_plugins.count_pages.jobs import do_statistics_for_book  # noqa: E402
import calibre_plugins.count_pages.config as cpcfg  # noqa: E402

c = lib_config.connect_ro(LIB)
cols = lib_config.countpages_columns(c)
if 'pages' not in cols or 'words' not in cols:
    sys.exit('Réglages Count Pages absents de la bibliothèque (colonnes pages/mots non configurées).')
settings = cols['_settings']
algo, cpp = settings['algorithmPages'], settings['customCharsPerPage']
tp, tw = cols['pages'][1], cols['words'][1]
print(f"pages → {cols['pages'][0]} « {cols['pages'][2]} » | mots → {cols['words'][0]} « {cols['words'][2]} »",
      file=sys.stderr)

if a.missing:
    where = f'id not in (select book from {tp}) or id not in (select book from {tw})'
elif a.ids:
    where = 'id in (%s)' % ','.join(str(i) for i in lib_config.parse_ids(a.ids))
else:
    where = '1'
books = c.execute(f'select id, path from books where {where} order by id').fetchall()
fmts = {}
for b, f, n in c.execute('select book, format, name from data'):
    fmts.setdefault(b, {})[f.lower()] = n
order = [prefs['output_format'].lower()] + [f.lower() for f in prefs['input_format_order']]

done = set()
if os.path.exists(a.out):
    with open(a.out) as fi:
        done = {json.loads(line)['id'] for line in fi if line.strip()}

tasks = []
for bid, path in books:
    if bid in done:
        continue
    fm = fmts.get(bid, {})
    fmt = next((f for f in order if f in fm), None)
    src = os.path.join(LIB, path, f'{fm[fmt]}.{fmt}') if fmt else None
    tasks.append((bid, fmt, src))
if a.limit:
    tasks = tasks[:a.limit]


def run(t):
    bid, fmt, src = t
    if not src or not os.path.exists(src):
        return {'id': bid, 'fmt': fmt, 'error': 'aucun fichier exploitable'}
    tdir = tempfile.mkdtemp(prefix='cp_')
    dst = os.path.join(tdir, f'{bid}.{fmt}')
    try:
        shutil.copyfile(src, dst)  # le plugin supprime le fichier traité : toujours une copie
        r = do_statistics_for_book(dst, algo, 'Estimate', None,
                                   [cpcfg.STATISTIC_PAGE_COUNT, cpcfg.STATISTIC_WORD_COUNT],
                                   None, cpp, True)
        return {'id': bid, 'fmt': fmt, 'pages': r.get(cpcfg.STATISTIC_PAGE_COUNT),
                'words': r.get(cpcfg.STATISTIC_WORD_COUNT)}
    except Exception as e:
        return {'id': bid, 'fmt': fmt, 'error': repr(e)}
    finally:
        shutil.rmtree(tdir, ignore_errors=True)


import __main__  # noqa: E402
__main__.run = run  # nécessaire au pickling sous calibre-debug

print(f'{len(tasks)} livres à traiter (déjà faits : {len(done)}), algo={algo}, jobs={a.jobs}', file=sys.stderr)
with open(a.out, 'a') as fo, multiprocessing.get_context('fork').Pool(a.jobs, maxtasksperchild=20) as pool:
    for i, r in enumerate(pool.imap_unordered(run, tasks), 1):
        fo.write(json.dumps(r) + '\n')
        fo.flush()
        if i % 100 == 0:
            print(f'{i}/{len(tasks)}', file=sys.stderr)
print(f'terminé → {a.out}', file=sys.stderr)
