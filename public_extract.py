"""Configurable extraction rules for downloaded public invoice layouts."""
import json,re
from pathlib import Path
from datetime import datetime
from decimal import Decimal
PROFILES=json.loads((Path(__file__).parent/'public_profiles.json').read_text(encoding='utf8'))
FORMATS={'iso':'%Y-%m-%d','mdy-short':'%m-%d-%y','long':'%B %d, %Y','short-long':'%d %b %Y','dmy':'%d/%m/%Y'}
def normalized_date(value,style):
    if not value:return ''
    try:return datetime.strptime(value,FORMATS[style]).date().isoformat()
    except ValueError:return ''
def extract_public(text):
    profile=next((p for p in PROFILES if all(t.lower() in text.lower() for t in p['match'])),None)
    if not profile:return None
    clean='\n'.join(line.strip() for line in text.splitlines() if line.strip())
    data={'vendor':'','invoice_number':'','date':'','currency':profile['currency'],'currency_symbol':profile['symbol'],'tax':'0','shipping':'0','discount':'0','total':None,'items':[],'notes':[],'source_notes':[], 'source_profile':profile['name']}
    for key,pattern in profile['fields'].items():
        match=re.search(pattern,clean,re.I|re.M)
        data[key]=match[1].strip() if match else ''
    data['date']=normalized_date(data.get('raw_date',''),profile['date_format'])
    for key in ['due_date','order_date','shipment_date']:
        if data.get(key):data[key]=normalized_date(data[key],profile['date_format']) or data[key]
    for page_index,page in enumerate(text.split('\f'),1):
        lines=[x.strip() for x in page.splitlines() if x.strip()]
        for i,line in enumerate(lines):
            match=re.match(profile['row'],line,re.I)
            fields=profile['row_fields']
            sparse=False
            if not match and profile.get('row_without_description'):
                match=re.match(profile['row_without_description'],line,re.I);fields=profile['sparse_row_fields'];sparse=True
            if not match:continue
            item=dict(zip(fields,match.groups()))
            if sparse:item['description']=lines[i-1] if i else ''
            if profile.get('description_from_attributes'):
                item['description']=' / '.join(x for x in [item['sku'],item.get('orientation'),item.get('attributes')] if x)
            if profile.get('continuation') and i+1<len(lines) and lines[i+1].startswith('This is '):item['description']+=' / '+lines[i+1]
            item['description']=re.sub(r'\s+',' ',item.get('description','')).strip()
            item['source_page']=page_index;item.setdefault('unit','');data['items'].append(item)
    if profile['id']=='joinery' and data.get('printed_subtotal') and data.get('net_after_discount'):
        data['discount']=str(Decimal(data['printed_subtotal'])-Decimal(data['net_after_discount']))
        data['source_notes'].append('Discount calculated from printed gross total minus printed net after discount. Printed VAT is retained; source describes a settlement-discount tax basis.')
    if profile['id']=='distribution':data['source_notes'].append('Order ID and order date are separate fields; the source does not print an invoice number, invoice date or currency.')
    if profile['id']=='university':data['source_notes'].append('Source contains supplier/date placeholders and amount-only line items; quantities and unit prices remain empty.')
    if profile['currency']=='$':data['source_notes'].append('Dollar symbol is printed, but no ISO currency code; currency remains $ for review.')
    return data
