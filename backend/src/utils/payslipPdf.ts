import puppeteer from 'puppeteer';
import { loadCompanySettings, logoToBase64 } from './pdfGenerator.js';

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return 'N/A';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  const day = String(date.getDate()).padStart(2, '0');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export interface PayslipLineItem {
  type: string;
  label: string;
  amount_cents: number;
}

export interface PayslipPdfData {
  reference_number: string;
  employee_name: string;
  employee_email: string;
  employment_date?: string | null;
  id_number?: string | null;
  tax_number?: string | null;
  bank_name?: string | null;
  account_number_masked?: string | null;
  account_type?: string | null;
  pay_month: number;
  pay_year: number;
  gross_salary_cents: number;
  total_deductions_cents: number;
  total_allowances_cents: number;
  net_salary_cents: number;
  deductions_snapshot: PayslipLineItem[];
  allowances_snapshot: PayslipLineItem[];
  generated_at: string;
  leave_days_remaining?: number | null;
}

function money(cents: number): string {
  return `R ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function monthName(month: number): string {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][month - 1] || String(month);
}

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rows(items: PayslipLineItem[]): string {
  if (!items.length) {
    return '<tr><td colspan="2" style="padding:8px 0;color:#6b7280">None</td></tr>';
  }

  return items.map((item) => `
    <tr>
      <td style="padding:8px 0;color:#111827">${escapeHtml(item.label)}</td>
      <td style="padding:8px 0;text-align:right;color:#111827;font-weight:600">${money(item.amount_cents)}</td>
    </tr>
  `).join('');
}

function buildHtml(data: PayslipPdfData, company: Awaited<ReturnType<typeof loadCompanySettings>>, logoDataUri: string): string {
  const logoHtml = logoDataUri
    ? `<img src="${logoDataUri}" style="max-height:60px;max-width:180px" />`
    : `<div style="font-size:22px;font-weight:700;color:#111827;">${escapeHtml(company.site_name || 'Soft Aware')}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; color: #111827; }
    .page { padding: 28px 34px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00A4EE; padding-bottom: 16px; }
    .title { text-align: right; }
    .title h1 { margin: 0; font-size: 28px; letter-spacing: 2px; color: #00A4EE; }
    .title p { margin: 6px 0 0; color: #4b5563; font-size: 12px; }
    .section { margin-top: 22px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .box h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; }
    .meta-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; font-size: 12px; }
    .meta-row span:first-child { color: #6b7280; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .8px; padding-bottom: 8px; }
    .totals { margin-top: 18px; margin-left: auto; width: 320px; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
    .totals .row { display: flex; justify-content: space-between; padding: 10px 14px; font-size: 13px; background: #fff; border-bottom: 1px solid #e5e7eb; }
    .totals .row:last-child { border-bottom: none; }
    .totals .net { background: #00A4EE; color: #fff; font-size: 16px; font-weight: 700; }
    .items-table td { font-size: 12px; padding: 5px 0; }
    .items-table th { font-size: 11px; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 10px; color: #9ca3af; padding: 8px 0; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        ${logoHtml}
        <div style="margin-top:6px;font-size:12px;color:#4b5563;white-space:pre-line;">${escapeHtml(company.site_address || '')}</div>
        <div style="margin-top:6px;font-size:12px;color:#4b5563;">${escapeHtml(company.site_email || '')}${company.site_contact_no ? ` | ${escapeHtml(company.site_contact_no)}` : ''}</div>
        ${company.site_vat_no ? `<div style="margin-top:4px;font-size:12px;color:#4b5563;">VAT No: ${escapeHtml(company.site_vat_no)}</div>` : ''}
      </div>
      <div class="title">
        <h1>PAYSLIP</h1>
        <p style="margin:8px 0 4px;font-size:13px;font-weight:600;color:#111827;letter-spacing:0.3px;border:1px solid #d1d5db;border-radius:6px;display:inline-block;padding:4px 12px">${escapeHtml(monthName(data.pay_month))} ${data.pay_year}</p>
        <p>Ref: ${escapeHtml(data.reference_number)}</p>
      </div>
    </div>

    <div class="section grid">
      <div class="box">
        <h3>Employee</h3>
        <div class="meta-row"><span>Name</span><span>${escapeHtml(data.employee_name)}</span></div>
        <div class="meta-row"><span>Email</span><span>${escapeHtml(data.employee_email)}</span></div>
        ${data.id_number ? `<div class="meta-row"><span>ID Number</span><span>${escapeHtml(data.id_number)}</span></div>` : ''}
        ${data.tax_number ? `<div class="meta-row"><span>Tax Number</span><span>${escapeHtml(data.tax_number)}</span></div>` : ''}
        ${data.employment_date ? `<div class="meta-row"><span>Employment Date</span><span>${formatDate(data.employment_date)}</span></div>` : ''}
      </div>
      <div class="box">
        <h3>Banking</h3>
        <div class="meta-row"><span>Bank</span><span>${escapeHtml(data.bank_name || '-')}</span></div>
        <div class="meta-row"><span>Account</span><span>${escapeHtml(data.account_number_masked || '-')}</span></div>
        <div class="meta-row"><span>Account Type</span><span>${escapeHtml(data.account_type || '-')}</span></div>
        <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px;"></div>
        <div class="meta-row"><span>YTD Gross</span><span style="font-weight:600">${money(data.gross_salary_cents * data.pay_month)}</span></div>
        <div class="meta-row"><span>Leave Days Remaining</span><span style="font-weight:600">${data.leave_days_remaining ?? '-'}</span></div>
      </div>
    </div>

    ${(data.deductions_snapshot.length > 0 || data.allowances_snapshot.length > 0) ? `
    <div class="section grid">
      <div class="box">
        <h3>Deductions</h3>
        <table class="items-table">
          <thead>
            <tr><th>Item</th><th style="text-align:right;">Amount</th></tr>
          </thead>
          <tbody>${rows(data.deductions_snapshot)}</tbody>
        </table>
      </div>
      <div class="box">
        <h3>Allowances</h3>
        <table class="items-table">
          <thead>
            <tr><th>Item</th><th style="text-align:right;">Amount</th></tr>
          </thead>
          <tbody>${rows(data.allowances_snapshot)}</tbody>
        </table>
      </div>
    </div>` : ''}

    <div class="totals">
      <div class="row"><span>Gross Salary</span><strong>${money(data.gross_salary_cents)}</strong></div>
      ${(data.deductions_snapshot.length > 0 || data.allowances_snapshot.length > 0) ? `
      <div class="row"><span>Total Deductions</span><strong>${money(data.total_deductions_cents)}</strong></div>
      <div class="row"><span>Total Allowances</span><strong>${money(data.total_allowances_cents)}</strong></div>` : ''}
      <div class="row net"><span>Net Pay</span><span>${money(data.net_salary_cents)}</span></div>
    </div>

  </div>
  <div class="footer">
    This payslip was generated electronically by ${escapeHtml(company.site_name || 'Soft Aware')}.
  </div>
</body>
</html>`;
}

export async function generatePayslipPdfBuffer(data: PayslipPdfData): Promise<Buffer> {
  const company = await loadCompanySettings();
  const logoDataUri = await logoToBase64(company.site_logo);
  const html = buildHtml(data, company, logoDataUri);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16px', right: '16px', bottom: '40px', left: '16px' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
