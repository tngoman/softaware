import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';
import { CreditNoteModel, type CreditNote, type CreditNoteItem } from '../../models/CreditNoteModel';
import { ContactModel } from '../../models';
import { useAppStore } from '../../store';
import { Contact, PricingItem } from '../../types';
import { CustomDatePicker, ItemPickerModal } from '../../components/UI';
import { notify } from '../../utils/notify';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

interface CreditNoteForm {
  contact_id: number;
  credit_note_date: string;
  reason: string;
  remarks: string;
  items: CreditNoteItem[];
}

const CreateCreditNote: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, setCustomers } = useAppStore();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const isEditMode = id && id !== 'new';

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreditNoteForm>({
    defaultValues: {
      credit_note_date: new Date().toISOString().split('T')[0],
      reason: '',
      remarks: '',
      items: [{ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchItems = watch('items');
  const watchContactId = watch('contact_id');

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'R0.00';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  };

  // Load customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
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

  // Load credit note for editing
  useEffect(() => {
    if (isEditMode && id) {
      const fetchCreditNote = async () => {
        try {
          setLoading(true);
          const cn = await CreditNoteModel.getById(parseInt(id));

          reset({
            contact_id: cn.contact_id,
            credit_note_date: cn.credit_note_date,
            reason: cn.reason || '',
            remarks: cn.remarks || '',
            items: cn.items && cn.items.length > 0
              ? cn.items.map((item: any) => ({
                  item_product: item.item_product,
                  item_qty: parseFloat(String(item.item_qty)) || 1,
                  item_price: parseFloat(String(item.item_price)) || 0,
                  item_cost: item.item_cost != null ? parseFloat(String(item.item_cost)) : 0,
                  item_subtotal: parseFloat(String(item.item_subtotal)) || 0,
                  item_discount: parseFloat(String(item.item_discount)) || 0,
                  item_vat: item.item_vat === 1 ? 1 : 0,
                }))
              : [{ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }]
          });

          if (cn.contact_id && customers.length > 0) {
            const contact = customers.find(c => c.contact_id === cn.contact_id);
            setSelectedContact(contact || null);
            if (contact) setContactSearchQuery(contact.contact_name);
          }
        } catch (error) {
          console.error('Error fetching credit note:', error);
          notify.error('Failed to load credit note');
          navigate('/credit-notes');
        } finally {
          setLoading(false);
        }
      };
      fetchCreditNote();
    }
  }, [id, isEditMode, customers.length, reset, navigate]);

  // Watch for contact selection changes
  useEffect(() => {
    if (watchContactId && customers.length > 0) {
      const contact = customers.find(c => c.contact_id === Number(watchContactId));
      setSelectedContact(contact || null);
      if (contact) setContactSearchQuery(contact.contact_name);
    }
  }, [watchContactId, customers]);

  const filteredContacts = customers.filter(contact =>
    contact.contact_name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    (contact.contact_email && contact.contact_email.toLowerCase().includes(contactSearchQuery.toLowerCase())) ||
    (contact.contact_vat && contact.contact_vat.toLowerCase().includes(contactSearchQuery.toLowerCase()))
  );

  const handleSelectContact = (contact: Contact) => {
    setValue('contact_id', contact.contact_id as any);
    setSelectedContact(contact);
    setContactSearchQuery(contact.contact_name);
    setShowContactDropdown(false);
  };

  const handleContactSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactSearchQuery(e.target.value);
    setShowContactDropdown(true);
    if (!e.target.value) {
      setValue('contact_id', '' as any);
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
    if (discount > 0) {
      subtotal = subtotal * (1 - discount / 100);
    }

    setValue(`items.${index}.item_subtotal`, subtotal);
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!watchItems) return { subtotal: 0, vat: 0, total: 0, discount: 0 };

    let subtotal = 0;
    let vat = 0;
    let totalDiscount = 0;

    watchItems.forEach((item: CreditNoteItem) => {
      const itemSubtotal = Number(item.item_subtotal) || 0;
      subtotal += itemSubtotal;

      if (item.item_vat) {
        vat += itemSubtotal * 0.15;
      }

      const qty = Number(item.item_qty) || 0;
      const price = Number(item.item_price) || 0;
      const disc = Number(item.item_discount) || 0;
      if (disc > 0) {
        totalDiscount += (qty * price) * (disc / 100);
      }
    });

    const total = subtotal + vat;
    return { subtotal, vat, total, discount: totalDiscount };
  };

  const totals = calculateTotals();

  // Handle item selection from pricing
  const handleSelectPricingItem = (pricingItem: PricingItem) => {
    if (currentItemIndex !== null) {
      setValue(`items.${currentItemIndex}.item_product`, pricingItem.pricing_item);
      setValue(`items.${currentItemIndex}.item_cost`, pricingItem.pricing_price);
      setValue(`items.${currentItemIndex}.item_price`, pricingItem.pricing_price);
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
  }, [JSON.stringify(watchItems)]);

  // Submit credit note
  const onSubmit = async (data: CreditNoteForm) => {
    try {
      setSaving(true);

      const creditNoteData: Partial<CreditNote> = {
        contact_id: Number(data.contact_id),
        credit_note_date: data.credit_note_date,
        credit_note_total: totals.total,
        credit_note_subtotal: totals.subtotal,
        credit_note_vat: totals.vat,
        reason: data.reason || undefined,
        remarks: data.remarks || undefined,
        items: (data.items || []).map((item: CreditNoteItem) => ({
          item_product: item.item_product,
          item_qty: Number(item.item_qty) || 1,
          item_price: Number(item.item_price) || 0,
          item_cost: Number(item.item_cost) || 0,
          item_discount: Number(item.item_discount) || 0,
          item_subtotal: Number(item.item_subtotal) || 0,
          item_vat: item.item_vat ? 1 : 0,
        }))
      };

      if (isEditMode && id) {
        await CreditNoteModel.update(parseInt(id), creditNoteData);
        notify.success('Credit note updated successfully');
        navigate(`/credit-notes/${id}`);
      } else {
        const result = await CreditNoteModel.create(creditNoteData);
        notify.success('Credit note created successfully');
        navigate(`/credit-notes/${result.id || result.data?.credit_note_id}`);
      }
    } catch (error: any) {
      console.error('Error saving credit note:', error);
      notify.error(error.response?.data?.error || 'Failed to save credit note');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading credit note...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl shadow-lg p-6 text-white">
          <button
            type="button"
            onClick={() => navigate('/credit-notes')}
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Credit Notes
          </button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? `Edit Credit Note #${String(id).padStart(5, '0')}` : 'Create Credit Note'}
            </h1>
            <p className="text-white/90 text-sm">
              {isEditMode ? 'Update the credit note details below' : 'Fill in the details below to create a credit note'}
            </p>
          </div>
        </div>

        {/* Customer & Credit Note Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Credit Note Details</h3>
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <MagnifyingGlassIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>

                <input
                  type="hidden"
                  {...register('contact_id', { required: true })}
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

                {errors.contact_id && (
                  <p className="mt-1 text-sm text-scarlet">Customer is required</p>
                )}

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
                  </div>
                )}
              </div>

              {/* Right column: date, reason, remarks */}
              <div className="space-y-4">
                <Controller
                  name="credit_note_date"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <CustomDatePicker
                      label="Credit Note Date"
                      required
                      value={field.value ? new Date(field.value) : null}
                      onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                      error={errors.credit_note_date ? 'Date is required' : undefined}
                    />
                  )}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason
                  </label>
                  <input
                    type="text"
                    {...register('reason')}
                    placeholder="Reason for credit note..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks / Notes
                  </label>
                  <textarea
                    {...register('remarks')}
                    rows={2}
                    placeholder="Additional notes..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
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
                          className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Select from pricing"
                        >
                          <MagnifyingGlassIcon className="h-5 w-5" />
                        </button>
                        <input
                          {...register(`items.${index}.item_product`, { required: true })}
                          placeholder="Item description..."
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        {...register(`items.${index}.item_vat`)}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.item_price`, { required: true, min: 0 })}
                        placeholder="0.00"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        {...register(`items.${index}.item_qty`, { required: true, min: 1 })}
                        placeholder="1"
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
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
                        className="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
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

          {/* Add Item Button */}
          <div className="px-6 py-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => append({ item_product: '', item_qty: 1, item_price: 0, item_cost: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 })}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add Item
            </button>
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
                <span className="font-bold text-red-600">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/credit-notes')}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving
              ? (isEditMode ? 'Updating...' : 'Creating...')
              : (isEditMode ? 'Update Credit Note' : 'Create Credit Note')
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

export default CreateCreditNote;
