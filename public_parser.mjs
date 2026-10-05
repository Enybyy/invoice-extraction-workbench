export const csvFields=['source_file','source_page','vendor','customer','invoice_number','date','raw_date','order_date','due_date','purchase_order','sales_order','shipment_date','delivery_reference','customer_id','shipping_method','currency','line_number','sku','description','unit','quantity','unit_price','line_amount','printed_subtotal','items_sum','tax','shipping','discount','expected_total','invoice_total','difference','payment_terms','review_required','review_reasons','source_notes','source_profile','source_pages','extraction_method'];
const cents=x=>Math.round((x+Number.EPSILON)*100);
const numeric=x=>x===null||x===undefined||x===''?null:Number(String(x).replaceAll(',',''));
const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
function date(value,style){
 if(!value)return '';let y,m,d;
 if(style==='iso'){[y,m,d]=value.split('-').map(Number);}
 if(style==='mdy-short'){[m,d,y]=value.split('-').map(Number);y+=y>=69?1900:2000;}
 if(style==='dmy'){[d,m,y]=value.split('/').map(Number);}
 if(style==='long'){const a=value.replace(',','').split(' ');m=months.indexOf(a[0].toLowerCase())+1;d=Number(a[1]);y=Number(a[2]);}
 if(style==='short-long'){const a=value.split(' ');d=Number(a[0]);m=months.findIndex(v=>v.startsWith(a[1].toLowerCase()))+1;y=Number(a[2]);}
 if(!y||!m||!d)return '';const dt=new Date(Date.UTC(y,m-1,d));if(dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return '';
 return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function extractPublic(text,file,profiles,pages=1){
 const p=profiles.find(p=>p.match.every(s=>text.toLowerCase().includes(s.toLowerCase())));
 if(!p)return null;
 const clean=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join('\n');
 const r={vendor:'',invoice_number:'',date:'',currency:p.currency,currency_symbol:p.symbol,tax:0,shipping:0,discount:0,invoice_total:null,items:[],review_reasons:[],source_notes:[],source_file:file,source_profile:p.name,source_pages:pages,extraction_method:'local browser'};
 for(const [key,pattern]of Object.entries(p.fields)){
  const value=clean.match(new RegExp(pattern,'im'))?.[1]?.trim()||'';
  r[key==='total'?'invoice_total':key]=['total','tax','shipping','printed_subtotal','net_after_discount'].includes(key)?numeric(value):value;
 }
 r.date=date(r.raw_date,p.date_format);
 for(const key of ['due_date','order_date','shipment_date'])if(r[key])r[key]=date(r[key],p.date_format)||r[key];
 for(const [pageIndex,page]of text.split('\f').entries()){
  const lines=page.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  for(const [i,line]of lines.entries()){
   let m=line.match(new RegExp(p.row,'i')),fields=p.row_fields,sparse=false;
   if(!m&&p.row_without_description){m=line.match(new RegExp(p.row_without_description,'i'));fields=p.sparse_row_fields;sparse=true;}
   if(!m)continue;
   const item=Object.fromEntries(fields.map((key,n)=>[key,m[n+1]||'']));
   if(sparse)item.description=lines[i-1]||'';
   if(p.description_from_attributes)item.description=[item.sku,item.orientation,item.attributes].filter(Boolean).join(' / ');
   if(p.continuation&&lines[i+1]?.startsWith('This is '))item.description+=' / '+lines[i+1];
   for(const key of ['quantity','unit_price','amount'])item[key]=numeric(item[key]);
   item.source_page=pageIndex+1;item.unit||='';r.items.push(item);
  }
 }
 if(p.id==='joinery'&&r.printed_subtotal!==null&&r.net_after_discount!==null){r.discount=(cents(r.printed_subtotal)-cents(r.net_after_discount))/100;r.source_notes.push('Discount calculated from printed gross total minus printed net after discount. Printed VAT is retained; source describes a settlement-discount tax basis.');}
 if(p.id==='distribution')r.source_notes.push('Order ID and order date are separate fields; the source does not print an invoice number, invoice date or currency.');
 if(p.id==='university')r.source_notes.push('Source contains supplier/date placeholders and amount-only line items; quantities and unit prices remain empty.');
 if(p.currency==='$')r.source_notes.push('Dollar symbol is printed, but no ISO currency code; currency remains $ for review.');
 for(const key of ['vendor','invoice_number','date','currency'])if(!r[key])r.review_reasons.push('Missing '+key);
 if(r.currency&&!/^[A-Z]{3}$/.test(r.currency))r.review_reasons.push('ISO currency code not printed');
 for(const [i,item]of r.items.entries()){
  for(const key of ['quantity','unit_price','amount'])if(item[key]===null)r.review_reasons.push(`Line ${i+1}: missing ${key}`);
  if(['quantity','unit_price','amount'].every(k=>item[k]!==null)&&Math.abs(cents(item.quantity*item.unit_price)-cents(item.amount))>1)r.review_reasons.push(`Line ${i+1}: quantity × unit price differs from printed amount`);
 }
 if(!r.items.length)r.review_reasons.push('No line items extracted');
 for(const key of ['tax','shipping','discount','invoice_total'])if(r[key]===null)r.review_reasons.push('Missing '+key);
 r.items_sum=r.items.length&&r.items.every(v=>v.amount!==null)?r.items.reduce((sum,v)=>sum+cents(v.amount),0)/100:null;
 r.expected_total=r.items_sum!==null&&['tax','shipping','discount'].every(k=>r[k]!==null)?(cents(r.items_sum)+cents(r.tax)+cents(r.shipping)-cents(r.discount))/100:null;
 r.difference=r.expected_total!==null&&r.invoice_total!==null?(cents(r.invoice_total)-cents(r.expected_total))/100:null;
 if(r.difference!==null&&Math.abs(cents(r.difference))>1)r.review_reasons.push('Printed total differs from items + tax + shipping − discount');
 r.review_required=Boolean(r.review_reasons.length);return r;
}
export function toCSV(records){
 const numericKeys=new Set(['quantity','unit_price','line_amount','printed_subtotal','items_sum','tax','shipping','discount','expected_total','invoice_total','difference']);
 const quote=(value,key)=>{let s=value===null||value===undefined?'':Array.isArray(value)?value.join('; '):String(value);if(!numericKeys.has(key)&&/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const output=[csvFields.map(v=>quote(v,v)).join(',')];
 for(const r of records)for(const [index,item]of(r.items.length?r.items:[{}]).entries()){
  const row={...r,...item,line_number:r.items.length?index+1:'',line_amount:item.amount,review_required:r.review_required?'YES':'NO'};
  output.push(csvFields.map(k=>quote(numericKeys.has(k)&&row[k]!==null&&row[k]!==undefined&&row[k]!==''?Number(row[k]).toFixed(2):row[k],k)).join(','));
 }
 return '\ufeff'+output.join('\r\n');
}
