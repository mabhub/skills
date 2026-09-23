"""Résolution de la configuration du skill calibre-library.

Importé par les autres scripts (y compris sous `calibre-debug`). Aucune écriture.

Ordre de résolution du fichier de config :
  1. $CALIBRE_LIBRARY_SKILL_CONFIG
  2. $XDG_CONFIG_HOME/calibre-library-skill/config.json (défaut ~/.config/…)
  3. aucun fichier : valeurs par défaut

Ordre de résolution de la bibliothèque :
  1. option --library du script
  2. clé "library" de la config
  3. $CALIBRE_LIBRARY_PATH (variable utilisée par le serveur MCP calibre)
  4. erreur explicite — jamais de devinette
"""
import json
import os
import sqlite3
import subprocess
import sys
import urllib.parse

STATE_NAME = '.calibre-library-state.md'


def config_path():
    env = os.environ.get('CALIBRE_LIBRARY_SKILL_CONFIG')
    if env:
        return os.path.expanduser(env)
    base = os.environ.get('XDG_CONFIG_HOME') or os.path.expanduser('~/.config')
    return os.path.join(base, 'calibre-library-skill', 'config.json')


def _expand(value, library=None):
    if value is None:
        return None
    if library:
        value = value.replace('{library}', library)
    return os.path.abspath(os.path.expanduser(value))


def load(library=None):
    """Retourne un dict de configuration résolue. Lève SystemExit si aucune bibliothèque."""
    path = config_path()
    raw = {}
    if os.path.exists(path):
        with open(path, encoding='utf8') as f:
            raw = json.load(f)
    lib = library or raw.get('library') or os.environ.get('CALIBRE_LIBRARY_PATH')
    if not lib:
        sys.exit('Bibliothèque inconnue : passer --library, renseigner "library" dans '
                 f'{path}, ou définir $CALIBRE_LIBRARY_PATH.')
    lib = os.path.abspath(os.path.expanduser(lib))
    excluded = [_expand(x) for x in raw.get('exclude_libraries', [])]
    # realpath : un lien symbolique vers une bibliothèque exclue ne doit pas passer
    if os.path.realpath(lib) in {os.path.realpath(x) for x in excluded}:
        sys.exit(f'{lib} est déclarée dans exclude_libraries : ce n\'est pas la bonne cible.')
    if not os.path.exists(os.path.join(lib, 'metadata.db')):
        sys.exit(f'{lib} ne contient pas de metadata.db : ce n\'est pas une bibliothèque Calibre.')
    return {
        'config_file': path if os.path.exists(path) else None,
        'library': lib,
        'exclude_libraries': excluded,
        'state_file': os.path.join(lib, STATE_NAME),
        'backup_dir': _expand(raw.get('backup_dir', '{library}/.calibre-mcp-backups'), lib),
        'archive_dir': _expand(raw.get('archive_dir'), lib),
        'work_dir': _expand(raw.get('work_dir'), lib),
    }


def connect_ro(lib):
    """Connexion SQLite en lecture seule (insensible au verrou du GUI).

    Le chemin est encodé : non encodé, un `#` ou un `?` dans le nom de la bibliothèque
    ferait tomber `?mode=ro` dans le fragment de l'URI, et SQLite ouvrirait (ou créerait)
    la base en écriture.
    """
    uri = 'file:' + urllib.parse.quote(os.path.join(lib, 'metadata.db')) + '?mode=ro'
    return sqlite3.connect(uri, uri=True)


def _pgrep_exact(name):
    """[(pid, ligne de commande)] des processus dont le nom est exactement `name`.

    Jamais `pgrep -f` : il attrape aussi le shell qui lance la commande courante.
    """
    r = subprocess.run(['pgrep', '-a', '-x', name], capture_output=True, text=True)
    out = []
    for line in r.stdout.splitlines():
        pid, _, cmd = line.partition(' ')
        if pid.isdigit() and int(pid) != os.getpid():
            out.append((pid, cmd))
    return out


def gui_pids():
    """Pids du GUI calibre (calibredb refuse d'écrire tant qu'il tourne ; new_api, non)."""
    return [pid for pid, _ in _pgrep_exact('calibre')]


def backup_metadata_pids():
    """Pids d'un `calibredb backup_metadata` en cours (la base est alors verrouillée)."""
    return [pid for pid, cmd in _pgrep_exact('calibredb') if 'backup_metadata' in cmd]


def epub_paths(con, lib, ids=None):
    """[(id, chemin)] des EPUB déclarés en base (table `data`), restreints à `ids` si donné.

    Le chemin peut ne pas exister sur le disque : à l'appelant de le signaler.
    """
    rows = con.execute("select b.id, b.path, d.name from books b join data d on d.book=b.id "
                       "where d.format='EPUB' order by b.id").fetchall()
    if ids is not None:
        wanted = set(ids)
        rows = [r for r in rows if r[0] in wanted]
    return [(bid, os.path.join(lib, path, name + '.epub')) for bid, path, name in rows]


def find_epubs(paths):
    """Fichiers .epub donnés ou contenus (récursivement) dans les dossiers donnés."""
    out = []
    for p in paths:
        p = os.path.expanduser(p)
        if os.path.isdir(p):
            out += [os.path.join(r, f) for r, _d, fs in os.walk(p) for f in fs if f.lower().endswith('.epub')]
        else:
            out.append(p)
    return sorted(out)


def library_arg(parser):
    parser.add_argument('--library', help='chemin de la bibliothèque (sinon config ou $CALIBRE_LIBRARY_PATH)')


def parse_ids(spec):
    """'12,15-18' → [12, 15, 16, 17, 18]"""
    ids = []
    for part in spec.split(','):
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            a, b = part.split('-', 1)
            ids.extend(range(int(a), int(b) + 1))
        else:
            ids.append(int(part))
    return ids


def countpages_columns(con):
    """Colonnes où le plugin Count Pages écrit pages et mots, lues dans ses réglages.

    Ne jamais se fier au lookup name (#pagecount peut contenir des mots).
    Retourne {'pages': ('#lookup', 'custom_column_N', 'Libellé'), 'words': …} ou {}.
    """
    row = con.execute("select val from preferences "
                      "where key='namespaced:CountPagesPlugin:settings'").fetchone()
    if not row:
        return {}
    settings = json.loads(row[0])
    cols = {}
    for key, setting in (('pages', 'customColumnPages'), ('words', 'customColumnWords')):
        lookup = settings.get(setting)
        if not lookup:
            continue
        r = con.execute('select id, name from custom_columns where label=?',
                        (lookup.lstrip('#'),)).fetchone()
        if r:
            cols[key] = (lookup, f'custom_column_{r[0]}', r[1])
    cols['_settings'] = settings
    return cols
