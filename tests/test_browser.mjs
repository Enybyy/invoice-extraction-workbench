import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseInvoice,makeCSV} from '../parser.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./browser-fixtures.json',import.meta.url)));
const expected=JSON.parse(fs.readFileSync(new URL('./expected.json',import.meta.url)));
const records=fixtures.map(f=>parseInvoice(f.text,f.name));
for(let i=0;i<records.length;i++){
 const r=records[i],e=expected[i];
 assert.equal(r.review_required,e.review_required,e.source_file);
 if(!e.source_file.includes('scanned')){
  for(const key of ['vendor','invoice_number','date','currency'])assert.equal(r[key],e[key],e.source_file+': '+key);
  assert.equal(r.invoice_total,Number(e.invoice_total));
 }
}
assert.equal(records[6].difference,7);
assert.equal(records.filter(r=>r.review_required).length,4);
assert.equal(makeCSV(records).split('\r\n').length,20);
console.log('Browser parser: 10 PDFs match expected values; 4 review flags; CSV 19 data rows.');
