from pathlib import Path
import json, sys, unittest
from decimal import Decimal
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import extract_invoices as engine

class ExtractionTests(unittest.TestCase):
    def test_all_pdf_fixtures(self):
        for e in json.loads((ROOT/'tests/expected.json').read_text()):
            with self.subTest(file=e['source_file']):
                r=engine.process_file(ROOT/'inputs'/e['source_file'])
                self.assertEqual(r['review_required'],e['review_required'])
                if e['source_file']!='10_scanned.pdf':
                    for k in ['vendor','invoice_number','date','currency','invoice_total']: self.assertEqual(r[k],e[k])
    def test_specific_differences(self):
        wrong=engine.process_file(ROOT/'inputs/07_total_mismatch.pdf')
        self.assertEqual(wrong['difference'],'7.00')
        self.assertIn('quantity',engine.process_file(ROOT/'inputs/08_line_mismatch.pdf')['review_reasons'])
        self.assertIn('scan',engine.process_file(ROOT/'inputs/10_scanned.pdf')['review_reasons'])
    def test_decimal_formats(self):
        for raw,target in [('1,300.00','1300.00'),('1.300,00','1300.00'),('25,50','25.50'),('(10.00)','-10.00')]: self.assertEqual(engine.number(raw),Decimal(target))
    def test_duplicates_preserved_and_marked(self):
        records=[engine.process_file(ROOT/'inputs/01_standard.pdf') for _ in range(2)]
        engine.mark_duplicates(records)
        self.assertEqual(len(records),2); self.assertTrue(all(r['review_required'] for r in records))
    def test_ai_requires_explicit_config(self):
        with patch.dict('os.environ',{},clear=True):
            with self.assertRaisesRegex(ValueError,'No file was sent'): engine.ai_extract(ROOT/'inputs/01_standard.pdf','')
    def test_missing_amount_is_not_zero(self):
        data=engine.local_extract('Vendor: Test\nInvoice number: T1\nDate: 2026-10-05\nCurrency: USD\nItem | 2 | 10.00 | 20.00')
        r=engine.validate(data,'unknown.pdf','local')
        self.assertEqual(r['invoice_total'],''); self.assertEqual(r['difference'],''); self.assertTrue(r['review_required'])
    def test_bad_pdf_does_not_abort_batch(self):
        path=ROOT/'tests/bad.pdf'; path.write_bytes(b'bad document')
        try: self.assertTrue(engine.process_file(path)['review_required'])
        finally: path.unlink()

if __name__=='__main__': unittest.main()
