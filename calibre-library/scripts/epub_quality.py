#!/usr/bin/env python3
"""Métriques de qualité et résidus d'un ou plusieurs EPUB. Lecture seule.

Usage :
  python3 epub_quality.py FICHIER.epub [...]            # tableau de métriques
  python3 epub_quality.py 657 1213 [--library P]        # EPUB de livres, par ids (ou --ids 657,1200-1213)
  python3 epub_quality.py --compare A.epub B.epub       # comparaison de deux exemplaires
  python3 epub_quality.py --compare 701 2462            # idem, par ids de livres (ou mélangé)
  python3 epub_quality.py --json …                      # sortie JSON (une ligne par fichier)

Les métriques sont pensées pour l'arbitrage par réparabilité (references/reparabilite.md) :
  niveau 3 : ocr_hyph (césures OCR « pouvaient- ils »), mojibake, xmlerr
  niveau 2 : apos% (apostrophes typographiques), nbsp% (espaces insécables avant ;:!?»)
  richesse : img (images), toc (entrées de sommaire)
  niveau 1 : empty_p (<p> vides), style (attributs style=), font (<font>)
Résidus (references/residus-acheteur.md) : seuls les NOMS des porteurs sont affichés,
jamais les valeurs qu'ils contiennent.
"""
import argparse
import collections
import hashlib
import html
import json
import os
import re
import sys
import zipfile
from xml.dom import minidom

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_config  # noqa: E402

FONT_EXT = re.compile(r'\.(ttf|otf|woff2?|eot)$', re.I)
FONT_ALGOS = {'http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC'}
IMG_EXT = re.compile(r'\.(jpe?g|png|gif|svg|webp)$', re.I)
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')
BUYER_WORDS = re.compile(r'(acheté par|purchased by|licensed to|licence accordée à|'
                         r'n° de commande|order (id|number)|transaction id)', re.I)


def classify_encryption(z):
    """'vide', 'polices' (obfuscation seule), 'polices?' (algorithme inhabituel) ou 'DRM'."""
    try:
        doc = z.read('META-INF/encryption.xml').decode('utf8', 'replace')
    except KeyError:
        return None
    uris = re.findall(r'<(?:\w+:)?CipherReference[^>]*URI="([^"]+)"', doc)
    algos = set(re.findall(r'<(?:\w+:)?EncryptionMethod[^>]*Algorithm="([^"]+)"', doc))
    if not uris:
        return 'vide'  # <encryption/> sans ressource : rien de chiffré
    if all(FONT_EXT.search(u) for u in uris) and algos <= FONT_ALGOS | {''}:
        return 'polices'
    if all(FONT_EXT.search(u) for u in uris):
        return 'polices?'  # polices seulement, algorithme inhabituel : à regarder
    return 'DRM'


def residues(z, deep=False):
    """Liste des porteurs d'identifiants d'acheteur ou de DRM trouvés dans l'archive."""
    names = z.namelist()
    base = {n.split('/')[-1]: n for n in names}
    found = []
    for n in names:
        leaf = n.split('/')[-1]
        if leaf.startswith('iTunesMetadata') and leaf.endswith('.plist'):
            found.append(f'acheteur:{n}')
        elif leaf == 'iTunesArtwork':
            found.append(f'apple-artwork:{n}')
    if 'META-INF/rights.xml' in names:
        found.append('acheteur:META-INF/rights.xml')
    if 'sinf.xml' in base:
        found.append(f'DRM:{base["sinf.xml"]}')
    enc = classify_encryption(z)
    if enc:
        found.append(f'encryption:{enc}')
    if deep:
        hits = collections.Counter()
        for n in names:
            if n.startswith('META-INF/') or n.endswith(('.opf', '.xhtml', '.html', '.htm', '.xml')):
                try:
                    t = z.read(n).decode('utf8', 'replace')
                except Exception:
                    continue
                if EMAIL.search(t):
                    hits['e-mail'] += 1
                if BUYER_WORDS.search(t):
                    hits['mention-achat'] += 1
        found += [f'à-vérifier:{k}×{v}' for k, v in hits.items()]
    return found


