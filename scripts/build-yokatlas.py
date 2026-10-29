#!/usr/bin/env python3
"""Build a bounded public catalogue from official YOK Atlas JSON snapshots.

No student records, credentials, or notebook data are inputs. Cached source responses
stay outside the repository. The output is an ordinary static website asset.
"""
import argparse
import collections
import datetime
import hashlib
import json
import math
from pathlib import Path
import time
import urllib.error
import urllib.request

BASE = 'https://yokatlas.yok.gov.tr'
CITIES = {6: 'Ankara', 26: 'Eskişehir', 34: 'İstanbul', 35: 'İzmir', 41: 'Kocaeli'}
FIELDS = {'SAY', 'EA', 'SÖZ'}
NETS = {
    'tytTrkNet': ('tr', 40), 'tytSosNet': ('sos', 20),
    'tytMatNet': ('mat', 40), 'tytFenNet': ('fen', 20),
    'aytMatNet': ('amat', 40), 'aytFizNet': ('fiz', 14),
    'aytKimNet': ('kim', 13), 'aytBioNet': ('bio', 13),
    'aytTdeNet': ('edb', 24), 'aytTrh1Net': ('tar1', 10),
    'aytCog1Net': ('cog1', 6), 'aytTrh2Net': ('tar2', 11),
    'aytCog2Net': ('cog2', 11), 'aytFelNet': ('fel', 12), 'aytDinNet': ('din', 6),
}
REQUIRED = {
    'SAY': ['tr', 'sos', 'mat', 'fen', 'amat', 'fiz', 'kim', 'bio'],
    'EA': ['tr', 'sos', 'mat', 'fen', 'amat', 'edb', 'tar1', 'cog1'],
    'SÖZ': ['tr', 'sos', 'mat', 'fen', 'edb', 'tar1', 'cog1', 'tar2', 'cog2', 'fel', 'din'],
}


def number(value, lo=None, hi=None):
    if value in (None, '') or isinstance(value, bool):
        return None
    try:
        n = float(value)
    except (ValueError, TypeError):
        return None
    if not math.isfinite(n) or (lo is not None and n < lo) or (hi is not None and n > hi):
        return None
    return int(n) if n.is_integer() else n


def text(value, limit=250):
    s = ' '.join(str(value or '').split())
    if '\ufffd' in s or len(s) > limit:
        raise ValueError('Invalid source text')
    return s


def in_scope(p):
    # Physical programme location, never a university's headquarters as a fallback.
    if p.get('birimTuruId') != 46 or p.get('puanTuru') not in FIELDS or p.get('ilKodu') not in CITIES:
        return False
    kind = p.get('universiteTuru')
    if kind == 'DEVLET':
        return True
    return kind == 'VAKIF' and p.get('bursOraniId') == 158 and text(p.get('bursOraniAdi')).casefold() == 'burslu'


def fetch_page(path, filters, page, cache, refresh=False):
    payload = {'filters': filters, 'page': page, 'size': 1000}
    if path == 'tercih-kilavuz/search':
        payload.update(sortBy='basariSirasi', direction='ASC')
    body = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode('utf-8')
    digest = hashlib.sha256(path.encode() + body).hexdigest()
    dest = cache / (digest + '.json')
    if dest.exists() and not refresh:
        return json.loads(dest.read_text(encoding='utf-8'))
    request = urllib.request.Request(BASE + '/api/' + path, data=body, headers={
        'Content-Type': 'application/json', 'User-Agent': 'YKS-public-catalog/1.0',
    })
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read(40000001)
            if len(raw) > 40000000:
                raise ValueError('Source page exceeds 40 MB')
            data = json.loads(raw.decode('utf-8', errors='strict'))
            dest.write_bytes(raw)
            time.sleep(.15)
            return data
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError('Source request failed')


def fetch_all(path, filters, cache, refresh=False):
    rows, total = [], None
    for page in range(100):
        data = fetch_page(path, filters, page, cache, refresh)
        if not isinstance(data.get('content'), list) or data.get('number') != page:
            raise ValueError('Unexpected source pagination')
        if total is None:
            total = data['totalElements']
        if data['totalElements'] != total or total > 100000:
            raise ValueError('Source changed during pagination or exceeds bound')
        rows.extend(data['content'])
        print(path, page + 1, '/', data['totalPages'], flush=True)
        if data.get('last'):
            if len(rows) != total:
                raise ValueError('Incomplete source result')
            return rows
    raise ValueError('Too many pages')


