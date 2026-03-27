/**
 * PDF Generator — recreates the mPDF-based PDF from the PHP API
 * Uses Puppeteer to render an HTML template into a proper PDF file.
 */
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db/mysql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/* ─────────────────────────── types ─────────────────────────── */

export interface CompanySettings {
  site_name: string;
  site_email: string;
  site_contact_no: string;
  site_vat_no: string;
  site_address: string;
  site_logo: string;
  site_quote_terms: string;
  site_quote_terms_web: string;
  bank_account_name: string;
  bank_name: string;
  bank_account_no: string;
  bank_branch_code: string;
  bank_account_type: string;
  bank_reference: string;
  vat_percentage: string;
}

export interface PDFDocData {
  type: 'invoice' | 'quotation' | 'proforma' | 'credit_note' | 'purchase_order';
  number: string;           // e.g. "QT-2026-001" or "INV-2026-001"
  date: string;
  validUntil?: string;      // quotation valid-until or invoice due-date
  paymentStatus?: number;   // 0=pending, 1=overdue, 2=paid (invoice only)
  notes?: string;
  termsType?: 'ppe' | 'web';  // PPE or Web Services terms
  qtyLabel?: 'qty' | 'hours'; // QTY or Hours column header
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  contact: {
    name: string;
    vat?: string;
    address?: string;
    phone?: string;
  };
  items: Array<{
    product: string;
    qty: number;
    price: number;
    vatFlag: number;   // 1 = apply 15% VAT, 0 = no
    subtotal: number;
  }>;
}

/* ───────────────────── load company settings ───────────────── */

export async function loadCompanySettings(): Promise<CompanySettings> {
  const rows = await db.query<{ setting_key: string; setting_value: string }>(
    'SELECT setting_key, setting_value FROM app_settings'
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[r.setting_key] = r.setting_value || '';
  return {
    site_name:         map.site_name         || 'Company',
    site_email:        map.site_email        || '',
    site_contact_no:   map.site_contact_no   || '',
    site_vat_no:       map.site_vat_no       || '',
    site_address:      map.site_address      || '',
    site_logo:         map.site_logo         || '',
    site_quote_terms:  map.site_quote_terms  || '',
    site_quote_terms_web: map.site_quote_terms_web || '',
    bank_account_name: map.bank_account_name || '',
    bank_name:         map.bank_name         || '',
    bank_account_no:   map.bank_account_no   || '',
    bank_branch_code:  map.bank_branch_code  || '',
    bank_account_type: map.bank_account_type || '',
    bank_reference:    map.bank_reference    || '',
    vat_percentage:    map.vat_percentage    || '15',
  };
}

/* ───────────────────── logo to base64 ──────────────────────── */

export async function logoToBase64(filename: string): Promise<string> {
  if (!filename) return '';
  const logoPath = path.join(PUBLIC_DIR, 'assets', 'images', filename);
  try {
    const buf = await fs.readFile(logoPath);
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext || 'png'}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return '';
  }
}

/* ───────────────── format helpers ──────────────────────────── */

const R = (n: number): string => `R ${n.toFixed(2)}`;