def content_docs(z, names):
    """Documents de texte : items XHTML du manifeste (qui peuvent s'appeler .xml)."""
    opf, o = None, ''
    try:
        c = z.read('META-INF/container.xml').decode('utf8', 'replace')
        opf = re.search(r'full-path="([^"]+)"', c).group(1)
        o = z.read(opf).decode('utf8', 'replace')
    except Exception:
        pass
    docs = []
    if o:
        root = os.path.dirname(opf)
        for item in re.findall(r'<(?:\w+:)?item\b[^>]*>', o):
            mt = re.search(r'media-type="([^"]+)"', item)
            href = re.search(r'href="([^"]+)"', item)
            if mt and href and mt.group(1) == 'application/xhtml+xml':
                p = os.path.normpath(os.path.join(root, html.unescape(href.group(1)))).replace('\\', '/')
                if p in names:
                    docs.append(p)
    if not docs:
        docs = [n for n in names if re.search(r'\.(x?html?|xml)$', n, re.I)
                and not n.startswith('META-INF/') and not n.endswith(('.opf', '.ncx'))]
    return opf, o, docs


def analyse(path, deep=False):
    try:
        z = zipfile.ZipFile(path)
    except Exception as e:
        return {'fichier': path, 'err': f'zip: {str(e)[:40]}'}
    with z:
        return _analyse(z, path, deep)


def _analyse(z, path, deep):
    names = z.namelist()
    r = {'fichier': path}
    opf, o, docs = content_docs(z, names)
    m = re.search(r'<package[^>]*version="([^"]+)"', o)
    r['v'] = m.group(1) if m else '?'
    r['cover'] = bool(re.search(r'name="cover"|properties="[^"]*cover-image', o))
    r['docs'] = len(docs)
    imgs = [n for n in names if IMG_EXT.search(n)]
    r['img'] = len(imgs)
    txt, raw, bad = [], [], 0
    for x in docs:
        d = z.read(x).decode('utf8', 'replace')
        raw.append(d)
        try:
            minidom.parseString(d.encode())
        except Exception:
            bad += 1
        body = re.sub(r'(?is)<head.*?</head>', '', d)
        # balises en ligne retirées sans espace : une ancre de pagination au milieu d'un
        # mot (com<a id="page_18"/>prenait) ne doit pas le couper en deux
        body = re.sub(r'(?i)</?(a|span|em|i|b|strong|small|font|u)\b[^>]*>', '', body)
        txt.append(html.unescape(re.sub(r'<[^>]+>', ' ', body)))
    t, rw = ' '.join(txt), ''.join(raw)
    words = t.split()
    r['xmlerr'] = bad
    r['mots'] = len(words)
    ap, aq = t.count('’'), t.count("'")
    r['apos%'] = round(100 * ap / (ap + aq)) if ap + aq else '-'
    nb, sp = len(re.findall(r'[  ][;:!?»]', t)), len(re.findall(r' [;:!?»]', t))
    r['nbsp%'] = round(100 * nb / (nb + sp)) if nb + sp else '-'
    toc = 0
    for x in names:
        if x.endswith('.ncx'):
            toc = max(toc, z.read(x).decode('utf8', 'replace').count('<navPoint'))
    for d in raw:
        if 'epub:type="toc"' in d:
            toc = max(toc, d.count('<li'))
    r['toc'] = toc
    r['mojibake'] = len(re.findall('Ã[©¨ ª®´§¢]|â€', t))
    r['ocr_hyph'] = len(re.findall(r'[a-zà-ÿ]{2,}- [a-zà-ÿ]{2,}', t))
    r['empty_p'] = len(re.findall(r'<p\b[^>]*>(\s|&nbsp;|&#160;| )*</p>', rw))
    r['style'] = rw.count('style="')
    r['font'] = len(re.findall(r'<font\b', rw, re.I))
    r['résidus'] = residues(z, deep) or '-'
    norm = ' '.join(re.sub(r'[^\w]+', ' ', t.lower()).split())
    r['empreinte'] = hashlib.md5(norm.encode()).hexdigest()[:12]
    r['_words'] = norm.split()
    r['_imgs'] = sorted(os.path.basename(n) for n in imgs)
    return r


