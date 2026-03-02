import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { PricingModel, CategoryModel } from '../models';
import { PricingItem, PaginationResponse, PaginationParams } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, TagIcon, CurrencyDollarIcon, CubeIcon } from '@heroicons/react/24/outline';
import { Input, Select, Textarea, Button, Card, DataTable } from '../components/UI';
import Can from '../components/Can';

const Pricing: React.FC = () => {
  const { 
    categories, 
    setCategories, 
    loading, 
    setLoading 
  } = useAppStore();
  
  // Server-side pagination state
  const [pricingData, setPricingData] = useState<PaginationResponse<PricingItem>>({
    data: [],
    pagination: { page: 0, limit: 10, total: 0, pages: 0 }
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ sortBy: 'pricing_item', sortOrder: 'asc' as 'asc' | 'desc' });
  
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PricingItem | null>(null);
  const [formData, setFormData] = useState({
    pricing_item: '',
    pricing_price: 0,
    pricing_unit: '',
    pricing_category_id: 0,
    pricing_note: ''
  });

  // Helper function for formatting currency
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(price);
  };

  // Load data with pagination
  const loadPricingItems = async (params?: Partial<PaginationParams>) => {
    try {
      setLoading(true);
      const paginationParams: PaginationParams = {
        page: currentPage,
        limit: 10,
        search: searchQuery,
        ...sortConfig,
        ...params
      };
      
      const data = await PricingModel.getAll(undefined, paginationParams);
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        // Fallback for non-paginated response
        setPricingData({
          data: data,
          pagination: { page: 0, limit: data.length, total: data.length, pages: 1 }
        });
      } else {
        setPricingData(data as PaginationResponse<PricingItem>);
      }
    } catch (error) {
      console.error('Error loading pricing items:', error);
      setPricingData({ data: [], pagination: { page: 0, limit: 10, total: 0, pages: 0 } });
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadPricingItems({ page });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(0);
    loadPricingItems({ page: 0, search: query });
  };

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setSortConfig({ sortBy, sortOrder });
    setCurrentPage(0);
    loadPricingItems({ page: 0, sortBy, sortOrder });
  };

  // DataTable columns configuration
  const columns: any[] = [
    {
      accessorKey: 'pricing_id',
      header: 'ID'
    },
    {
      accessorKey: 'pricing_item',
      header: 'Description'
    },
    {
      accessorKey: 'pricing_unit',
      header: 'Unit',
      cell: ({ getValue }: any) => getValue() || '-'
    },
    {
      accessorKey: 'pricing_price',
      header: 'Unit Price',
      cell: ({ getValue }: any) => formatPrice(getValue() || 0)
    },
    {
      accessorKey: 'category_name',
      header: 'Category',
      cell: ({ getValue, row }: any) => getValue() || row.original.pricing_category || 'Uncategorized'
    },
    {
      accessorKey: 'pricing_note',
      header: 'Notes',
      cell: ({ getValue }: any) => getValue() || '-'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row.original)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
          >
            <PencilIcon className="h-3.5 w-3.5 mr-1" />
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original.pricing_id)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-scarlet hover:bg-scarlet/90 rounded-lg transition-colors"
          >
            <TrashIcon className="h-3.5 w-3.5 mr-1" />
            Delete
          </button>
        </div>
      )
    }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadPricingItems(), loadCategories()]);
  };

  const loadCategories = async () => {
    try {
      const data = await CategoryModel.getAll();
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        setCategories(data);
      } else {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingItem) {
        await PricingModel.update(editingItem.pricing_id, formData);
      } else {
        await PricingModel.create(formData);
      }
      
      resetForm();
      loadPricingItems();
    } catch (error) {
      console.error('Error saving pricing item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item: PricingItem) => {
    setEditingItem(item);
    setFormData({
      pricing_item: item.pricing_item,
      pricing_price: item.pricing_price,
      pricing_unit: item.pricing_unit || '',
      pricing_category_id: item.pricing_category_id || 0,
      pricing_note: item.pricing_note || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this pricing item?')) {
      try {
        setLoading(true);
        await PricingModel.delete(id);
        loadPricingItems();
      } catch (error) {
        console.error('Error deleting pricing item:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      pricing_item: '',
      pricing_price: 0,
      pricing_unit: '',
      pricing_category_id: 0,
      pricing_note: ''
    });
    setEditingItem(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Pricing</h1>
            <p className="text-white/90">Manage your product and service pricing</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search pricing items..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Can permission="pricing.create">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Item
              </button>
            </Can>
          </div>
        </div>
      </div>

      {/* Pricing Table */}
      <DataTable
        data={pricingData.data}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage="No pricing items found."
        serverSide={true}
        totalItems={pricingData.pagination.total}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onSort={handleSort}
      />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 w-96">
            <Card className="shadow-xl">
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingItem ? 'Edit Pricing Item' : 'Add New Pricing Item'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {editingItem ? 'Update' : 'Create'} pricing information for services or products
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <Input
                  label="Item Description"
                  type="text"
                  required
                  value={formData.pricing_item}
                  onChange={(e) => setFormData({ ...formData, pricing_item: e.target.value })}
                  placeholder="Enter item or service description"
                  startIcon={<TagIcon className="h-5 w-5" />}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Price"
                    type="number"
                    step="0.01"
                    required
                    value={formData.pricing_price}
                    onChange={(e) => setFormData({ ...formData, pricing_price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    startIcon={<CurrencyDollarIcon className="h-5 w-5" />}
                  />

                  <Input
                    label="Unit"
                    type="text"
                    value={formData.pricing_unit}
                    onChange={(e) => setFormData({ ...formData, pricing_unit: e.target.value })}
                    placeholder="e.g., each, hour, day"
                    startIcon={<CubeIcon className="h-5 w-5" />}
                  />
                </div>

                <Select
                  label="Category"
                  required
                  value={formData.pricing_category_id}
                  onChange={(e) => setFormData({ ...formData, pricing_category_id: parseInt(e.target.value) })}
                >
                  <option value={0}>Select a category...</option>
                  {categories.map(category => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </Select>

                <Textarea
                  label="Notes"
                  value={formData.pricing_note}
                  onChange={(e) => setFormData({ ...formData, pricing_note: e.target.value })}
                  rows={3}
                  placeholder="Additional notes or supplier information"
                  helperText="Optional details about this pricing item"
                />

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={loading}
                  >
                    {editingItem ? 'Update Item' : 'Create Item'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pricing;