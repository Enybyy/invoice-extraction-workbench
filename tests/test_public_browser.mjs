import fs from 'node:fs';
import assert from 'node:assert/strict';
import {extractPublic,toCSV} from '../public_parser.mjs';
const profiles=JSON.parse(fs.readFileSync(new URL('../public_profiles.json',import.meta.url)));
const texts=JSON.parse(fs.readFileSync(new URL('./public-browser-text.json',import.meta.url)));
const expected=JSON.parse(fs.readFileSync(new URL('../outputs/public-invoices/results.json',import.meta.url)));
const records=texts.map((r,i)=>extractPublic(r.text,r.file,profiles,expected[i].source_pages));
for(let i=0;i<records.length;i++){
 const r=records[i],e=expected[i];
 for(const key of ['vendor','customer','invoice_number','date','order_date','due_date','purchase_order','currency'])assert.equal(r[key]||'',e[key]||'',r.source_file+': '+key);
 assert.equal(r.items.length,e.items.length,r.source_file);
 for(const key of ['items_sum','tax','shipping','discount','expected_total','invoice_total','difference'])assert.equal(r[key],Number(e[key]),r.source_file+': '+key);
 for(let n=0;n<r.items.length;n++){
  assert.equal(r.items[n].description,e.items[n].description);
  assert.equal(r.items[n].source_page,e.items[n].source_page);
  assert.equal(r.items[n].amount,Number(e.items[n].amount));
  for(const key of ['quantity','unit_price'])assert.equal(r.items[n][key],e.items[n][key]===null?null:Number(e.items[n][key]));
 }
}
assert.equal(toCSV(records).split('\r\n').length,40);
assert.ok(records[2].items[0].description.includes('sample description'));
console.log('Public browser extraction matches Python: 5 PDFs, 39 items, both pages, all totals and source identifiers.');
