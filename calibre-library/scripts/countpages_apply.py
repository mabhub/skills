# Usage : calibre-debug countpages_apply.py -- RESULTATS.jsonl [--ids 12,15-18] [--overwrite] [--apply] [--library PATH]
#
# Écrit les pages et mots calculés par countpages_compute.py. DRY-RUN PAR DÉFAUT :
# sans --apply, affiche seulement ce qui serait écrit.
#
# Règles :
#   - colonnes cibles lues dans les réglages du plugin (jamais d'après le lookup name) ;
#   - seules les cases vides sont remplies, sauf --overwrite (ex. fichier remplacé) ;
#   - un résultat à 0 mot n'est JAMAIS écrit : c'est une BD ou un livre sans texte
#     extractible, et ses « 1-2 pages » seraient fausses. Un livre quasi vide mais qui a
#     du texte (quelques mots) est écrit tel quel ;
#   - --ids restreint l'écriture (indispensable si le fichier de résultats couvre plus
#     large que le lot validé).
# Écrit via new_api.set_field : metadata_dirtied est alimenté, mais lancer quand même
# `calibredb backup_metadata --all` puis opf_crosscheck.py après le lot. GUI fermé.
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('results')
ap.add_argument('--ids')
ap.add_argument('--overwrite', action='store_true')
ap.add_argument('--apply', action='store_true')
lib_config.library_arg(ap)
a = ap.parse_args(sys.argv[1:])
cfg = lib_config.load(a.library)

con = lib_config.connect_ro(cfg['library'])
cols = lib_config.countpages_columns(con)
if 'pages' not in cols or 'words' not in cols:
    sys.exit('Réglages Count Pages absents de la bibliothèque.')
lp, lw = cols['pages'][0], cols['words'][0]
# Valeurs actuelles lues en SQLite readonly : ouvrir la bibliothèque par l'API calibre
# peut écrire (préférences, nettoyage), ce qui n'a pas sa place dans un dry-run.
cur_pages = dict(con.execute(f"select book, value from {cols['pages'][1]}"))
cur_words = dict(con.execute(f"select book, value from {cols['words'][1]}"))

with open(a.results) as fi:
    rows = [json.loads(line) for line in fi if line.strip()]
if a.ids:
    wanted = set(lib_config.parse_ids(a.ids))
    rows = [r for r in rows if r['id'] in wanted]

errors = [r for r in rows if r.get('error')]
no_text = [r for r in rows if not r.get('error') and not r.get('words')]
good = [r for r in rows if not r.get('error') and r.get('words')]

pages, words, kept = {}, {}, []
for r in good:
    cur_p, cur_w = cur_pages.get(r['id']), cur_words.get(r['id'])
    if r.get('pages') and (a.overwrite or cur_p is None):
        pages[r['id']] = r['pages']
    elif cur_p is not None and cur_p != r.get('pages'):
        kept.append((r['id'], 'pages', cur_p, r.get('pages')))
    if a.overwrite or cur_w is None:
        words[r['id']] = r['words']
    elif cur_w != r['words']:
        kept.append((r['id'], 'mots', cur_w, r['words']))

print(f"colonnes : pages → {lp} « {cols['pages'][2]} », mots → {lw} « {cols['words'][2]} »")
print(f'résultats : {len(rows)} | erreurs : {len(errors)} | sans texte (jamais écrits) : {len(no_text)}')
print(f'à écrire : {len(pages)} pages, {len(words)} mots | valeurs existantes conservées : {len(kept)}')
for r in no_text[:20]:
    print(f"  sans texte : id {r['id']} ({r.get('pages')} p., {r.get('words')} mots)")
for bid, what, cur, new in kept[:20]:
    print(f'  conservé : id {bid} {what} {cur} (calcul : {new}) — --overwrite pour remplacer')
for r in errors[:20]:
    print(f"  erreur : id {r['id']} {r['error'][:80]}")

if not a.apply:
    print('\nDRY-RUN : rien n\'a été écrit. Relancer avec --apply après validation.')
    sys.exit(0)
# new_api écrit même quand le GUI tourne (calibredb, lui, refuse) : garde explicite
if lib_config.gui_pids():
    sys.exit('✖ GUI Calibre ouvert : le fermer avant d\'écrire (rien n\'a été écrit).')
if lib_config.backup_metadata_pids():
    sys.exit('✖ backup_metadata en cours : attendre sa fin (rien n\'a été écrit).')
from calibre.library import db  # noqa: E402

d = db(cfg['library']).new_api
d.set_field(lp, pages)
d.set_field(lw, words)
print('écrit. Étapes suivantes : calibredb backup_metadata --all, puis opf_crosscheck.py')
