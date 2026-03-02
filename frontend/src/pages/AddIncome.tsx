import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { TransactionModel, ContactModel } from '../models';
import { Contact } from '../types';
import { BackButton, Input, Select, CustomDatePicker } from '../components/UI';
import Swal from 'sweetalert2';

const AddIncome: React.FC = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [existingInvoices, setExistingInvoices] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    party_name: '',
    invoice_number: '',
    total_amount: '',
    vat_type: 'standard' as 'standard' | 'zero' | 'exempt' | 'non-vat',
    income_type: 'services',
  });
  
  const [document, setDocument] = useState<File | null>(null);
  const [calculatedAmounts, setCalculatedAmounts] = useState({ vat: 0, exclusive: 0 });

  useEffect(() => {
    loadCustomers();
    loadInvoiceNumbers();
  }, []);

  useEffect(() => {
    // Calculate VAT amounts when total_amount or vat_type changes
    calculateVat();
  }, [formData.total_amount, formData.vat_type]);

  const loadCustomers = async () => {
    try {
      const data = await ContactModel.getAll('customers', {
        page: 0,
        limit: 1000,
        sortBy: 'contact_name',
        sortOrder: 'asc'
      });
      // data contains the API response: {data: Contact[], pagination: {...}} or Contact[]
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        setCustomers((data as any).data);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load customers' });
    }
  };

  const loadInvoiceNumbers = () => {
    // Load existing invoice numbers to check for duplicates
    const saved = localStorage.getItem('income_invoices');
    if (saved) {
      setExistingInvoices(JSON.parse(saved));
    }
  };

  const calculateVat = () => {
    const total = parseFloat(formData.total_amount) || 0;
    if (formData.vat_type === 'standard') {
      const vat = Math.round((total * 15 / 115) * 100) / 100;
      const exclusive = Math.round((total - vat) * 100) / 100;
      setCalculatedAmounts({ vat, exclusive });
    } else {
      setCalculatedAmounts({ vat: 0, exclusive: total });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'File too large (max 5MB)' });
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Invalid file type. Only PDF, JPG, and PNG allowed' });
        return;
      }
      
      setDocument(file);
    }
  };

  const checkDuplicateInvoice = () => {
    if (existingInvoices.includes(formData.invoice_number)) {
      return window.confirm(
        `Warning: You have already used invoice number "${formData.invoice_number}". Do you want to continue?`
      );
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (new Date(formData.transaction_date) > new Date()) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Transaction date cannot be in the future' });
      return;
    }

    if (!checkDuplicateInvoice()) {
      return;
    }

    try {
      setLoading(true);

      // Prepare form data
      const submitData = new FormData();
      submitData.append('transaction_type', 'income');
      submitData.append('transaction_date', formData.transaction_date);
      submitData.append('party_name', formData.party_name || 'General Income');
      submitData.append('invoice_number', formData.invoice_number);
      submitData.append('total_amount', formData.total_amount);
      submitData.append('vat_type', formData.vat_type);
      submitData.append('income_type', formData.income_type);
      if (document) {
        submitData.append('document', document);
      }

      const data = await TransactionModel.create(submitData);
      
      // Save invoice number to check for duplicates
      const newInvoices = [...existingInvoices, formData.invoice_number];
      localStorage.setItem('income_invoices', JSON.stringify(newInvoices));

      Swal.fire({ icon: 'success', title: 'Success!', text: 'Income captured successfully', timer: 2000, showConfirmButton: false });
      navigate('/transactions');
    } catch (error: any) {
      console.error('Error creating income:', error);
      if (error.response?.data?.error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.response.data.error });
      } else {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to capture income' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Add Income</h1>
            <p className="text-white/90">Capture a sales invoice for VAT output tax</p>
          </div>
          <BackButton to="/transactions" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* First Row: Date, Customer, Invoice Number */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Transaction Date */}
          <div>
            <CustomDatePicker
              label="Transaction Date"
              required
              value={formData.transaction_date ? new Date(formData.transaction_date) : null}
              onChange={(date) => setFormData({ ...formData, transaction_date: date ? date.toISOString().split('T')[0] : '' })}
            />
          </div>

          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
              <span className="ml-2 text-xs text-gray-500">(Optional)</span>
            </label>
            <select
              className="block w-full px-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-transparent"
              value={formData.party_name}
              onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
            >
              <option value="">Select a customer...</option>
              {customers.map((customer) => (
                <option key={customer.contact_id} value={customer.contact_name}>
                  {customer.contact_name}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Invoice Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="block w-full px-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-transparent"
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              placeholder="Enter your invoice number"
            />
            <p className="mt-1 text-xs text-gray-500">Must be unique for your sales</p>
          </div>
        </div>

        {/* Attach Document */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Attach Your Invoice <span className="text-gray-400 text-xs">(Optional)</span>
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                  <span>Upload a file</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PDF, JPG, PNG up to 5MB</p>
              {document && (
                <p className="text-sm text-green-600 font-medium">✓ {document.name}</p>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">Optional: Attach supporting document for quick reference</p>
        </div>

        {/* Second Row: Total Amount, Income Type, Sale Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Amount (Incl. VAT) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-medium">R</span>
              <input
                type="number"
                required
                step="0.01"
                min="0.01"
                className="block w-full pl-8 pr-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Income Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Income Type
            </label>
            <select
              className="block w-full px-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-transparent"
              value={formData.income_type}
              onChange={(e) => setFormData({ ...formData, income_type: e.target.value })}
            >
              <option value="services">Services</option>
              <option value="goods">Goods/Products</option>
              <option value="consulting">Consulting</option>
              <option value="other">Other Income</option>
            </select>
          </div>

          {/* VAT Output Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sale Type (VAT) <span className="text-red-500">*</span>
            </label>
            <select
              required
              className="block w-full px-4 py-2 rounded-lg border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-transparent"
              value={formData.vat_type}
              onChange={(e) => setFormData({ ...formData, vat_type: e.target.value as any })}
            >
              <option value="standard">Standard-Rated (15%)</option>
              <option value="zero">Zero-Rated (0%)</option>
              <option value="exempt">Exempt</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Determines which box this appears in on the VAT 201 return
            </p>
          </div>
        </div>

        {/* Calculated Fields */}
        <div className="grid grid-cols-2 gap-4 bg-green-50 p-4 rounded-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Output VAT
            </label>
            <div className="text-2xl font-bold text-green-600">
              R {calculatedAmounts.vat.toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 mt-1">VAT to remit to SARS</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exclusive Amount (Income)
            </label>
            <div className="text-2xl font-bold text-gray-900">
              R {calculatedAmounts.exclusive.toFixed(2)}
            </div>
            <p className="text-xs text-gray-600 mt-1">Revenue before VAT</p>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Capture Income'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddIncome;
