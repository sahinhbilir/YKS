import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('yokatlas_builder', ROOT / 'scripts' / 'build-yokatlas.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def program(code=100000001, **changes):
    row = dict(yil=2026, kilavuzKodu=code, birimTuruId=46, puanTuru='SAY',
               ilKodu=34, fymkIlKodu=34, uniIlKodu=34, universiteTuru='DEVLET',
               universiteId=123, universiteAdi='Hayali University', birimAdi='Invented Programme',
               fymkAdi='Invented Faculty', minPuan=470, basariSirasi=100,
               minPuan1=400, basariSirasi1=1200)
    row.update(changes)
    return row


def net(code=100000001, **changes):
    row = dict(yil=2025, kilavuzKodu=code, puanTuru='SAY', katsayi=.12,
               universiteId=123, tabanPuan=400, obp=450)
    for raw in builder.NETS:
        row[raw] = 1
    row.update(changes)
    return row


class BuilderTest(unittest.TestCase):
    def test_scope_filters_degree_fields_cities_and_scholarships(self):
        for field in ('SAY', 'EA', 'SÖZ'):
            for city in (6, 26, 34, 35, 41):
                self.assertTrue(builder.in_scope(program(puanTuru=field, ilKodu=city)))
        for changes in (dict(birimTuruId=45), dict(puanTuru='DİL'), dict(ilKodu=90),
                        dict(ilKodu=1, uniIlKodu=34), dict(universiteTuru='VAKIF', bursOraniId=156, bursOraniAdi='%50 İndirimli'),
                        dict(universiteTuru='VAKIF', bursOraniId=158, bursOraniAdi='Ücretli')):
            self.assertFalse(builder.in_scope(program(**changes)))
        self.assertTrue(builder.in_scope(program(universiteTuru='VAKIF', bursOraniId=158, bursOraniAdi='Burslu')))

    def test_foreign_campus_and_mismatched_faculty_city(self):
        rows = [program(), program(100000002, birimAdi='Invented Programme (KKTC)'), program(100000003, birimAdi='Invented Programme (KKTC Uyruklu)')]
        result = builder.build(rows, [], 2025)
        self.assertEqual([x['id'] for x in result['programs']], ['100000001'])
        self.assertEqual(result['audit']['excludedForeignCampus'], 1)
        self.assertEqual(result['audit']['excludedNationalityQuota'], 1)
        with self.assertRaises(ValueError):
            builder.build([program(fymkIlKodu=6)], [], 2025)

    def test_foreign_english_names_and_reference_year_bounds(self):
        for name in ('Cyprus', 'Nicosia', 'Famagusta', 'Kyrenia'):
            result = builder.build([program(), program(100000002, universiteAdi=name)], [], 2025)
            self.assertEqual(len(result['programs']), 1)
        for year in (2022, 2027, True):
            with self.assertRaises(ValueError):
                builder.build([program()], [], year)
        self.assertEqual(builder.build([program()], [], 2023)['referenceYear'], 2023)

    def test_join_checks_code_field_year_and_university(self):
        for row in (net(code=100000002), net(puanTuru='EA')):
            self.assertIsNone(builder.build([program()], [row], 2025)['programs'][0]['nets'])
        with self.assertRaises(ValueError):
            builder.build([program()], [net(yil=2024)], 2025)
        with self.assertRaises(ValueError):
            builder.build([program()], [net(universiteId=999)], 2025)
        self.assertIsNotNone(builder.build([program()], [net()], 2025)['programs'][0]['nets'])

    def test_coefficient_and_duplicate_conflicts(self):
        self.assertIsNone(builder.build([program()], [net(katsayi=.18)], 2025)['programs'][0]['nets'])
        result = builder.build([program()], [net(katsayi=.18), net(), copy.deepcopy(net())], 2025)
        self.assertEqual(result['programs'][0]['nets']['coefficient'], .12)
        with self.assertRaises(ValueError):
            builder.build([program()], [net(), net(obp=400)], 2025)

    def test_missing_and_invalid_numeric_data_are_not_zero(self):
        for bad in (None, '', 'not a number', float('nan'), float('inf'), True):
            self.assertIsNone(builder.number(bad))
        record = builder.build([program(minPuan1='invalid', basariSirasi1=0)], [net(tytTrkNet=None)], 2025)['programs'][0]
        self.assertIsNone(record['points'])
        self.assertIsNone(record['rank'])
        self.assertIsNone(record['nets'])
        self.assertEqual(builder.number(0), 0)

    def test_reference_year_and_historical_mismatch(self):
        row = builder.build([program()], [net()], 2025)['programs'][0]
        self.assertEqual((row['points'], row['rank']), (400, 1200))
        row = builder.build([program()], [], 2026)['programs'][0]
        self.assertEqual((row['points'], row['rank']), (470, 100))
        row = builder.build([program()], [net(tabanPuan=399)], 2025)['programs'][0]
        self.assertIsNone(row['points'])
        self.assertIsNone(row['rank'])
        self.assertEqual(row['nets']['points'], 399)


if __name__ == '__main__':
    unittest.main()