function formatPdfDate(d: string | Date | undefined): string {
  if (!d) return 'N/A';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function parseNotes(notes?: string): Array<{ key: string; value: string }> {
  if (!notes) return [];
  return notes.split('\n').filter(Boolean).map(line => {
    const idx = line.indexOf(':');
    if (idx > -1) return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    return { key: '', value: line.trim() };
  });
}

function padId(num: string | number, len = 5): string {
  const s = String(num);
  return s.length >= len ? s : s.padStart(len, '0');
}

/* ─────────────── payment status badge (invoices) ───────────── */

function statusBadge(status?: number): string {
  if (status === undefined || status === 0) return ''; // pending – hidden
  if (status === 2)
    return `<div style="display:inline-block;background:#D1FAE5;color:#065F46;padding:6px 18px;border-radius:20px;font-weight:700;font-size:12px;margin:10px 0;">PAID</div>`;
  if (status === 1)
    return `<div style="display:inline-block;background:#FEE2E2;color:#991B1B;padding:6px 18px;border-radius:20px;font-weight:700;font-size:12px;margin:10px 0;">OVERDUE</div>`;
  return '';
}

/* ──────────────────── build HTML template ──────────────────── */

export function buildPdfHtml(doc: PDFDocData, co: CompanySettings, logoDataUri: string): string {
  const isInvoice = doc.type === 'invoice' || doc.type === 'proforma';
  const isCreditNote = doc.type === 'credit_note';
  const isPurchaseOrder = doc.type === 'purchase_order';
  const title = doc.type === 'proforma' ? 'PROFORMA INVOICE'
    : doc.type === 'credit_note' ? 'CREDIT NOTE'
    : doc.type === 'purchase_order' ? 'PURCHASE ORDER'
    : doc.type === 'invoice' ? 'TAX INVOICE' : 'QUOTATION';
  const numberLabel = `#${doc.number.includes('-') ? doc.number : padId(doc.number)}`;
  const dateLabel2 = isInvoice ? 'DUE DATE:' : isCreditNote ? 'INVOICE REF:' : isPurchaseOrder ? 'DELIVERY DATE:' : 'VALID UNTIL:';
  const clientLabel = isCreditNote ? 'Credit To' : isPurchaseOrder ? 'Supplier' : isInvoice ? 'Invoice To' : 'Quotation For';
  const vatPct = parseFloat(co.vat_percentage) || 15;

  const notesParsed = parseNotes(doc.notes);
  const notesHtml = notesParsed.map(n =>
    n.key
      ? `<div style="margin-bottom:2px"><span style="font-weight:600;color:#374151">${n.key}:</span> ${n.value}</div>`
      : `<div style="margin-bottom:2px">${n.value}</div>`
  ).join('');

  // Build item rows
  const isHours = (doc.qtyLabel || 'qty') === 'hours';
  const itemRows = doc.items.map(it => {
    const lineVat = it.vatFlag === 1 ? (it.qty * it.price * vatPct / 100) : 0;
    const lineTotal = it.qty * it.price;
    return isHours
      ? `<tr>
      <td style="padding:10px 8px">${it.product}</td>
      <td style="text-align:right;padding:10px 8px">${R(it.price)}</td>
      <td style="text-align:center;padding:10px 8px">${it.qty}</td>
      <td style="text-align:right;padding:10px 8px">${R(lineVat)}</td>
      <td style="text-align:right;padding:10px 8px">${R(lineTotal)}</td>
    </tr>`
      : `<tr>
      <td style="text-align:center;padding:10px 8px">${it.qty}</td>
      <td style="padding:10px 8px">${it.product}</td>
      <td style="text-align:right;padding:10px 8px">${R(it.price)}</td>
      <td style="text-align:right;padding:10px 8px">${R(lineVat)}</td>
      <td style="text-align:right;padding:10px 8px">${R(lineTotal)}</td>
    </tr>`;
  }).join('');

  // VAT summary row (invoice only, when there is VAT)
  const vatRow = isInvoice && doc.vat > 0
    ? `<tr style="background:#f0f9ff">
        ${isHours ? '' : '<td style="text-align:center;padding:10px 8px"></td>'}
        <td style="padding:10px 8px;font-weight:600">VAT (${vatPct}%)</td>
        <td style="text-align:right;padding:10px 8px"></td>
        <td style="text-align:right;padding:10px 8px"></td>
        ${isHours ? '<td style="text-align:right;padding:10px 8px"></td>' : ''}
        <td style="text-align:right;padding:10px 8px">${R(doc.vat)}</td>
      </tr>`
    : '';

  // Logo section
  const logoHtml = logoDataUri
    ? `<div style="background:#fff;border-radius:8px;padding:8px;display:inline-block">
        <img src="${logoDataUri}" style="max-height:60px;max-width:180px" />
      </div>`
    : `<div style="color:#fff;font-size:22px;font-weight:700">${co.site_name}</div>`;

  // Banking details section (for invoices)
  const bankingHtml = isInvoice && co.bank_name ? `
    <div style="margin-top:20px;padding:14px 16px;background:#F0F9FF;border-left:4px solid #00A4EE;border-radius:4px">
      <div style="font-weight:700;font-size:12px;color:#00A4EE;margin-bottom:8px">BANKING DETAILS</div>
      <table style="width:100%;font-size:10px;border:none">
        <tr><td style="padding:2px 0;border:none;width:120px;color:#6B7280">Account Name:</td><td style="padding:2px 0;border:none">${co.bank_account_name}</td></tr>
        <tr><td style="padding:2px 0;border:none;color:#6B7280">Bank:</td><td style="padding:2px 0;border:none">${co.bank_name}</td></tr>
        <tr><td style="padding:2px 0;border:none;color:#6B7280">Account No:</td><td style="padding:2px 0;border:none">${co.bank_account_no}</td></tr>
        <tr><td style="padding:2px 0;border:none;color:#6B7280">Branch Code:</td><td style="padding:2px 0;border:none">${co.bank_branch_code}</td></tr>
        <tr><td style="padding:2px 0;border:none;color:#6B7280">Account Type:</td><td style="padding:2px 0;border:none">${co.bank_account_type}</td></tr>
        <tr><td style="padding:2px 0;border:none;color:#6B7280">Reference:</td><td style="padding:2px 0;border:none">${co.bank_reference}</td></tr>
      </table>
    </div>` : '';

  // Quotation terms section — pick terms based on termsType
  const selectedTerms = doc.termsType === 'web' ? co.site_quote_terms_web : co.site_quote_terms;
  const termsContent = selectedTerms || co.site_quote_terms;
  const termsHtml = !isInvoice && termsContent ? `
    <div style="margin-top:20px;padding:14px 16px;background:#F9FAFB;border-left:4px solid #6B7280;border-radius:4px">
      <div style="font-weight:700;font-size:12px;color:#374151;margin-bottom:8px">TERMS & CONDITIONS</div>
      <div style="font-size:10px;color:#6B7280;line-height:1.6;white-space:pre-line">${termsContent}</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1F2937; }
  .header { background: #00A4EE; color: #fff; padding: 24px 30px; display: flex; justify-content: space-between; align-items: center; }
  .header-right { text-align: right; }
  .header-right .title { font-size: 28px; font-weight: 700; letter-spacing: 2px; }
  .header-right .number { font-size: 16px; margin-top: 4px; opacity: 0.9; }
  .info-row { display: flex; justify-content: space-between; padding: 20px 30px; }
  .company-info { font-size: 10px; line-height: 1.6; }
  .company-info .name { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .company-info .detail { color: #6B7280; }
  .dates { text-align: right; font-size: 10px; }
  .dates div { margin-bottom: 6px; }
  .dates .label { color: #6B7280; font-weight: 600; }
  .dates .value { color: #111827; font-weight: 700; }
  .client-box { margin: 0 30px 16px; padding: 14px 16px; background: #F0F9FF; border-left: 4px solid #00A4EE; border-radius: 4px; }
  .client-box .label { font-size: 10px; font-weight: 600; color: #00A4EE; text-transform: uppercase; margin-bottom: 6px; }
  .client-box .name { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .client-box .detail { color: #6B7280; font-size: 10px; line-height: 1.6; }
  table.items { width: calc(100% - 60px); margin: 0 30px; border-collapse: collapse; font-size: 10px; }
  table.items th { background: #00A4EE; color: #fff; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.items th:first-child { text-align: center; }
  table.items th:nth-child(3), table.items th:nth-child(4), table.items th:nth-child(5) { text-align: right; }
  table.items td { border-bottom: 1px solid #E5E7EB; }
  table.items tr:last-child td { border-bottom: none; }
  .totals { margin: 16px 30px 0; display: flex; justify-content: flex-end; }
  .totals-box { width: 260px; background: #f9fafb; border-radius: 6px; overflow: hidden; }
  .totals-box .row { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 10px; }
  .totals-box .row .lbl { color: #6B7280; }
  .totals-box .row .val { font-weight: 600; color: #111827; }
  .totals-box .total-row { background: #00A4EE; color: #fff; padding: 10px 16px; font-size: 13px; font-weight: 700; }
  .badge-row { padding: 0 30px 10px; }
  .footer { margin-top: 30px; padding: 0 30px; }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div>${logoHtml}</div>
  <div class="header-right">
    <div class="title">${title}</div>
    <div class="number">${numberLabel}</div>
  </div>
</div>

<!-- COMPANY INFO + DATES -->
<div class="info-row">
  <div class="company-info">
    <div class="name">${co.site_name}</div>
    <div class="detail">${co.site_address}</div>
    <div class="detail">${co.site_email}${co.site_contact_no ? ' | ' + co.site_contact_no : ''}</div>
    ${co.site_vat_no ? `<div class="detail">VAT: ${co.site_vat_no}</div>` : ''}
  </div>
  <div class="dates">
    <div><span class="label">DATE:</span> <span class="value">${formatPdfDate(doc.date)}</span></div>
    <div><span class="label">${dateLabel2}</span> <span class="value">${formatPdfDate(doc.validUntil)}</span></div>
  </div>
</div>

<!-- PAYMENT STATUS -->
<div class="badge-row">${statusBadge(doc.paymentStatus)}</div>

<!-- CLIENT -->
<div class="client-box">
  <div class="label">${clientLabel}</div>
  <div class="name">${doc.contact.name || 'N/A'}</div>
  <div class="detail">
    ${doc.contact.vat ? `<div>VAT: ${doc.contact.vat}</div>` : ''}
    ${doc.contact.address ? `<div>${doc.contact.address}</div>` : ''}
    ${doc.contact.phone ? `<div>${doc.contact.phone}</div>` : ''}
  </div>
  ${notesHtml ? `<div style="margin-top:8px;font-size:10px;color:#374151;line-height:1.6">${notesHtml}</div>` : ''}
</div>

<!-- ITEMS TABLE -->
<table class="items">
  <thead>
    <tr>
      ${isHours
        ? `<th>DESCRIPTION</th>
      <th style="width:100px;text-align:right">UNIT PRICE</th>
      <th style="width:50px">HOURS</th>`
        : `<th style="width:50px">QTY</th>
      <th>DESCRIPTION</th>
      <th style="width:100px;text-align:right">UNIT PRICE</th>`}
      <th style="width:80px;text-align:right">VAT</th>
      <th style="width:100px;text-align:right">TOTAL</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#9CA3AF">No items</td></tr>'}
    ${vatRow}
  </tbody>
</table>

<!-- TOTALS -->
<div class="totals">
  <div class="totals-box">
    <div class="row"><span class="lbl">Subtotal:</span><span class="val">${R(doc.subtotal)}</span></div>
    ${doc.discount > 0 ? `<div class="row"><span class="lbl">Discount:</span><span class="val">-${R(doc.discount)}</span></div>` : ''}
    ${doc.vat > 0 ? `<div class="row"><span class="lbl">VAT (${vatPct}%):</span><span class="val">${R(doc.vat)}</span></div>` : ''}
    <div class="total-row" style="display:flex;justify-content:space-between">
      <span>TOTAL:</span><span>${R(doc.total)}</span>
    </div>
  </div>
</div>

${bankingHtml ? `<div class="footer">${bankingHtml}</div>` : ''}
${termsHtml ? `<div class="footer">${termsHtml}</div>` : ''}

</body></html>`;
}

/* ──────────────────── render HTML → PDF ────────────────────── */

export async function generatePdf(
  doc: PDFDocData,
  co: CompanySettings
): Promise<{ filename: string; filepath: string; webPath: string }> {

  const logoDataUri = await logoToBase64(co.site_logo);
  const html = buildPdfHtml(doc, co, logoDataUri);

  // Ensure output directory exists
  const outDir = path.join(PUBLIC_DIR, 'pdfs');
  await fs.mkdir(outDir, { recursive: true });

  const timestamp = Math.floor(Date.now() / 1000);
  const safeNumber = doc.number.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${doc.type}_${safeNumber}_${timestamp}.pdf`;
  const filepath = path.join(outDir, filename);
  const webPath = `public/pdfs/${filename}`;

  // Launch headless Chrome and render
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: filepath,
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', bottom: '16px', left: '15px', right: '15px' },
    });
  } finally {
    await browser.close();
  }

  return { filename, filepath, webPath };
}
