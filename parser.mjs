export function money(value){
  if(value===null||value===undefined||value==='')return null;
  let s=String(value).replace(/[^\d.,()\-]/g,'');let negative=s.startsWith('(')&&s.endsWith(')');s=s.replace(/[()]/g,'');
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replaceAll('.','').replace(',','.'):s.replaceAll(',','');
  else if(s.includes(','))s=s.split(',').at(-1).length<=2?s.replace(',','.'):s.replaceAll(',','');
  let n=Number(s);return s&&Number.isFinite(n)?(negative?-n:n):null;
}
const cents=n=>Math.round((n+Number.EPSILON)*100);
const fixed=n=>n===null?'':(cents(n)/100).toFixed(2);
const field=(text,p)=>(text.match(new RegExp(p,'im'))?.[1]||'').trim();
export function parseInvoice(text,file){
  const r={source_file:file,vendor:field(text,'^(?:Vendor|Supplier|Issued by)\\s*:\\s*(.+)$'),invoice_number:field(text,'^(?:Invoice(?:\\s*(?:number|no\\.?|#))?|Document ID)\\s*:\\s*(.+)$'),date:field(text,'^(?:Invoice date|Date|Issued on)\\s*:\\s*(.+)$'),currency:field(text,'^Currency\\s*:\\s*([A-Z]{3})\\s*$'),items:[],extraction_method:'local browser',review_reasons:[]};
  if(!text.trim()){r.review_reasons.push('No PDF text: scan needs AI vision or OCR');r.review_required=true;return r;}
  for(const key of ['vendor','invoice_number','date','currency'])if(!r[key])r.review_reasons.push('Missing '+key);
  if(r.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||Number.isNaN(Date.parse(r.date)))){r.review_reasons.push('Date needs an unambiguous YYYY-MM-DD value');r.date='';}
  for(const line of text.split('\n')){
    let parts=null;
    if(line.includes('|')){let bits=line.split('|').map(x=>x.trim());if(bits.length===4&&/^[-\d]/.test(bits[1]))parts=bits;}
    if(!parts){const m=line.match(/^([\d.,]+)\s*x\s+(.+?)\s*@\s*([\d.,]+)\s*=\s*([\d.,]+)\s*$/);if(m)parts=[m[2],m[1],m[3],m[4]];}
    if(!parts){const m=line.match(/^(.+?)\s*;\s*Qty:\s*([\d.,]+)\s*;\s*Price:\s*([\d.,]+)\s*;\s*Amount:\s*([\d.,]+)\s*$/i);if(m)parts=m.slice(1);}
    if(parts){const item={description:parts[0],quantity:money(parts[1]),unit_price:money(parts[2]),amount:money(parts[3])};r.items.push(item);if(Object.values(item).some(x=>x===null))r.review_reasons.push('Line '+r.items.length+': missing amount');else if(Math.abs(cents(item.quantity*item.unit_price)-cents(item.amount))>1)r.review_reasons.push('Line '+r.items.length+': quantity × unit price differs from printed amount');}
  }
  if(!r.items.length)r.review_reasons.push('No line items extracted');
  for(const [key,labels] of [['tax','Tax|VAT'],['shipping','Shipping|Freight'],['discount','Discount'],['invoice_total','Grand total|Invoice total|Total due|Total']]){
    const raw=field(text,'^(?:'+labels+')\\s*:\\s*(.+)$');r[key]=raw?money(raw):(key==='invoice_total'?null:0);if(r[key]===null)r.review_reasons.push('Missing/invalid '+key);
  }
  r.items_sum=r.items.length&&r.items.every(x=>x.amount!==null)?r.items.reduce((n,x)=>n+cents(x.amount),0)/100:null;
  r.expected_total=r.items_sum!==null&&['tax','shipping','discount'].every(k=>r[k]!==null)?(cents(r.items_sum)+cents(r.tax)+cents(r.shipping)-cents(r.discount))/100:null;
  r.difference=r.expected_total!==null&&r.invoice_total!==null?(cents(r.invoice_total)-cents(r.expected_total))/100:null;
  if(r.difference!==null&&Math.abs(cents(r.difference))>1)r.review_reasons.push('Printed total differs from items + tax + shipping − discount');
  r.review_required=r.review_reasons.length>0;return r;
}
export function markDuplicates(records){
 const groups=new Map();for(const r of records){if(r.vendor&&r.invoice_number){const key=[r.vendor.toLowerCase(),r.invoice_number.toLowerCase(),r.date].join('|');groups.set(key,[...(groups.get(key)||[]),r]);}}
 for(const group of groups.values())if(group.length>1)for(const r of group){r.review_required=true;r.review_reasons.push('Duplicate vendor/invoice/date: kept for review');}
}
export function makeCSV(records){
 const fields=['source_file','vendor','invoice_number','date','currency','line_number','description','quantity','unit_price','line_amount','items_sum','tax','shipping','discount','expected_total','invoice_total','difference','review_required','review_reasons','extraction_method'];
 const amountKeys=new Set(['quantity','unit_price','line_amount','items_sum','tax','shipping','discount','expected_total','invoice_total','difference']);
 const quote=(v,key)=>{let s=v==null?'':String(v);if(!amountKeys.has(key)&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const lines=[fields.map(k=>quote(k,k)).join(',')];for(const r of records){for(const [idx,line]of(r.items.length?r.items:[{}]).entries()){const row={...r,line_number:r.items.length?idx+1:'',description:line.description||'',quantity:line.quantity,unit_price:line.unit_price,line_amount:line.amount,review_required:r.review_required?'YES':'NO',review_reasons:r.review_reasons.join('; ')};lines.push(fields.map(k=>quote(amountKeys.has(k)?(row[k]==null?'':fixed(Number(row[k]))):row[k],k)).join(','));}}return '\ufeff'+lines.join('\r\n');
}
