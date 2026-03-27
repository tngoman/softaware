import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, TrashIcon } from '@heroicons/react/24/outline';
import { PurchaseOrderModel, ContactModel } from '../../models';
import { useAppStore } from '../../store';
import { PurchaseOrder, PurchaseOrderItem, Contact, PricingItem } from '../../types';
import { CustomDatePicker, ItemPickerModal } from '../../components/UI';
import { notify } from '../../utils/notify';
import { useForm, useFieldArray, Controller } from 'react-hook-form';

const CreatePurchaseOrder: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { suppliers, setSuppliers } = useAppStore();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const isEditMode = id && id !== 'new';

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<PurchaseOrder>({
    defaultValues: {
      po_date: new Date().toISOString().split('T')[0],
      po_due_date: '',
      po_status: 0,
      po_notes: '',
      items: [{ item_product: '', item_qty: 1, item_cost: 0, item_price: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchItems = watch('items');
  const watchContactId = watch('po_contact_id');

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'R0.00';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(amount);
  };

  // Load suppliers on mount
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await ContactModel.getAll('suppliers', { page: 0, limit: 10000 });
        const contacts = Array.isArray(data) ? data : data.data || [];
        setSuppliers(contacts);
      } catch (error) {
        console.error('Error loading suppliers:', error);
        notify.error('Failed to load suppliers');
      }
    };
    loadSuppliers();
  }, [setSuppliers]);

  // Load PO for editing
  useEffect(() => {
    if (isEditMode && id) {
      const fetchPO = async () => {
        try {
          setLoading(true);
          const po = await PurchaseOrderModel.getById(parseInt(id));
          reset({
            po_contact_id: po.po_contact_id,
            po_date: po.po_date,
            po_due_date: po.po_due_date || '',
            po_status: po.po_status,
            po_notes: po.po_notes || '',
            items: po.items && po.items.length > 0
              ? po.items.map((item: any) => ({
                  item_product: item.item_product,
                  item_qty: parseFloat(String(item.item_qty)) || 1,
                  item_cost: parseFloat(String(item.item_cost)) || 0,
                  item_price: parseFloat(String(item.item_price)) || 0,
                  item_subtotal: parseFloat(String(item.item_subtotal)) || 0,
                  item_discount: parseFloat(String(item.item_discount)) || 0,
                  item_vat: item.item_vat === 1 ? 1 : 0,
                }))
              : [{ item_product: '', item_qty: 1, item_cost: 0, item_price: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 }],
          });

          // Set selected contact for display
          if (po.contact_name) {
            setContactSearchQuery(po.contact_name);
            setSelectedContact({
              contact_id: po.po_contact_id,
              contact_name: po.contact_name,
              contact_email: po.contact_email,
              contact_phone: po.contact_phone,
            } as Contact);
          }
        } catch (error) {
          console.error('Error loading purchase order:', error);
          notify.error('Failed to load purchase order');
          navigate('/purchase-orders');
        } finally {
          setLoading(false);
        }
      };
      fetchPO();
    }
  }, [id, isEditMode, navigate, reset]);

  // Calculate line item subtotal (cost * qty)
  const calculateItemSubtotal = (index: number) => {
    if (!watchItems || !watchItems[index]) return;
    const item = watchItems[index];
    const qty = Number(item.item_qty) || 0;
    const cost = Number(item.item_cost) || 0;
    const discount = Number(item.item_discount) || 0;

    let subtotal = qty * cost;
    if (discount > 0 && discount <= 100) {
      subtotal = subtotal * (1 - discount / 100);
    }
    setValue(`items.${index}.item_subtotal`, Number(subtotal.toFixed(2)));
  };

  // Calculate totals
  const calculateTotals = () => {
    if (!watchItems) return { subtotal: 0, vat: 0, total: 0, discount: 0 };
    let subtotal = 0;
    let vat = 0;
    let totalDiscount = 0;

    watchItems.forEach((item: PurchaseOrderItem) => {
      const itemSubtotal = parseFloat(String(item.item_subtotal)) || 0;
      subtotal += itemSubtotal;
      if (item.item_vat) vat += itemSubtotal * 0.15;

      const qty = parseFloat(String(item.item_qty)) || 0;
      const cost = parseFloat(String(item.item_cost)) || 0;
      const discount = parseFloat(String(item.item_discount)) || 0;
      if (discount > 0 && discount <= 100) {
        totalDiscount += (qty * cost) * (discount / 100);
      }
    });

    const total = subtotal + vat;
    return {
      subtotal: Number(subtotal.toFixed(2)),
      vat: Number(vat.toFixed(2)),
      total: Number(total.toFixed(2)),
      discount: Number(totalDiscount.toFixed(2)),
    };
  };

  const totals = calculateTotals();

  // Handle pricing item selection (uses cost price directly)
  const handleSelectPricingItem = (pricingItem: PricingItem) => {
    if (currentItemIndex !== null) {
      setValue(`items.${currentItemIndex}.item_product`, pricingItem.pricing_item);
      setValue(`items.${currentItemIndex}.item_cost`, pricingItem.pricing_price);
      setValue(`items.${currentItemIndex}.item_price`, pricingItem.pricing_price); // Sale price = cost for reference
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
    if (watchContactId && suppliers.length > 0) {
      const contact = suppliers.find(c => c.contact_id === Number(watchContactId));
      setSelectedContact(contact || null);
      if (contact) setContactSearchQuery(contact.contact_name);
    }
  }, [watchContactId, suppliers]);

  // Filter contacts
  const filteredContacts = suppliers.filter(contact =>
    contact.contact_name?.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
    (contact.contact_email && contact.contact_email.toLowerCase().includes(contactSearchQuery.toLowerCase()))
  );

  const handleSelectContact = (contact: Contact) => {
    setValue('po_contact_id', contact.contact_id as any);
    setSelectedContact(contact);
    setContactSearchQuery(contact.contact_name);
    setShowContactDropdown(false);
  };

  const handleContactSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContactSearchQuery(e.target.value);
    setShowContactDropdown(true);
    if (!e.target.value) {
      setValue('po_contact_id', '' as any);
      setSelectedContact(null);
    }
  };

  // Recalculate when items change
  useEffect(() => {
    if (watchItems) {
      watchItems.forEach((_, index) => calculateItemSubtotal(index));
    }
  }, [JSON.stringify(watchItems)]);

  // Handle form submit
  const onSubmit = async (data: PurchaseOrder) => {
    try {
      setSaving(true);
      const totals = calculateTotals();

      const poData = {
        ...data,
        contact_id: Number(data.po_contact_id),
        po_amount: Number(totals.total),
        po_status: Number(data.po_status),
        remarks: data.po_notes || '',
        items: (data.items || []).map((item: PurchaseOrderItem) => ({
          item_description: item.item_product || '',
          item_cost: Number(item.item_cost) || 0,
          item_price: Number(item.item_price) || 0,
          item_quantity: Number(item.item_qty) || 1,
          item_discount: Number(item.item_discount) || 0,
          item_vat: item.item_vat ? 1 : 0,
        })),
      };

      if (isEditMode && id) {
        await PurchaseOrderModel.update(parseInt(id), poData);
        notify.success('Purchase order updated successfully');
      } else {
        const result = await PurchaseOrderModel.create(poData);
        notify.success('Purchase order created successfully');
        if (result?.data?.po_id || result?.id) {
          navigate(`/purchase-orders/${result.data?.po_id || result.id}`);
        } else {
          navigate('/purchase-orders');
        }
        return;
      }
      navigate('/purchase-orders');
    } catch (error: any) {
      console.error('Error saving purchase order:', error);
      notify.error(error.response?.data?.error || 'Failed to save purchase order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => navigate('/purchase-orders')}
              className="inline-flex items-center text-white hover:text-white/80 transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Purchase Orders
            </button>
          </div>
          <h1 className="text-3xl font-bold">
            {isEditMode ? `Edit Purchase Order #${String(id).padStart(5, '0')}` : 'Create New Purchase Order'}
          </h1>
          <p className="text-white/90 mt-2">
            {isEditMode ? 'Update the purchase order details below' : 'Fill in the details to create a purchase order for a supplier'}
          </p>
        </div>

        {/* Supplier and PO Details */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Supplier Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h3>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Supplier *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={handleContactSearchChange}
                    onFocus={() => setShowContactDropdown(true)}
                    onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                    placeholder="Search suppliers..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                {showContactDropdown && filteredContacts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredContacts.map(contact => (
                      <button
                        key={contact.contact_id}
                        type="button"
                        onClick={() => handleSelectContact(contact)}
                        className="w-full text-left px-4 py-3 hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{contact.contact_name}</div>
                        {contact.contact_email && <div className="text-xs text-gray-500">{contact.contact_email}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedContact && (
                <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                  <p className="font-medium text-gray-900">{selectedContact.contact_name}</p>
                  {selectedContact.contact_email && <p className="text-sm text-gray-600">{selectedContact.contact_email}</p>}
                  {selectedContact.contact_phone && <p className="text-sm text-gray-600">{selectedContact.contact_phone}</p>}
                </div>
              )}
            </div>

            {/* Right: PO Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Order Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Controller
                    name="po_date"
                    control={control}
                    render={({ field }) => (
                      <CustomDatePicker
                        label="PO Date"
                        required
                        value={field.value ? new Date(field.value) : null}
                        onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                      />
                    )}
                  />
                </div>
                <div>
                  <Controller
                    name="po_due_date"
                    control={control}
                    render={({ field }) => (
                      <CustomDatePicker
                        label="Delivery Date"
                        value={field.value ? new Date(field.value) : null}
                        onChange={(date) => field.onChange(date?.toISOString().split('T')[0])}
                      />
                    )}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  {...register('po_status')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value={0}>Draft</option>
                  <option value={1}>Sent</option>
                  <option value={2}>Received</option>
                  <option value={3}>Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Remarks</label>
                <textarea
                  {...register('po_notes')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Any notes for this purchase order..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Line Items</h3>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-teal-600 text-white text-xs uppercase tracking-wider">
                  <th className="text-center px-3 py-3 w-12">#</th>
                  <th className="text-left px-3 py-3">Description</th>
                  <th className="text-center px-3 py-3 w-20">Qty</th>
                  <th className="text-right px-3 py-3 w-28">Cost Price</th>
                  <th className="text-right px-3 py-3 w-28">Sale Price</th>
                  <th className="text-center px-3 py-3 w-20">Disc %</th>
                  <th className="text-center px-3 py-3 w-16">VAT</th>
                  <th className="text-right px-3 py-3 w-28">Subtotal</th>
                  <th className="text-center px-3 py-3 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="text-center px-3 py-2 text-gray-400 text-sm">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          {...register(`items.${index}.item_product`)}
                          type="text"
                          placeholder="Item description"
                          className="w-full px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-teal-500 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => openItemPicker(index)}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded"
                          title="Pick from pricing"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${index}.item_qty`, { valueAsNumber: true })}
                        type="number"
                        min="1"
                        step="1"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-center focus:ring-1 focus:ring-teal-500 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${index}.item_cost`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-right focus:ring-1 focus:ring-teal-500 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${index}.item_price`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-right focus:ring-1 focus:ring-teal-500 text-sm text-gray-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        {...register(`items.${index}.item_discount`, { valueAsNumber: true })}
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-center focus:ring-1 focus:ring-teal-500 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        {...register(`items.${index}.item_vat`)}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium">
                      {formatCurrency(watchItems?.[index]?.item_subtotal || 0)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Item button below table */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => append({ item_product: '', item_qty: 1, item_cost: 0, item_price: 0, item_subtotal: 0, item_discount: 0, item_vat: 0 })}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Item
            </button>
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-6">
            <div className="w-72 bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
              <div className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm">
                  <span className="text-gray-500">Discount:</span>
                  <span className="font-semibold text-red-600">-{formatCurrency(totals.discount)}</span>
                </div>
              )}
              {totals.vat > 0 && (
                <div className="flex justify-between px-4 py-2.5 text-sm border-t border-gray-200">
                  <span className="text-gray-500">VAT (15%):</span>
                  <span className="font-semibold">{formatCurrency(totals.vat)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3 bg-teal-600 text-white font-bold">
                <span>TOTAL:</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 rounded-lg font-medium shadow-md transition-all"
          >
            {saving ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              isEditMode ? 'Update Purchase Order' : 'Create Purchase Order'
            )}
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

export default CreatePurchaseOrder;
