import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PricingModel } from '../../models';
import { PricingItem } from '../../types';

interface ItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: PricingItem) => void;
}

const ItemPickerModal: React.FC<ItemPickerModalProps> = ({ isOpen, onClose, onSelectItem }) => {
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PricingItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPricingItems();
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(pricingItems);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = pricingItems.filter(
        (item) =>
          item.pricing_item.toLowerCase().includes(query) ||
          (item.category_name && item.category_name.toLowerCase().includes(query)) ||
          (item.pricing_category && item.pricing_category.toLowerCase().includes(query)) ||
          item.pricing_note?.toLowerCase().includes(query)
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, pricingItems]);

  const loadPricingItems = async () => {
    try {
      setLoading(true);
      // Load all pricing items (override default pagination limit)
      const data = await PricingModel.getAll(undefined, { page: 0, limit: 10000 });
      const items = Array.isArray(data) ? data : data.data || [];
      setPricingItems(items);
      setFilteredItems(items);
    } catch (error) {
      console.error('Error loading pricing items:', error);
      setPricingItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item: PricingItem) => {
    onSelectItem(item);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 px-6 py-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Select Item from Pricing</h3>
              <button
                onClick={onClose}
                className="text-white hover:text-white/80 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Search */}
            <div className="mt-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-white/60" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Start typing to filter items..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border-0 bg-white/20 text-white placeholder-white/60 focus:ring-2 focus:ring-white/50 focus:bg-white/30"
                autoFocus
              />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-picton-blue border-r-transparent"></div>
                <p className="mt-2 text-gray-600">Loading items...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {searchQuery ? 'No items match your search.' : 'No pricing items available.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Item / Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                        Unit
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-40">
                        Supplier
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.pricing_id}
                        onClick={() => handleSelectItem(item)}
                        className="hover:bg-picton-blue/10 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.pricing_item}</p>
                            {(item.category_name || item.pricing_category) && (
                              <p className="text-xs text-gray-500">{item.category_name || item.pricing_category}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.pricing_unit || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                          R {Number(item.pricing_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.pricing_note || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-xl border-t border-gray-200">
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>{filteredItems.length} items available</span>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemPickerModal;