def build(programs, nets, reference_year):
    selected, seen, net_index, counts = [], set(), {}, collections.Counter()
    years = {p.get('yil') for p in programs}
    if len(years) != 1 or not isinstance(next(iter(years)), int):
        raise ValueError('Catalogue must use one explicit year')
    catalog_year = next(iter(years))
    if not isinstance(reference_year, int) or isinstance(reference_year, bool) or not catalog_year - 3 <= reference_year <= catalog_year:
        raise ValueError('Reference year must be within three years of the catalogue')
    for n in nets:
        if n.get('yil') != reference_year:
            raise ValueError('Unexpected net reference year')
        if n.get('puanTuru') not in FIELDS:
            continue
        # Extra vocational coefficients and reduced-OBP routes are different populations.
        if number(n.get('katsayi')) != .12:
            counts['excludedOtherCoefficient'] += 1
            continue
        k = (n['kilavuzKodu'], n['puanTuru'])
        if k in net_index and net_index[k] != n:
            raise ValueError('Conflicting net records for programme ' + str(k))
        net_index[k] = n
    for p in programs:
        if not in_scope(p):
            counts['excludedScope'] += 1
            continue
        code = p.get('kilavuzKodu')
        if not isinstance(code, int) or not 100000000 <= code <= 999999999 or code in seen:
            raise ValueError('Invalid or duplicate programme code')
        seen.add(code)
        # Nationality-restricted quotas are separate from ordinary admission.
        if 'KKTC UYRUKLU' in text(p['birimAdi']).upper():
            counts['excludedNationalityQuota'] += 1
            continue
        # A programme in a foreign campus must not inherit the home university's city.
        label = (text(p['birimAdi']) + ' ' + text(p.get('fymkAdi')) + ' ' + text(p.get('universiteAdi'))).upper()
        if any(s in label for s in ('LEFKOŞA', 'LEFKOSA', 'KIBRIS', 'KKTC', 'GİRNE', 'GIRNE', 'GAZİMAĞUSA', 'GAZIMAGUSA', 'CYPRUS', 'NICOSIA', 'FAMAGUSTA', 'KYRENIA')):
            counts['excludedForeignCampus'] += 1
            continue
        if p.get('fymkIlKodu') not in (None, p['ilKodu']) or p.get('uniIlKodu') not in CITIES:
            raise ValueError('Programme location needs review: ' + str(code))
        suffix = '' if reference_year == catalog_year else str(catalog_year - reference_year)
        points = number(p.get('minPuan' + suffix), .01, 600)
        rank = number(p.get('basariSirasi' + suffix), 1, 10000000)
        record = {
            'id': str(code), 'university': text(p['universiteAdi']), 'program': text(p['birimAdi']),
            'group': text(p.get('birimGrupAdi')), 'field': p['puanTuru'],
            'city': p['ilKodu'], 'district': text(p.get('ilceAdi')), 'type': p['universiteTuru'],
            'scholarship': 100 if p['universiteTuru'] == 'VAKIF' else None,
            'language': text(p.get('ogrenimDiliAdi')), 'teaching': text(p.get('ogrenimTuruAdi')),
            'years': number(p.get('ogrenimSuresi'), 1, 8), 'faculty': text(p.get('fymkAdi')),
            'rank': rank, 'points': points, 'nets': None,
        }
        n = net_index.get((code, p['puanTuru']))
        if n:
            if n.get('universiteId') != p.get('universiteId'):
                raise ValueError('University identity differs for ' + str(code))
            values = {short: number(n.get(raw), -maximum / 4, maximum) for raw, (short, maximum) in NETS.items() if short in REQUIRED[p['puanTuru']]}
            if any(v is None for v in values.values()):
                counts['incompleteNetProfile'] += 1
            else:
                net_points = number(n.get('tabanPuan'), .01, 600)
                # A changed code/history must not label a different year's rank as this profile's.
                if points is not None and net_points is not None and abs(points - net_points) > .011:
                    counts['historicalPointsMismatch'] += 1
                    record['rank'] = record['points'] = None
                record['nets'] = {'values': values, 'obp': number(n.get('obp'), 0, 500), 'coefficient': .12, 'points': net_points}
                counts['withNets'] += 1
        else:
            counts['withoutNetProfile'] += 1
        selected.append(record)
    if not selected:
        raise ValueError('No in-scope programmes')
    selected.sort(key=lambda p: (p['field'], p['city'], p['university'], p['program'], p['id']))
    return {
        'schema': 1, 'catalogYear': catalog_year, 'referenceYear': reference_year,
        'retrieved': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'source': BASE, 'cities': CITIES, 'scope': 'LISANS; SAY/EA/SÖZ; DEVLET or VAKIF bursOraniId=158; physical programme city',
        'audit': dict(counts), 'programs': selected,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', required=True, type=Path)
    parser.add_argument('--output', default='data/yokatlas.json', type=Path)
    parser.add_argument('--reference-year', default=2025, type=int)
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    programs = fetch_all('tercih-kilavuz/search', {'ilKodu': sorted(CITIES), 'birimTuruId': 46}, args.cache_dir, args.refresh)
    nets = fetch_all('netler/search', {'birimTuruId': 46, 'yil': str(args.reference_year)}, args.cache_dir, args.refresh)
    result = build(programs, nets, args.reference_year)
    encoded = json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n'
    if len(encoded.encode('utf-8')) > 5000000:
        raise ValueError('Static catalogue exceeds 5 MB')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    pending = args.output.with_suffix('.tmp')
    pending.write_text(encoded, encoding='utf-8')
    pending.replace(args.output)
    print(json.dumps({'programs': len(result['programs']), 'bytes': len(encoded.encode('utf-8')), 'audit': result['audit']}, ensure_ascii=True))


if __name__ == '__main__':
    main()
