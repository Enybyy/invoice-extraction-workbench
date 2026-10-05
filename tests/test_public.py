from pathlib import Path
import sys,json,unittest,csv
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import extract_invoices as engine

class PublicInvoiceTests(unittest.TestCase):
    def test_five_downloaded_pdfs(self):
        expected=[('01_office_supply.pdf',7,'527.45','-18.00'),('02_joinery.pdf',5,'1635.95','0.00'),('03_services.pdf',1,'93.50','0.00'),('04_distribution.pdf',25,'1383.13','0.00'),('05_university.pdf',1,'440.00','0.00')]
        for name,items,total,difference in expected:
            with self.subTest(file=name):
                r=engine.process_file(ROOT/'inputs'/name)
                self.assertEqual(len(r['items']),items)
                self.assertEqual(r['invoice_total'],total)
                self.assertEqual(r['difference'],difference)
    def test_two_pages_and_missing_invoice_identity(self):
        r=engine.process_file(ROOT/'inputs/04_distribution.pdf')
        self.assertEqual(r['source_pages'],2)
        self.assertEqual(sum(x['source_page']==2 for x in r['items']),4)
        self.assertEqual(r['invoice_number'],'');self.assertEqual(r['date'],'')
        self.assertEqual(r['purchase_order'],'11077');self.assertEqual(r['order_date'],'2019-01-06')
        self.assertEqual(r['currency'],'')
    def test_discount_preserves_source_arithmetic(self):
        r=engine.process_file(ROOT/'inputs/02_joinery.pdf')
        self.assertEqual(r['items_sum'],'1830.00');self.assertEqual(r['discount'],'457.50')
        self.assertEqual(r['shipping'],'25.00');self.assertEqual(r['tax'],'238.45')
    def test_source_placeholders_are_not_invented(self):
        r=engine.process_file(ROOT/'inputs/05_university.pdf')
        self.assertEqual(r['vendor'],'');self.assertEqual(r['date'],'')
        self.assertIsNone(r['items'][0]['quantity']);self.assertIsNone(r['items'][0]['unit_price'])
        self.assertEqual(r['due_date'],'2021-09-30')
    def test_csv_keeps_all_39_items_and_pages(self):
        records=[engine.process_file(p) for p in sorted((ROOT/'inputs').glob('*.pdf'))]
        rows=list(engine.csv_rows(records));self.assertEqual(len(rows),39)
        self.assertEqual(sum(row['source_page']==2 for row in rows),4)

if __name__=='__main__':unittest.main()
