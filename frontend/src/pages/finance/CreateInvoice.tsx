import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';
import { InvoiceModel, ContactModel } from '../../models';
import { useAppStore } from '../../store';
import { Invoice, InvoiceItem, Contact, PricingItem } from '../../types';
import { CustomDatePicker, ItemPickerModal } from '../../components/UI';
import { notify } from '../../utils/notify';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

const CreateInvoice: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, setCustomers } = useAppStore();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [customMarkupPercentage, setCustomMarkupPercentage] = useState<number>(25);
  const [useCustomMarkup, setUseCustomMarkup] = useState<boolean>(false); // Toggle custom markup on/off
  const [defaultMarkupPercentage] = useState<number>(25); // Default system markup
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const isEditMode = id && id !== 'new';

  // Form for invoice creation/editing
  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<Invoice>({
    defaultValues: {
      invoice_date: new Date().toISOString().split('T')[0],
      invoice_due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      invoice_status: 0, // Draft
      invoice_payment_status: 0, // Unpaid
      invoice_notes: '',
      items: [{ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchItems = watch('items');
  const watchContactId = watch('invoice_contact_id');

  // Helper function for formatting currency
  const formatCurrency = (amount?: number) => {
    if (!amount) return 'R0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  };

  // Load customers on mount - always load to ensure we have all customers
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        // Request all contacts without pagination limit
        const data = await ContactModel.getAll('customers', { page: 0, limit: 10000 });
        const contacts = Array.isArray(data) ? data : data.data || [];
        setCustomers(contacts);
      } catch (error) {
        console.error('Error loading customers:', error);
        notify.error('Failed to load customers');
      }
    };

    loadCustomers();
  }, [setCustomers]);

  // Load invoice for editing
  useEffect(() => {
    if (isEditMode && id) {
      const fetchInvoice = async () => {
        try {
          setLoading(true);
          const invoice = await InvoiceModel.getById(parseInt(id));
          console.log('Fetched invoice for editing:', invoice);
          
          // Reset form with invoice data - map invoice_valid_until to invoice_due_date
          reset({
            invoice_contact_id: invoice.invoice_contact_id,
            invoice_date: invoice.invoice_date,
            invoice_due_date: invoice.invoice_valid_until || invoice.invoice_due_date, // Backend uses invoice_valid_until
            invoice_status: invoice.invoice_status,
            invoice_payment_status: invoice.invoice_payment_status,
            invoice_notes: invoice.invoice_notes || '',
            items: invoice.items && invoice.items.length > 0 
              ? invoice.items.map((item: any) => ({
                  item_product: item.item_product,
                  item_qty: item.item_qty,
                  item_price: item.item_price,
                  item_cost: item.item_cost || 0,
                  item_subtotal: item.item_subtotal,
                  item_discount: item.item_discount || 0,
                  item_vat: item.item_vat || 0,
                  item_profit: item.item_profit || 0
                }))
              : [{ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }]
          });

          // Set selected contact
          if (invoice.invoice_contact_id && customers.length > 0) {
            const contact = customers.find(c => c.contact_id === invoice.invoice_contact_id);
            setSelectedContact(contact || null);
          }
        } catch (error) {
          console.error('Error fetching invoice:', error);
          notify.error('Failed to load invoice');
          navigate('/invoices');
        } finally {
          setLoading(false);
        }
      };
      fetchInvoice();
    }
  }, [id, isEditMode, customers.length, reset, navigate]);

  // Watch for contact selection changes
  useEffect(() => {
    if (watchContactId && customers.length > 0) {
      const contact = customers.find(c => c.contact_id === Number(watchContactId));
      setSelectedContact(contact || null);
      if (contact) {
        setContactSearchQuery(contact.contact_name);
      }
    }
  }, [watchContactId, customers]);

  // Filter contacts based on search query
  const filteredContacts = customers.filter(contact =>
    contact.contact_name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    (contact.contact_email && contact.contact_email.toLowerCase().includes(contactSearchQuery.toLowerCase())) ||
    (contact.contact_vat && contact.contact_vat.toLowerCase().includes(contactSearchQuery.toLowerCase()))
  );

  const handleSelectContact = (contact: Contact) => {
    setValue('invoice_contact_id', contact.contact_id as any);
    setSelectedContact(contact);
    setContactSearchQuery(contact.contact_name);
    setShowContactDropdown(false);
  };

  const handleContactSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactSearchQuery(e.target.value);
    setShowContactDropdown(true);
    if (!e.target.value) {
      setValue('invoice_contact_id', '' as any);
      setSelectedContact(null);
    }
  };

  // Calculate line item subtotal
  const calculateItemSubtotal = (index: number) => {
    if (!watchItems || !watchItems[index]) return;

    const item = watchItems[index];
    const qty = Number(item.item_qty) || 0;
    const price = Number(item.item_price) || 0;
    const discount = Number(item.item_discount) || 0;

    let subtotal = qty * price;

    // Apply discount as percentage (e.g., 10 = 10%)
    if (discount > 0) {
      subtotal = subtotal * (1 - discount / 100);
    }

    // Calculate profit if cost is provided
    const cost = Number(item.item_cost) || 0;
    const profit = subtotal - (cost * qty);

    setValue(`items.${index}.item_subtotal`, subtotal);
    if (cost > 0) {
      setValue(`items.${index}.item_profit`, profit);
    }
  };

  // Apply markup to all items that have a cost
  const applyMarkupToAllItems = () => {
    if (!watchItems) return;
    
    watchItems.forEach((item, index) => {
      const cost = Number(item.item_cost) || 0;
      if (cost > 0) {
        const markupPercentage = useCustomMarkup ? customMarkupPercentage : defaultMarkupPercentage;
        const sellingPrice = cost * (1 + markupPercentage / 100);
        setValue(`items.${index}.item_price`, Number(sellingPrice.toFixed(2)));
        calculateItemSubtotal(index);
      }
    });
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!watchItems) return { subtotal: 0, vat: 0, total: 0, discount: 0 };

    let subtotal = 0;
    let vat = 0;
    let totalDiscount = 0;

    watchItems.forEach((item: InvoiceItem) => {
      const itemSubtotal = Number(item.item_subtotal) || 0;
      subtotal += itemSubtotal;

      // Calculate VAT if applicable
      if (item.item_vat) {
        vat += itemSubtotal * 0.15;
      }

      // Track discount as percentage
      const qty = Number(item.item_qty) || 0;
      const price = Number(item.item_price) || 0;
      const discount = Number(item.item_discount) || 0;
      if (discount > 0) {
        totalDiscount += (qty * price) * (discount / 100);
      }
    });

    const total = subtotal + vat;

    return { subtotal, vat, total, discount: totalDiscount };
  };

  const totals = calculateTotals();

  // Handle item selection from pricing
  const handleSelectPricingItem = (pricingItem: PricingItem) => {
    if (currentItemIndex !== null) {
      const cost = pricingItem.pricing_price;
      // Use custom markup if enabled, otherwise use default markup
      const markupPercentage = useCustomMarkup ? customMarkupPercentage : defaultMarkupPercentage;
      const sellingPrice = cost * (1 + markupPercentage / 100);

      setValue(`items.${currentItemIndex}.item_product`, pricingItem.pricing_item);
      setValue(`items.${currentItemIndex}.item_cost`, cost);
      setValue(`items.${currentItemIndex}.item_price`, Number(sellingPrice.toFixed(2)));
      calculateItemSubtotal(currentItemIndex);
    }
    setCurrentItemIndex(null);
  };

  const openItemPicker = (index: number) => {
    setCurrentItemIndex(index);
    setItemPickerOpen(true);
  };

  // Recalculate when items change
  useEffect(() => {
    if (watchItems) {
      watchItems.forEach((_, index) => calculateItemSubtotal(index));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchItems)]); // Deep watch for all item changes

  // Apply markup when markup settings change
  useEffect(() => {
    applyMarkupToAllItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCustomMarkup, customMarkupPercentage]);

  // Submit invoice
  const onSubmitInvoice = async (data: Invoice) => {
    try {
      setSaving(true);

      // Prepare data - map invoice_due_date to invoice_valid_until for backend
      const invoiceData = {
        ...data,
        invoice_valid_until: data.invoice_due_date, // Backend uses invoice_valid_until
        invoice_subtotal: totals.subtotal,
        invoice_vat: totals.vat,
        invoice_total: totals.total,
        invoice_discount: totals.discount
      };

      // Remove frontend-only fields that backend doesn't use
      delete (invoiceData as any).invoice_due_date;
      delete (invoiceData as any).invoice_payment_status;
      delete (invoiceData as any).invoice_payment_date;
 

      if (isEditMode && id) {
        // Update existing invoice
        await InvoiceModel.update(parseInt(id), invoiceData);
        notify.success('Invoice updated successfully');
        navigate(`/invoices/${id}`);
      } else {
        // Create new invoice
        const result = await InvoiceModel.create(invoiceData);
        notify.success('Invoice created successfully');
        navigate(`/invoices/${result.id}`);
      }
    } catch (error: any) {
      console.error('Error saving invoice:', error);
      notify.error(error.response?.data?.error || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-picton-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmitInvoice)} className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Invoices
          </button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? 'Edit Invoice' : 'Create New Invoice'}
            </h1>
            <p className="text-white/90 text-sm">
              {isEditMode ? 'Update the invoice details below' : 'Fill in the details below to create an invoice'}
            </p>
          </div>
        </div>

        {/* Customer & Invoice Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Invoice Details</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Customer Selection */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer <span className="text-scarlet">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={handleContactSearchChange}
                    onFocus={() => setShowContactDropdown(true)}
                    onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                    placeholder="Search customers by name, email, or VAT..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                  />
                  <MagnifyingGlassIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
                
                {/* Hidden input to register with react-hook-form */}
                <input
                  type="hidden"
                  {...register('invoice_contact_id', { required: true })}
                />
                
                {showContactDropdown && filteredContacts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredContacts.map((customer) => (
                      <div
                        key={customer.contact_id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectContact(customer);
                        }}
                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="font-medium text-gray-900">{customer.contact_name}</div>
                        {customer.contact_email && (
                          <div className="text-sm text-gray-500">{customer.contact_email}</div>
                        )}
                        {customer.contact_vat && (
                          <div className="text-xs text-gray-400">VAT: {customer.contact_vat}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {errors.invoice_contact_id && (
                  <p className="mt-1 text-sm text-scarlet">Customer is required</p>
                )}

                {/* Display selected customer details */}
                {selectedContact && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2">
                    <p className="text-sm text-gray-700">
                      <strong>Address:</strong> {selectedContact.contact_address || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Phone:</strong> {selectedContact.contact_phone || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Email:</strong> {selectedContact.contact_email || 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>VAT:</strong> {selectedContact.contact_vat || 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              {/* Right column: dates, status, and notes */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Controller
                    name="invoice_date"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <CustomDatePicker
                        label="Invoice Date"
                        required
                        value={field.value ? new Date(field.value) : null}
                        onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                        error={errors.invoice_date ? 'Date is required' : undefined}
                      />
                    )}
                  />

                  <Controller
                    name="invoice_due_date"
                    control={control}
                    rules={{ required: true }}
                    render={({ field }) => (
                      <CustomDatePicker
                        label="Due Date"
                        required
                        value={field.value ? new Date(field.value) : null}
                        onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                        error={errors.invoice_due_date ? 'Due date is required' : undefined}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Status
                  </label>
                  <select
                    {...register('invoice_payment_status')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                  >
                    <option value="0">Unpaid</option>
                    <option value="1">Partially Paid</option>
                    <option value="2">Paid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    {...register('invoice_notes')}
                    rows={2}
                    placeholder="Add any notes or payment terms..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {useCustomMarkup ? 'Custom Markup' : `Default Markup (${defaultMarkupPercentage}%)`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUseCustomMarkup(!useCustomMarkup)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-picton-blue focus:ring-offset-2 ${
                      useCustomMarkup ? 'bg-picton-blue' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useCustomMarkup ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  {useCustomMarkup && (
                    <input
                      type="number"
                      value={customMarkupPercentage}
                      onChange={(e) => setCustomMarkupPercentage(Number(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue"
                      placeholder="%"
                    />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => append({ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 })}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 rounded-lg transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Item
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description *</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-32">Cost</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase w-16">VAT</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-32">Price *</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-24">Qty *</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-32">Discount %</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase w-32">Subtotal</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fields.map((field, index) => (
                  <tr key={field.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openItemPicker(index)}
                          className="flex-shrink-0 p-1.5 text-picton-blue hover:bg-picton-blue/10 rounded transition-colors"
                          title="Select from pricing"
                        >
                          <MagnifyingGlassIcon className="h-5 w-5" />
                        </button>
                        <input
                          {...register(`items.${index}.item_product`, { required: true })}
                          placeholder="Item description or search..."
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue focus:border-transparent"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.item_cost`)}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        {...register(`items.${index}.item_vat`)}
                        className="w-4 h-4 text-picton-blue border-gray-300 rounded focus:ring-picton-blue"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.item_price`, { required: true, min: 0 })}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        {...register(`items.${index}.item_qty`, { required: true, min: 1 })}
                        placeholder="1"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...register(`items.${index}.item_discount`)}
                        placeholder="0"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(watchItems?.[index]?.item_subtotal || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1 text-scarlet hover:bg-scarlet/10 rounded transition-colors"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="bg-gray-50 p-6 border-t border-gray-200">
            <div className="max-w-md ml-auto space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-semibold text-scarlet">-{formatCurrency(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">VAT (15%):</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totals.vat)}</span>
              </div>
              <div className="flex justify-between text-lg border-t pt-3 border-gray-300">
                <span className="font-bold text-gray-900">Total:</span>
                <span className="font-bold text-picton-blue">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving 
              ? (isEditMode ? 'Updating Invoice...' : 'Creating Invoice...') 
              : (isEditMode ? 'Update Invoice' : 'Create Invoice')
            }
          </button>
        </div>
      </form>

      {/* Item Picker Modal */}
      <ItemPickerModal
        isOpen={itemPickerOpen}
        onClose={() => {
          setItemPickerOpen(false);
          setCurrentItemIndex(null);
        }}
        onSelectItem={handleSelectPricingItem}
      />
    </div>
  );
};

export default CreateInvoice;