def paths_for_ids(ids, library):
    """Chemins des EPUB existants pour ces ids ; les manquants sont signalés sur stderr."""
    cfg = lib_config.load(library)
    found = dict(lib_config.epub_paths(lib_config.connect_ro(cfg['library']), cfg['library'], ids))
    out = []
    for bid in ids:
        p = found.get(bid)
        if p is None:
            print(f'id {bid} : pas d\'EPUB en base', file=sys.stderr)
        elif not os.path.exists(p):
            print(f'id {bid} : EPUB déclaré mais absent du disque ({p})', file=sys.stderr)
        else:
            out.append(p)
    return out


def public(r):
    return {k: v for k, v in r.items() if not k.startswith('_')}


def compare(a, b):
    ra, rb = analyse(a), analyse(b)
    keys = [k for k in public(ra) if k != 'fichier']
    print(f"{'':<10} {'A':>24} {'B':>24}")
    print(f"{'fichier':<10} {os.path.basename(a)[:24]:>24} {os.path.basename(b)[:24]:>24}")
    for k in keys:
        print(f'{k:<10} {str(ra.get(k))[:24]:>24} {str(rb.get(k))[:24]:>24}')
    if 'err' in ra or 'err' in rb:
        return
    ca, cb = collections.Counter(ra['_words']), collections.Counter(rb['_words'])
    common = sum((ca & cb).values())
    denom = max(len(ra['_words']), len(rb['_words'])) or 1
    print(f"\nmots communs : {100 * common / denom:.1f} % du plus long "
          f"({'prose identique' if ra['empreinte'] == rb['empreinte'] else 'prose différente'})")
    ia, ib = set(ra['_imgs']), set(rb['_imgs'])
    if len(ia) == len(ib):
        print(f'images : {len(ia)} de chaque côté (noms différents ≠ images manquantes)')
        return
    if ia - ib:
        print(f'images seulement dans A ({len(ia - ib)}) : {sorted(ia - ib)[:10]}')
    if ib - ia:
        print(f'images seulement dans B ({len(ib - ia)}) : {sorted(ib - ia)[:10]}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('files', nargs='*')
    ap.add_argument('--ids', help='ids de livres, ex. 12,15-18')
    ap.add_argument('--library')
    ap.add_argument('--compare', nargs=2, metavar=('A', 'B'))
    ap.add_argument('--deep', action='store_true', help='cherche aussi e-mails et mentions d\'achat dans le texte')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    if a.compare:
        pair = []
        for x in a.compare:
            if x.isdigit():
                p = paths_for_ids([int(x)], a.library)
                if not p:
                    sys.exit(f'--compare : aucun EPUB exploitable pour l\'id {x}')
                x = p[0]
            pair.append(x)
        return compare(*pair)
    # un argument purement numérique est un id de livre, comme pour --compare
    files = [f for f in a.files if not f.isdigit()]
    ids = [int(f) for f in a.files if f.isdigit()]
    if a.ids:
        ids += lib_config.parse_ids(a.ids)
    if ids:
        files += paths_for_ids(ids, a.library)
    if not files:
        ap.error('aucun fichier')
    for p in files:
        r = public(analyse(p, a.deep))
        if a.json:
            print(json.dumps(r, ensure_ascii=False))
        else:
            name = os.path.basename(r.pop('fichier'))[:40]
            print(name.ljust(40), ' '.join(f'{k}={v}' for k, v in r.items() if k != 'empreinte'))


if __name__ == '__main__':
    main()
