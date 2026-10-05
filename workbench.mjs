import * as pdfjs from './vendor/pdf.min.mjs';
import {extractPublic,toCSV} from './public_parser.mjs';
import {parseInvoice,markDuplicates} from './parser.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n===null||n===undefined||n===''?'—':Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const value=v=>v===null||v===undefined||v===''?'Not printed / not extracted':String(v);
let manifest=[],profiles=[],documents=[],records=[],selected=0,pageNumber=1,renderJob=null;
async function fetchFile(source){const response=await fetch('inputs/'+source.file);if(!response.ok)throw new Error('Could not load '+source.file);return {name:source.file,bytes:new Uint8Array(await response.arrayBuffer()),source};}
async function readPDF(bytes){
 if(bytes.length>20*1024*1024)throw new Error('PDF exceeds 20 MB');
 const doc=await pdfjs.getDocument({data:bytes.slice()}).promise;if(doc.numPages>30)throw new Error('PDF exceeds 30 pages');
 const pages=[];
 for(let n=1;n<=doc.numPages;n++){
  const page=await doc.getPage(n),content=await page.getTextContent(),groups=[];
  for(const item of content.items){if(!('str'in item)||!item.str.trim())continue;const y=item.transform[5];let group=groups.find(g=>Math.abs(g.y-y)<=3);if(!group){group={y,items:[]};groups.push(group);}group.items.push(item);}
  pages.push(groups.sort((a,b)=>b.y-a.y).map(g=>g.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(i=>i.str.trim()).join(' ')).join('\n'));
 }
 return {doc,text:pages.join('\f')};
}
function gallery(){
 $('gallery').innerHTML=documents.map((d,i)=>`<button class="document-tile ${i===selected?'active':''}" data-doc="${i}" aria-label="Inspect ${esc(d.source.title)}"><div class="thumb">${d.source.thumbnail?`<img src="${esc(d.source.thumbnail)}" alt="Preview of ${esc(d.source.title)}">`:'<span>PDF</span>'}</div><div class="tile-caption"><strong>${esc(d.source.title)}</strong><span>${esc(d.source.publisher||'Local PDF')} · ${d.doc?.numPages||d.source.pages||'?'} page${(d.doc?.numPages||d.source.pages)===1?'':'s'}</span></div></button>`).join('');
 for(const button of $('gallery').querySelectorAll('button'))button.addEventListener('click',()=>select(Number(button.dataset.doc)));
}
async function renderPage(){
 const d=documents[selected];if(!d?.doc)return;
 if(renderJob){renderJob.cancel();renderJob=null;}
 const page=await d.doc.getPage(pageNumber),viewport=page.getViewport({scale:1.35}),canvas=$('canvas');canvas.width=viewport.width;canvas.height=viewport.height;$('preview-empty').hidden=true;
 renderJob=page.render({canvasContext:canvas.getContext('2d'),viewport});try{await renderJob.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;}renderJob=null;
 $('page-number').textContent=`Page ${pageNumber} / ${d.doc.numPages}`;$('prev').disabled=pageNumber===1;$('next').disabled=pageNumber===d.doc.numPages;
}
function detail(){
 const r=records[selected];$('selected-state').textContent=r?(r.difference!==null&&r.difference!==undefined&&Math.abs(r.difference)>.01?'Total difference':r.review_required?'Metadata needs review':'Reconciled'):'Awaiting extraction';
 if(!r){$('details').innerHTML='<p class="empty">Click “Extract all 5 PDFs” to build the dataset from these documents.</p>';return;}
 const fields=[['Supplier',r.vendor],['Customer',r.customer],['Invoice number',r.invoice_number],['Invoice date',r.date],['Order reference',r.purchase_order],['Order date',r.order_date],['Due date',r.due_date],['Currency as printed',r.currency||r.currency_symbol],['Shipment date',r.shipment_date],['Source pages',r.source_pages]];
 $('details').innerHTML=`<dl class="field-grid">${fields.map(([label,v])=>`<div><dt>${label}</dt><dd>${esc(value(v))}</dd></div>`).join('')}</dl><div class="balance">${[['Extracted line items',r.items_sum],['Printed subtotal',r.printed_subtotal],['Tax',r.tax],['Shipping',r.shipping],['Discount',r.discount],['Calculated total',r.expected_total],['Printed total',r.invoice_total]].map(([label,v])=>`<div><span>${label}</span><strong>${money(v)}</strong></div>`).join('')}<div class="difference ${Math.abs(r.difference||0)>.01?'warn':''}"><span>Difference</span><span>${money(r.difference)}</span></div></div>${r.review_required?`<div class="review-box"><strong>Review before importing</strong><ul>${r.review_reasons.map(v=>`<li>${esc(v)}</li>`).join('')}</ul></div>`:'<p class="okay">The extracted values reconcile with the printed invoice total.</p>'}${r.source_notes?.length?`<p class="table-note">${esc(Array.isArray(r.source_notes)?r.source_notes.join(' '):r.source_notes)}</p>`:''}<details class="source-text"><summary>Show extracted source text</summary><pre>${esc(documents[selected]?.text||'')}</pre></details>`;
}
async function select(index,targetPage=1){
 selected=index;pageNumber=targetPage;gallery();const d=documents[index];$('source-name').textContent=d.source.file;$('publisher').textContent=d.source.publisher||'Local PDF';
 if(d.error){$('canvas').hidden=true;$('preview-empty').hidden=false;$('preview-empty').textContent=d.error;$('prev').disabled=true;$('next').disabled=true;$('open').hidden=true;detail();return;}
 $('canvas').hidden=false;$('open').hidden=false;
 if(!d.doc){const bytes=d.bytes||(d.arrayBuffer?new Uint8Array(await d.arrayBuffer()):(await fetchFile(d.source)).bytes);Object.assign(d,await readPDF(bytes),{bytes});}
 const old=$('open').href;if(old.startsWith('blob:'))URL.revokeObjectURL(old);$('open').href=URL.createObjectURL(new Blob([d.bytes],{type:'application/pdf'}));
 detail();await renderPage();
}
const searchable=r=>[r.source_file,r.vendor,r.customer,r.invoice_number,r.purchase_order,...r.items.map(i=>i.description)].join(' ').toLowerCase();
function tables(){
 const q=$('search').value.trim().toLowerCase();const matches=records.map((r,i)=>({r,i})).filter(({r})=>searchable(r).includes(q));
 $('invoice-rows').innerHTML=matches.map(({r,i})=>{
  const different=r.difference!==null&&r.difference!==undefined&&Math.abs(r.difference)>.01;
  return `<tr><td class="meta"><button class="row-open" data-open="${i}">${esc(r.source_file)}</button><strong>${esc(r.invoice_number||'Invoice number not printed')}</strong><small>${r.source_pages} page${r.source_pages===1?'':'s'} · ${r.items.length} items · ${esc(r.currency||'Currency not printed')}</small></td><td class="meta"><strong>${esc(r.vendor||'Supplier placeholder')}</strong><small>${esc(r.customer||'Customer not extracted')}</small></td><td><strong>${esc(r.date||'Not printed')}</strong><small>Due: ${esc(r.due_date||'—')}</small></td><td>${esc(r.purchase_order||'—')}<small>${r.order_date?'Order date: '+esc(r.order_date):''}</small></td><td class="num">${money(r.items_sum)}</td><td class="num">${money(r.tax)}</td><td class="num">${money(r.shipping)}<small>Discount: ${money(r.discount)}</small></td><td class="num"><strong>${money(r.invoice_total)}</strong></td><td class="num ${different?'warn':''}">${money(r.difference)}</td><td><span class="badge ${different?'review':''}">${different?'Total differs':r.difference===null||r.difference===undefined?'Not checked':'Totals match'}</span><details class="record-notes"><summary>${r.review_required?'Review fields':'Details & terms'}</summary>${[r.payment_terms,...(r.review_reasons||[]),...(Array.isArray(r.source_notes)?r.source_notes:[r.source_notes])].filter(Boolean).map(v=>`<p>${esc(v)}</p>`).join('')}<p>Profile: ${esc(r.source_profile||'Legacy / unrecognized')}</p><p>Sales order: ${esc(r.sales_order||'—')}</p><p>Delivery reference: ${esc(r.delivery_reference||'—')}</p><p>Customer ID: ${esc(r.customer_id||'—')}</p><p>Shipping method: ${esc(r.shipping_method||'—')}</p></details></td></tr>`;
 }).join('')||'<tr><td colspan="10" class="empty">No records match your search.</td></tr>';
 const chosen=$('line-filter').value;let count=0;
 $('line-rows').innerHTML=matches.filter(({i})=>chosen==='all'||String(i)===chosen).flatMap(({r,i})=>r.items.filter(line=>!q||[r.source_file,r.vendor,r.customer,r.invoice_number,r.purchase_order,line.description,line.sku].join(' ').toLowerCase().includes(q)).map((line,j)=>{
  count++;const computed=line.quantity!==null&&line.unit_price!==null?Math.round((line.quantity*line.unit_price+Number.EPSILON)*100)/100:null;const difference=computed!==null&&line.amount!==null?Math.round((line.amount-computed)*100)/100:null;
  return `<tr><td class="meta"><button class="row-open" data-open="${i}" data-page="${line.source_page||1}">${esc(r.source_file)}</button><small>Page ${line.source_page||1} · item ${j+1}</small></td><td>${esc(r.vendor||'Not printed')}</td><td>${esc(line.sku||'—')}</td><td class="desc">${esc(line.description)}</td><td>${esc(line.unit||'—')}</td><td class="num">${line.quantity===null?'—':line.quantity}</td><td class="num">${money(line.unit_price)}</td><td class="num">${money(line.amount)}</td><td class="num">${money(computed)}</td><td class="num ${Math.abs(difference||0)>.01?'warn':''}">${money(difference)}</td></tr>`;
 })).join('')||'<tr><td colspan="10" class="empty">No line items match this selection.</td></tr>';
 $('line-count').textContent=`${count} line items shown · source pages linked for verification`;
 for(const b of document.querySelectorAll('[data-open]'))b.addEventListener('click',()=>select(Number(b.dataset.open),Number(b.dataset.page)||1));
}
async function process(files){
 $('extract').disabled=true;$('files').disabled=true;$('export').disabled=true;$('csv-ready').hidden=true;records=[];documents=files.map(f=>({...f,source:f.source||{file:f.name,title:f.name,publisher:'Local PDF',pages:1}}));selected=0;
 try{
  for(const [i,d]of documents.entries()){
   $('progress').textContent=`Extracting document ${i+1} of ${documents.length}: ${d.source.file}`;
   try{
    const bytes=d.bytes instanceof Uint8Array?d.bytes:new Uint8Array(await d.arrayBuffer());Object.assign(d,await readPDF(bytes),{bytes});
    const r=extractPublic(d.text,d.source.file,profiles,d.doc.numPages)||{...parseInvoice(d.text,d.source.file),source_pages:d.doc.numPages,source_profile:'Unrecognized / legacy layout',source_notes:['Unknown layouts require tailored rules or validated AI extraction.']};
    records.push(r);
   }catch(e){d.error=e.message;records.push({source_file:d.source.file,items:[],source_pages:0,review_required:true,review_reasons:['Could not read PDF: '+e.message],source_notes:[]});}
  }
  markDuplicates(records);gallery();$('line-filter').innerHTML='<option value="all">All documents</option>'+records.map((r,i)=>`<option value="${i}">${esc(r.source_file)}</option>`).join('');$('line-filter').value='all';$('search').value='';tables();
  const items=records.reduce((n,r)=>n+r.items.length,0),differences=records.filter(r=>r.difference!==null&&r.difference!==undefined&&Math.abs(r.difference)>.01).length;
  $('progress').textContent=`${records.length} PDFs · ${items} line items · ${differences} total difference${differences===1?'':'s'}`;
  await select(0);$('export').disabled=!records.length;
 }finally{$('extract').disabled=false;$('files').disabled=false;}
}
$('extract').addEventListener('click',async()=>{try{const files=[];for(const source of manifest)files.push(await fetchFile(source));await process(files);}catch(e){$('progress').textContent=e.message;}});
$('files').addEventListener('change',()=>{if($('files').files.length)process([...$('files').files].map(file=>({name:file.name,arrayBuffer:()=>file.arrayBuffer()}))).catch(e=>$('progress').textContent=e.message);});
$('prev').addEventListener('click',async()=>{if(pageNumber>1){pageNumber--;await renderPage();}});$('next').addEventListener('click',async()=>{if(pageNumber<documents[selected].doc.numPages){pageNumber++;await renderPage();}});
$('search').addEventListener('input',tables);$('line-filter').addEventListener('change',tables);
$('export').addEventListener('click',()=>{const link=$('csv-ready');if(link.href.startsWith('blob:'))URL.revokeObjectURL(link.href);link.href=URL.createObjectURL(new Blob([toCSV(records)],{type:'text/csv;charset=utf-8'}));link.hidden=false;link.click();});
try{
 [manifest,profiles]=await Promise.all(['sources.json','public_profiles.json'].map(async path=>{const response=await fetch(path);if(!response.ok)throw new Error('Could not load '+path);return response.json();}));
 documents=manifest.map(source=>({source}));gallery();$('source-links').innerHTML=manifest.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}: ${esc(s.title)}</a>`).join('');await select(0);
}catch(e){$('preview-empty').textContent=e.message;$('progress').textContent='Load the published site or serve this folder through a local web server.';}
