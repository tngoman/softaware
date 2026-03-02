import React from 'react';
import { Invoice } from '../../types';
import { formatDate, parseNotes } from '../../utils/formatters';
import { PaymentStatusBadge } from './PaymentStatusBadge';

interface InvoiceDetailsProps {
  invoice: Invoice;
}

export const InvoiceDetails: React.FC<InvoiceDetailsProps> = ({ invoice }) => {
  return (
    <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 overflow-hidden">
      {/* Customer Information */}
      <div className="bg-gradient-to-r from-non-photo-blue/30 to-white p-6 border-b-2 border-picton-blue/20">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Invoice To</h3>
            <div className="space-y-1">
              <p className="text-lg font-bold text-gray-900">{invoice.contact_name || 'Unknown Customer'}</p>
              {invoice.contact_phone && (
                <p className="text-sm text-gray-600">Tel: {invoice.contact_phone}</p>
              )}
              {invoice.contact_email && (
                <p className="text-sm text-gray-600">Email: {invoice.contact_email}</p>
              )}
              
              {/* Parsed Notes in Customer Section */}
              {Object.keys(parseNotes(invoice.invoice_notes)).length > 0 && (
                <>
                  {Object.entries(parseNotes(invoice.invoice_notes)).map(([key, value]) => (
                    <p key={key} className="text-sm text-gray-600">
                      {key}: {value}
                    </p>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block">
              <PaymentStatusBadge status={invoice.invoice_payment_status} />
            </div>
            {invoice.invoice_payment_date && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-semibold">Paid on:</span> {formatDate(invoice.invoice_payment_date)}
              </p>
            )}
          </div>
        </div>
        
        {/* Invoice Details */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-x-8">
            <div className="flex">
              <span className="text-sm font-semibold text-gray-700 mr-2">Invoice #:</span>
              <span className="text-sm text-gray-900">INV-{String(invoice.invoice_id).padStart(5, '0')}</span>
            </div>
            <div className="flex">
              <span className="text-sm font-semibold text-gray-700 mr-2">Date:</span>
              <span className="text-sm text-gray-900">{formatDate(invoice.invoice_date)}</span>
            </div>
            <div className="flex">
              <span className="text-sm font-semibold text-gray-700 mr-2">Due Date:</span>
              <span className="text-sm text-gray-900">{formatDate(invoice.invoice_valid_until || invoice.invoice_due_date)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
