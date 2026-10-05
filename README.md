# Invoice Extraction Workbench

A repeatable PDF-to-CSV workflow with a browser review interface, invoice line items and arithmetic reconciliation.

**[Open the interactive demo](https://enybyy.github.io/invoice-extraction-workbench/)** · [Download Windows package](Invoice_Extractor_Package.zip) · [Excel output](outputs/20261005-invoice/Invoice_Extraction.xlsx) · [CSV output](outputs/20261005-invoice/invoices.csv)

![Invoice source and extracted fields](assets/Workbench.png)

## Try it in the browser

Click **Process 10 sample PDFs**. The browser reads the actual PDFs using PDF.js and extracts their text with the supported layout rules. Select an invoice to compare its source with extracted fields and line items. **Export CSV** downloads the currently processed batch.

The ten sample invoices are fictional and cover three text layouts, two currencies, tax, shipping, discounts, a wrong total, a wrong line amount, a missing date and an image-only scan. Six reconcile, four require review. This is a demonstrable workflow, not validation against a customer's invoices.

## Run on Windows

1. Download and extract the package.
2. Install Python 3.12+ from python.org with **Add Python to PATH**.
3. Double-click `setup.cmd` once to create a virtual environment and install pypdf.
4. Place PDF invoices in `inputs`.
5. Double-click `run.cmd`. Open `output/invoices.csv` and the invoice review page.

The package already includes the ten sample PDFs. Move these out of `inputs` before running a customer batch. Original PDFs are not changed.

```sh
python -m pip install -r requirements.txt
python extract_invoices.py --input inputs --output output --mode local
```

## AI extraction for varying layouts

The Python package includes an explicit `--mode ai` implementation using the OpenAI Responses API, PDF input and structured JSON output. Set `OPENAI_API_KEY` and `OPENAI_MODEL` in your environment, then run `run_ai.cmd`. The selected model must support PDF inputs and structured outputs.

AI mode sends PDFs to OpenAI, may incur API charges, and requires the user's confirmation in the launcher. Keys never belong in the browser or the repository. No live AI call has been validated in this project: accuracy, account access, model support and scanned-document quality must be checked against the actual source documents. The deterministic arithmetic checks run after either extraction mode.

Documentation: [file inputs](https://developers.openai.com/api/docs/guides/file-inputs) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Output and review

- `invoices.csv`: one row per line item with vendor, invoice number, date, currency, quantities, prices, amounts, invoice-level adjustments and review reasons. An unreadable invoice gets one placeholder row so it is not silently dropped.
- `results.json`: invoice-level structured records, original PDF filenames and SHA-256 file hashes.
- `review.html`: a local overview of printed and calculated totals.
- Published Excel: the captured sample batch, with invoice-level and line-item worksheets, filters and formulas. The batch Python script produces CSV/JSON/HTML; it does not regenerate the styled Excel.

Invoice totals repeat in the CSV for reference. **Do not sum repeated invoice totals across line-item rows.** Use one record per invoice or the Excel invoice sheet for invoice-level reporting. Never aggregate different currencies without a conversion policy.

Arithmetic uses Decimal in Python, rounded cents in the browser, and a 0.01 tolerance:

`items sum + tax + shipping - discount = expected total`

Printed line amounts are also compared with quantity × unit price. Printed values are kept, not silently corrected. Missing fields, unavailable text, unclear dates, duplicate vendor/invoice/date identifiers and processing errors remain in the review list. An invoice that reconciles can still have an incomplete extraction; review the vendor layout before relying on a batch.

## Scope

Local extraction handles the three included text layouts. Unknown vendors, multiline item descriptions, mixed tax treatment, credit notes and complex tables need tailored rules or validated AI extraction. PDFs are limited to 20 MB and 30 pages per file. Local mode has no OCR; image-only documents require AI vision or another OCR workflow. Encrypted PDFs require an unprotected copy. This package focuses on PDF invoices, not Word documents.

## Related experience

The earlier [Generar RH](https://github.com/Enybyy/rh-document-generator) project includes a Python PDF receipt extractor for series, date and total, alongside Excel-to-Word document generation. This workbench adds a separate line-item and reconciliation workflow.

## Verification

```sh
python -m unittest discover -s tests -v
```

Tests exercise actual PDF fixtures, currency number formats, reconciliation failures, missing values, duplicate preservation, malformed PDFs and AI configuration requirements. Browser checks cover sample processing, individual PDF uploads, PDF preview, review selection and CSV generation. The downloadable package was extracted and run in an independent folder. Passing fixture checks does not establish accuracy on unseen vendor layouts.

PDF.js is included under Apache 2.0; see `vendor/PDFJS-LICENSE`. Fictional vendor names do not represent client engagements.

---

**Eliud Rojas Mendoza · Enybyy** · [GitHub](https://github.com/Enybyy) · [Upwork](https://www.upwork.com/freelancers/eliudevelopment)
