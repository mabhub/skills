#!/usr/bin/env python3
"""Contrôle croisé metadata.db ↔ metadata.opf (les OPF posés à côté des livres). Lecture seule.

Usage :
  python3 opf_crosscheck.py [--library PATH] [--ids 7376-7395] [--fields title,tags] [--show 10]

Champs comparés : title, title_sort, authors, author_sort (opf:file-as du 1er auteur),
tags, series, series_index, publisher, et les colonnes personnalisées (#…, lues dans le
JSON échappé de `calibre:user_metadata:#…`, clé `#value#` — une regex sur le texte brut
produit des centaines de faux écarts).

À lancer après `calibredb backup_metadata --all` (GUI fermé). Un lot n'est terminé
qu'à 100 % de concordance. Pendant que backup_metadata tourne, la base est verrouillée :
attendre sa fin.
"""
import argparse
import collections
import json
import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402

NS = {'dc': 'http://purl.org/dc/elements/1.1/', 'opf': 'http://www.idpf.org/2007/opf'}
OPF_ATTR = '{http://www.idpf.org/2007/opf}'
CC_TYPES = {'int', 'float', 'bool', 'text', 'enumeration', 'series', 'rating'}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return v


def load_custom(con):
    """{'#label': (datatype, is_multiple, {book: valeur})}"""
    out = {}
    for cid, label, dtype, multi in con.execute(
            'select id, label, datatype, is_multiple from custom_columns'):
        if dtype not in CC_TYPES:
            continue
        t = f'custom_column_{cid}'
        cols = [r[1] for r in con.execute(f'pragma table_info({t})')]
        vals = collections.defaultdict(list)
        if 'book' in cols:
            q = f'select book, value from {t}'
        else:
            q = f'select l.book, v.value from books_{t}_link l join {t} v on v.id=l.value'
        for b, v in con.execute(q):
            vals[b].append(v)
        out['#' + label] = (dtype, bool(multi), vals)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    lib_config.library_arg(ap)
    ap.add_argument('--ids')
    ap.add_argument('--fields', help='liste de champs à comparer (défaut : tous)')
    ap.add_argument('--show', type=int, default=5, help='exemples affichés par champ')
    a = ap.parse_args()
    cfg = lib_config.load(a.library)
    lib = cfg['library']
    con = lib_config.connect_ro(lib)
    q = lambda s, *p: con.execute(s, p).fetchall()  # noqa: E731

    authors = collections.defaultdict(list)
    for b, n in q('select l.book, a.name from books_authors_link l join authors a on a.id=l.author order by l.id'):
        authors[b].append(n)
    tags = collections.defaultdict(list)
    for b, n in q('select l.book, t.name from books_tags_link l join tags t on t.id=l.tag'):
        tags[b].append(n)
    series = {b: n for b, n in q('select l.book, s.name from books_series_link l join series s on s.id=l.series')}
    pubs = {b: n for b, n in q('select l.book, p.name from books_publishers_link l join publishers p on p.id=l.publisher')}
    custom = load_custom(con)

    books = q('select id, title, sort, author_sort, series_index, path from books order by id')
    if a.ids:
        wanted = set(lib_config.parse_ids(a.ids))
        books = [b for b in books if b[0] in wanted]
    fields = set(a.fields.split(',')) if a.fields else None

    ok = missing = unreadable = 0
    diffs = collections.defaultdict(list)
    for bid, title, tsort, asort, sidx, path in books:
        p = os.path.join(lib, path, 'metadata.opf')
        if not os.path.exists(p):
            missing += 1
            continue
        try:
            md = ET.parse(p).getroot().find('opf:metadata', NS)
        except ET.ParseError:
            md = None
        if md is None:  # XML invalide, ou OPF sans <metadata>
            unreadable += 1
            continue
        meta = {m.get('name'): m.get('content') for m in md.findall('opf:meta', NS) if m.get('name')}
        creators = [c for c in md.findall('dc:creator', NS) if c.get(OPF_ATTR + 'role', 'aut') == 'aut']
        pub = md.find('dc:publisher', NS)
        db = {
            'title': title, 'title_sort': tsort,
            'authors': authors.get(bid, []), 'author_sort': asort,
            'tags': sorted(tags.get(bid, [])), 'series': series.get(bid),
            'series_index': num(sidx) if bid in series else None,
            'publisher': pubs.get(bid),
        }
        opf = {
            'title': (md.findtext('dc:title', None, NS) or ''),
            'title_sort': meta.get('calibre:title_sort', title),
            'authors': [c.text or '' for c in creators],
            'author_sort': creators[0].get(OPF_ATTR + 'file-as') if creators else None,
            'tags': sorted(s.text or '' for s in md.findall('dc:subject', NS)),
            'series': meta.get('calibre:series'),
            'series_index': num(meta.get('calibre:series_index')) if meta.get('calibre:series') else None,
            'publisher': pub.text if pub is not None else None,
        }
        for label, (dtype, multi, vals) in custom.items():
            v = vals.get(bid)
            db[label] = (sorted(v) if multi else (num(v[0]) if dtype in ('int', 'float', 'rating') else v[0])) if v else None
            raw = meta.get(f'calibre:user_metadata:{label}')
            ov = json.loads(raw).get('#value#') if raw else None
            if multi:
                ov = sorted(ov) if ov else None
            elif dtype in ('int', 'float', 'rating'):
                ov = num(ov)
            elif dtype == 'bool' and ov is not None:
                ov = int(bool(ov))
            opf[label] = ov if ov not in ('', []) else None
        bad = [k for k in db if (fields is None or k in fields) and db[k] != opf[k]]
        if bad:
            for k in bad:
                diffs[k].append((bid, db[k], opf[k]))
        else:
            ok += 1

    n = len(books)
    div = n - ok - missing - unreadable
    print(f'livres={n} concordants={ok} divergents={div} opf_manquants={missing} opf_illisibles={unreadable}')
    for k, lst in sorted(diffs.items(), key=lambda x: -len(x[1])):
        print(f'\n{k} : {len(lst)} écarts')
        for bid, dv, ov in lst[:a.show]:
            print(f'  id {bid:<6} base={str(dv)[:60]!s:<60} opf={str(ov)[:60]}')
    sys.exit(0 if div == 0 and missing == 0 and unreadable == 0 else 1)


if __name__ == '__main__':
    main()
