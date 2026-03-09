import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentArrowUpIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { TransactionModel, ExpenseCategoryModel, ContactModel, InvoiceModel } from '../../models';
import { ExpenseCategory, Contact } from '../../types';
import { Input, Select, Button, Card, BackButton, CustomDatePicker } from '../../components/UI';
import { formatCurrency } from '../../utils/formatters';
import { notify } from '../../utils/notify';

const AddExpense: React.FC = () => {
  const navigate = useNavigate();
  
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    party_name: '',
    party_vat_number: '',
    invoice_number: '',
    total_amount: '',
    expense_category_id: '',
    vat_type: 'standard' as 'standard' | 'zero' | 'exempt' | 'non-vat',
    transaction_invoice_id: '',
  });
  
  const [document, setDocument] = useState<File | null>(null);
  const [vatValidation, setVatValidation] = useState({ valid: true, message: '' });
  const [calculatedAmounts, setCalculatedAmounts] = useState({ vat: 0, exclusive: 0 });

  useEffect(() => {
    loadCategories();
    loadSuppliers();
    loadInvoices();
  }, []);

  useEffect(() => {
    // Calculate VAT amounts when total_amount or vat_type changes
    calculateVat();
  }, [formData.total_amount, formData.vat_type]);

  useEffect(() => {
    // Update VAT type based on category and VAT number
    updateVatType();
  }, [formData.expense_category_id, formData.party_vat_number]);

  const loadCategories = async () => {
    try {
      const data = await ExpenseCategoryModel.getAll();
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        setCategories((data as any).data || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      notify.error('Failed to load expense categories');
      setCategories([]);
    }
  };

  const loadSuppliers = async () => {
    try {
      const data = await ContactModel.getAll('suppliers', {
        page: 0,
        limit: 1000,
        sortBy: 'contact_name',
        sortOrder: 'asc'
      });
      // data contains the API response: {data: Contact[], pagination: {...}} or Contact[]
      if (Array.isArray(data)) {
        setSuppliers(data);
      } else {
        setSuppliers((data as any).data);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
      notify.error('Failed to load suppliers');
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await InvoiceModel.getAll({
        page: 0,
        limit: 1000,
        sortBy: 'invoice_date',
        sortOrder: 'desc'
      });

      const invoiceList = Array.isArray(data) ? data : (data as any).data || [];
      setInvoices(invoiceList);
    } catch (error) {
      console.error('Error loading invoices:', error);
      // Non-critical - user can still create expense without linking to invoice
      setInvoices([]);
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

  const updateVatType = () => {
    const category = Array.isArray(categories) ? categories.find(c => c.category_id === parseInt(formData.expense_category_id)) : null;
    
    // If no VAT number, force non-vat
    if (!formData.party_vat_number && formData.vat_type !== 'non-vat') {
      setFormData(prev => ({ ...prev, vat_type: 'non-vat' }));
      return;
    }
    
    // If category doesn't allow VAT claim (e.g., Entertainment), force non-vat
    if (category && category.allows_vat_claim === 0 && formData.vat_type !== 'non-vat') {
      setFormData(prev => ({ ...prev, vat_type: 'non-vat' }));
      return;
    }
  };

  const validateVatNumber = (value: string) => {
    if (!value) {
      setVatValidation({ valid: true, message: '' });
      return true;
    }

    const cleaned = value.replace(/\s+/g, '');
    if (!/^4\d{9}$/.test(cleaned)) {
      setVatValidation({
        valid: false,
        message: 'Invalid VAT number format. Must be 10 digits and start with a 4.'
      });
      return false;
    }

    setVatValidation({ valid: true, message: '' });
    return true;
  };

  const handleVatNumberChange = (value: string) => {
    setFormData({ ...formData, party_vat_number: value });
    validateVatNumber(value);
  };

  const handleSupplierChange = (value: string) => {
    const selectedSupplier = suppliers.find(supplier => supplier.contact_name === value);
    
    if (selectedSupplier) {
      setFormData({ 
        ...formData, 
        party_name: value,
        party_vat_number: selectedSupplier.contact_vat || ''
      });
      
      // Validate VAT number if auto-populated
      if (selectedSupplier.contact_vat) {
        validateVatNumber(selectedSupplier.contact_vat);
      }
    } else {
      setFormData({ ...formData, party_name: value });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        notify.error('File too large (max 5MB)');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        notify.error('Invalid file type. Only PDF, JPG, and PNG allowed');
        return;
      }
      
      setDocument(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!vatValidation.valid) {
      notify.error('Please correct the VAT number');
      return;
    }
    
    if (new Date(formData.transaction_date) > new Date()) {
      notify.error('Transaction date cannot be in the future');
      return;
    }

    try {
      setLoading(true);

      // Prepare form data
      const submitData = new FormData();
      submitData.append('transaction_type', 'expense');
      submitData.append('transaction_date', formData.transaction_date);
      submitData.append('party_name', formData.party_name);
      submitData.append('party_vat_number', formData.party_vat_number);
      submitData.append('invoice_number', formData.invoice_number);
      submitData.append('total_amount', formData.total_amount);
      submitData.append('expense_category_id', formData.expense_category_id);
      submitData.append('vat_type', formData.vat_type);
      if (formData.transaction_invoice_id) {
        submitData.append('transaction_invoice_id', formData.transaction_invoice_id);
      }
      if (document) {
        submitData.append('document', document);
      }

      const data = await TransactionModel.create(submitData);
      
      // No need to save supplier names anymore - they come from database

      notify.success('Expense captured successfully');
      navigate('/transactions');
    } catch (error: any) {
      console.error('Error creating expense:', error);
      if (error.response?.data?.error) {
        notify.error(error.response.data.error);
      } else if (error.response?.data?.warning) {
        // Duplicate warning
        if (window.confirm(error.response.data.warning + ' Do you want to continue?')) {
          // Could retry or handle differently
        }
      } else {
        notify.error('Failed to capture expense');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = Array.isArray(categories) ? categories.find(c => c.category_id === parseInt(formData.expense_category_id)) : null;
  const vatTypeDisabled = !formData.party_vat_number || (selectedCategory && selectedCategory.allows_vat_claim === 0) || false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Add Expense</h1>
            <p className="text-white/90">Capture a supplier invoice for VAT input tax claim</p>
          </div>
          <BackButton to="/transactions" />
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomDatePicker
              label="Transaction Date"
              required
              value={formData.transaction_date ? new Date(formData.transaction_date) : null}
              onChange={(date) => setFormData({ ...formData, transaction_date: date ? date.toISOString().split('T')[0] : '' })}
            />

            <Select
              label="Supplier Name"
              required
              value={formData.party_name}
              onChange={(e) => handleSupplierChange(e.target.value)}
            >
              <option value="">Select a supplier...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.contact_id} value={supplier.contact_name}>
                  {supplier.contact_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Supplier VAT Number"
              type="text"
              maxLength={10}
              value={formData.party_vat_number}
              onChange={(e) => handleVatNumberChange(e.target.value)}
              placeholder="4123456789"
              helperText="Leave blank if not a VAT vendor"
              error={!vatValidation.valid ? vatValidation.message : undefined}
            />

            <Input
              label="Supplier Invoice Number"
              type="text"
              required
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              placeholder="Enter supplier's invoice number"
              startIcon={<DocumentTextIcon />}
            />
          </div>

          {/* Job Costing - Link to Customer Invoice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link to Customer Invoice <span className="text-gray-400 text-xs">(Optional - for job costing)</span>
            </label>
            <Select
              label=""
              value={formData.transaction_invoice_id}
              onChange={(e) => setFormData({ ...formData, transaction_invoice_id: e.target.value })}
              helperText="Select if this expense is for a specific customer job/invoice (COGS). Leave blank for general business expenses (Operating Expenses)."
            >
              <option value="">General Business Expense (not job-specific)</option>
              {invoices.map((inv: any) => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  Invoice #{inv.invoice_id} - {inv.contact_name || 'Unknown Customer'} - {formatCurrency(parseFloat(inv.invoice_total || 0))} ({inv.invoice_date})
                </option>
              ))}
            </Select>
          </div>

        {/* Attach Document */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Attach Invoice / Receipt <span className="text-gray-400 text-xs">(Optional)</span>
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
          <p className="mt-1 text-xs text-gray-500">Optional: Attach supporting document for your records</p>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Total Amount (Incl. VAT)"
              type="number"
              required
              step="0.01"
              min="0.01"
              value={formData.total_amount}
              onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
              placeholder="0.00"
              startIcon={<span className="text-gray-500 font-medium">R</span>}
            />

            <Select
              label="Expense Category (for Income Tax)"
              required
              value={formData.expense_category_id}
              onChange={(e) => setFormData({ ...formData, expense_category_id: e.target.value })}
              helperText="Maps to ITR14 tax return categories"
            >
              <option value="">Select a category...</option>
              {Object.entries(
                categories.reduce((groups, cat) => {
                  const group = cat.category_group || 'Other';
                  if (!groups[group]) groups[group] = [];
                  groups[group].push(cat);
                  return groups;
                }, {} as Record<string, ExpenseCategory[]>)
              ).map(([groupName, groupCategories]) => (
                <optgroup key={groupName} label={groupName}>
                  {groupCategories.map(cat => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name} {cat.allows_vat_claim === 0 && '(No VAT claim)'}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <Select
            label="VAT Claim Type"
            required
            disabled={vatTypeDisabled}
            value={formData.vat_type}
            onChange={(e) => setFormData({ ...formData, vat_type: e.target.value as any })}
            helperText={vatTypeDisabled ? 
              (!formData.party_vat_number ? 'No VAT number provided - locked to Non-VAT' : 
               selectedCategory && selectedCategory.allows_vat_claim === 0 ? 'This category does not allow VAT claims' : '') 
              : undefined}
          >
            <option value="standard">Standard-Rated (15%)</option>
            <option value="zero">Zero-Rated (0%)</option>
            <option value="exempt">Exempt</option>
            <option value="non-vat">Non-VAT Transaction</option>
          </Select>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 mb-2">VAT to Claim</div>
              <div className="text-3xl font-bold text-blue-600">
                R {calculatedAmounts.vat.toFixed(2)}
              </div>
              <p className="text-xs text-gray-600 mt-1">Check against invoice VAT</p>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-700 mb-2">Exclusive Amount (for ITR14)</div>
              <div className="text-3xl font-bold text-gray-900">
                R {calculatedAmounts.exclusive.toFixed(2)}
              </div>
              <p className="text-xs text-gray-600 mt-1">Amount before VAT</p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/transactions')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !vatValidation.valid}
              loading={loading}
              startIcon={!loading ? <PlusIcon className="h-4 w-4" /> : undefined}
            >
              {loading ? 'Saving...' : 'Capture Expense'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AddExpense;
