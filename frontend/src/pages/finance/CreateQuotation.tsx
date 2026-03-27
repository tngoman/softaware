import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { QuotationModel, ContactModel } from '../../models';
import AppSettingsModel from '../../models/AppSettingsModel';
import { useAppStore } from '../../store';
import { Quotation, QuoteItem, Contact, PricingItem } from '../../types';
import { CustomDatePicker, ItemPickerModal } from '../../components/UI';
import { formatCurrency } from '../../utils/formatters';
import { notify } from '../../utils/notify';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

const CreateQuotation: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, setCustomers } = useAppStore();
  
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [markupPercentage, setMarkupPercentage] = useState<number>(25); // Default 25%
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  
  const isEditMode = id && id !== 'new';

  // Form for quotation creation/editing
  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<Quotation>({
    defaultValues: {
      quotation_date: new Date().toISOString().split('T')[0],
      quotation_valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quotation_status: 0,
      terms_type: 'ppe' as const,
      qty_label: 'qty' as const,
      quotation_notes: '',
      items: [{ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchItems = watch('items');
  const watchContactId = watch('quotation_contact_id');

  useEffect(() => {
    loadCustomers();
    loadMarkupPercentage();
    
    // Load existing quotation if editing
    if (isEditMode) {
      loadQuotation();
    }
  }, []);

  // Load markup percentage from settings
  const loadMarkupPercentage = async () => {
    try {
      const settings = await AppSettingsModel.get();
      const markup = parseFloat(settings.default_markup_percentage || '25');
      setMarkupPercentage(markup);
    } catch (error) {
      console.error('Error loading markup percentage:', error);
      // Keep default of 25%
    }
  };

  const loadCustomers = async () => {
    try {
      // Request all contacts without pagination limit
      const data = await ContactModel.getAll('customers', { page: 0, limit: 10000 });
      const items = Array.isArray(data) ? data : data.data;
      setCustomers(items);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadQuotation = async () => {
    if (!id || id === 'new') return;
    
    try {
      setLoading(true);
      const quotation = await QuotationModel.getById(parseInt(id));
      
      // Reset form with existing quotation data
      reset({
        quotation_contact_id: quotation.quotation_contact_id,
        quotation_date: quotation.quotation_date,
        quotation_valid_until: quotation.quotation_valid_until,
        quotation_status: quotation.quotation_status,
        terms_type: quotation.terms_type || 'ppe',
        qty_label: quotation.qty_label || 'qty',
        quotation_notes: quotation.quotation_notes || '',
        items: quotation.items && quotation.items.length > 0 
          ? quotation.items.map((item: any) => ({
              ...item,
              item_qty: parseFloat(String(item.item_qty)) || 1,
              item_price: parseFloat(String(item.item_price)) || 0,
              item_cost: item.item_cost != null ? parseFloat(String(item.item_cost)) : 0,
              item_discount: parseFloat(String(item.item_discount)) || 0,
              item_subtotal: parseFloat(String(item.item_subtotal)) || 0,
              item_vat: item.item_vat === 1 ? 1 : 0,
            }))
          : [{ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }]
      });
    } catch (error) {
      console.error('Error loading quotation:', error);
      notify.error('Failed to load quotation');
      navigate('/quotations');
    } finally {
      setLoading(false);
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
    
    // Discount is always in percentage
    if (discount > 0 && discount <= 100) {
      subtotal = subtotal * (1 - discount / 100);
    }

    // Calculate profit if cost is provided
    const cost = Number(item.item_cost) || 0;
    const profit = subtotal - (cost * qty);

    // Round to 2 decimal places and ensure it's a number
    setValue(`items.${index}.item_subtotal`, Number(subtotal.toFixed(2)));
    if (cost > 0) {
      setValue(`items.${index}.item_profit`, Number(profit.toFixed(2)));
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!watchItems) return { subtotal: 0, vat: 0, total: 0, discount: 0 };

    let subtotal = 0;
    let vat = 0;
    let totalDiscount = 0;

    watchItems.forEach((item: QuoteItem) => {
      const itemSubtotal = parseFloat(String(item.item_subtotal)) || 0;
      subtotal += itemSubtotal;

      // Calculate VAT if applicable
      if (item.item_vat) {
        vat += itemSubtotal * 0.15;
      }

      // Track discount (percentage based)
      const qty = parseFloat(String(item.item_qty)) || 0;
      const price = parseFloat(String(item.item_price)) || 0;
      const discount = parseFloat(String(item.item_discount)) || 0;
      if (discount > 0 && discount <= 100) {
        totalDiscount += (qty * price) * (discount / 100);
      }
    });

    const total = subtotal + vat;

    return { 
      subtotal: Number(subtotal.toFixed(2)), 
      vat: Number(vat.toFixed(2)), 
      total: Number(total.toFixed(2)), 
      discount: Number(totalDiscount.toFixed(2)) 
    };
  };

  const totals = calculateTotals();

  // Handle item selection from pricing
  const handleSelectPricingItem = (pricingItem: PricingItem) => {
    if (currentItemIndex !== null) {
      const cost = pricingItem.pricing_price;
      // Calculate selling price with margin-based markup: price = (cost * 100) / (100 - markup%)
      const sellingPrice = (cost * 100) / (100 - markupPercentage);
      
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
    setValue('quotation_contact_id', contact.contact_id as any);
    setSelectedContact(contact);
    setContactSearchQuery(contact.contact_name);
    setShowContactDropdown(false);
  };

  const handleContactSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactSearchQuery(e.target.value);
    setShowContactDropdown(true);
    if (!e.target.value) {
      setValue('quotation_contact_id', '' as any);
      setSelectedContact(null);
    }
  };

  // Recalculate when items change
  useEffect(() => {
    if (watchItems) {
      watchItems.forEach((_, index) => calculateItemSubtotal(index));
    }
  }, [JSON.stringify(watchItems)]); // Deep watch for all item changes including VAT checkbox

  // Handle form submission
  const onSubmit = async (data: Quotation) => {
    try {
      setSaving(true);

      // Calculate totals
      const totals = calculateTotals();
      
      // Prepare quotation data with proper type conversion
      const quotationData = {
        ...data,
        quotation_contact_id: Number(data.quotation_contact_id),
        quotation_subtotal: Number(totals.subtotal),
        quotation_discount: Number(totals.discount),
        quotation_vat: Number(totals.vat),
        quotation_total: Number(totals.total),
        quotation_status: Number(data.quotation_status),
        // Convert all numeric fields and ensure items array exists
        items: (data.items || []).map((item: QuoteItem) => ({
          ...item,
          item_qty: Number(item.item_qty) || 1,
          item_price: Number(item.item_price) || 0,
          item_cost: Number(item.item_cost) || 0,
          item_discount: Number(item.item_discount) || 0,
          item_subtotal: Number(item.item_subtotal) || 0,
          item_profit: Number(item.item_profit) || 0,
          item_vat: item.item_vat ? 1 : 0,
        }))
      };

      if (isEditMode && id) {
        // Update existing quotation
        await QuotationModel.update(parseInt(id), quotationData);
        notify.success('Quotation updated successfully');
      } else {
        // Create new quotation
        const result = await QuotationModel.create(quotationData);
        notify.success('Quotation created successfully');
        
        // Navigate to the newly created quotation
        if (result?.data?.quotation_id) {
          navigate(`/quotations/${result.data.quotation_id}`);
        } else {
          navigate('/quotations');
        }
        return;
      }
      
      // Navigate back to quotations list (for updates)
      navigate('/quotations');
    } catch (error: any) {
      console.error('Error saving quotation:', error);
      notify.error(error.response?.data?.error || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-picton-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => navigate('/quotations')}
              className="inline-flex items-center text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Quotations
            </button>
          </div>
          <h1 className="text-3xl font-bold">
            {isEditMode ? `Edit Quotation #${String(id).padStart(5, '0')}` : 'Create New Quotation'}
          </h1>
          <p className="text-white/90 mt-2">
            {isEditMode ? 'Update the quotation details below' : 'Fill in the details below to create a new quotation'}
          </p>
        </div>

        {/* Customer and Quotation Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Customer Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
              
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Customer *
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
                  {...register('quotation_contact_id', { required: true })}
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
                
                {errors.quotation_contact_id && (
                  <p className="mt-1 text-sm text-scarlet">Customer is required</p>
                )}
              </div>

              {selectedContact && (
                <div className="bg-non-photo-blue/20 rounded-lg p-4 space-y-2 text-sm">
                  {selectedContact.contact_address && (
                    <p className="text-gray-700">
                      <span className="font-medium">Address:</span> {selectedContact.contact_address}
                    </p>
                  )}
                  {selectedContact.contact_phone && (
                    <p className="text-gray-700">
                      <span className="font-medium">Phone:</span> {selectedContact.contact_phone}
                    </p>
                  )}
                  {selectedContact.contact_email && (
                    <p className="text-gray-700">
                      <span className="font-medium">Email:</span> {selectedContact.contact_email}
                    </p>
                  )}
                  {selectedContact.contact_vat && (
                    <p className="text-gray-700">
                      <span className="font-medium">VAT:</span> {selectedContact.contact_vat}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right: Quotation Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quotation Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="quotation_date"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <CustomDatePicker
                      label="Quotation Date"
                      required
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                      error={errors.quotation_date ? 'Date is required' : undefined}
                    />
                  )}
                />

                <Controller
                  name="quotation_valid_until"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <CustomDatePicker
                      label="Valid Until"
                      required
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                      error={errors.quotation_valid_until ? 'Valid until date is required' : undefined}
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  {...register('quotation_status')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                >
                  <option value="0">Draft</option>
                  <option value="1">Sent</option>
                </select>
              </div>

            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
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
                        onChange={(e) => {
                          // Update the cost value
                          setValue(`items.${index}.item_cost`, Number(e.target.value) || 0);
                          
                          // Recalculate selling price with margin-based markup: price = (cost * 100) / (100 - markup%)
                          const cost = Number(e.target.value) || 0;
                          if (cost > 0) {
                            const sellingPrice = (cost * 100) / (100 - markupPercentage);
                            setValue(`items.${index}.item_price`, Number(sellingPrice.toFixed(2)));
                          }
                          
                          // Recalculate subtotal
                          calculateItemSubtotal(index);
                        }}
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
                        {...register(`items.${index}.item_discount`)}
                        placeholder="0"
                        min="0"
                        max="100"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-picton-blue focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(watchItems?.[index]?.item_subtotal || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-scarlet hover:text-scarlet/80"
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

          {/* Add Item Button */}
          <div className="px-6 py-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => append({ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 })}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 rounded-lg transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Item
            </button>
          </div>

          {/* Totals & Notes */}
          <div className="border-t-2 border-gray-200 bg-gray-50 p-6 flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  {...register('quotation_notes')}
                  rows={3}
                  placeholder="Order number, reference, delivery instructions..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Terms &amp; Conditions
                  </label>
                  <select
                    {...register('terms_type')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                  >
                    <option value="ppe">PPE Terms</option>
                    <option value="web">Web Services Terms</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Global T&amp;Cs from Settings are used on the PDF</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity Label (PDF)
                  </label>
                  <select
                    {...register('qty_label')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent"
                  >
                    <option value="qty">QTY</option>
                    <option value="hours">Hours</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="w-full lg:w-96 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">Subtotal:</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Discount:</span>
                  <span className="text-scarlet font-semibold">-{formatCurrency(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 font-medium">VAT (15%):</span>
                <span className="text-gray-900 font-semibold">{formatCurrency(totals.vat)}</span>
              </div>
              <div className="pt-3 border-t-2 border-picton-blue/30">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-picton-blue">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/quotations')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 font-medium shadow-md transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Quotation'}
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

export default CreateQuotation;
