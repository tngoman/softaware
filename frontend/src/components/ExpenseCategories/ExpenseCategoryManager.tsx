import React, { useState, useEffect } from 'react';
import { ExpenseCategoryModel } from '../../models';
import { ExpenseCategory, PaginationResponse, PaginationParams } from '../../types';
import { PencilIcon, TrashIcon, BanknotesIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { Input, Button, Card, DataTable, Select } from '../UI';
import Swal from 'sweetalert2';

interface ExpenseCategoryManagerProps {
  searchQuery?: string;
  showForm?: boolean;
  onShowFormChange?: (show: boolean) => void;
}

const ExpenseCategoryManager: React.FC<ExpenseCategoryManagerProps> = ({
  searchQuery = '',
  showForm: externalShowForm = false,
  onShowFormChange
}) => {
  const [categoriesData, setCategoriesData] = useState<PaginationResponse<ExpenseCategory>>({
    data: [],
    pagination: { page: 0, limit: 10, total: 0, pages: 0 }
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ sortBy: 'category_name', sortOrder: 'asc' as 'asc' | 'desc' });
  
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState({
    category_name: '',
    category_code: '',
    category_group: '',
    itr14_mapping: '',
    allows_vat_claim: 1
  });

  const categoryGroups = [
    'Operating Expenses',
    'Administrative',
    'Direct Costs',
    'Transport & Vehicle',
    'People Costs',
    'Business Services',
    'Other'
  ];

  useEffect(() => {
    if (externalShowForm !== undefined) {
      setShowForm(externalShowForm);
    }
  }, [externalShowForm]);

  useEffect(() => {
    loadCategories();
  }, [searchQuery]);

  const loadCategories = async (params?: Partial<PaginationParams>) => {
    try {
      setLoading(true);
      const paginationParams: PaginationParams = {
        page: currentPage,
        limit: 10,
        search: searchQuery,
        ...sortConfig,
        ...params
      };
      
      const data = await ExpenseCategoryModel.getAll(paginationParams);
      
      if (Array.isArray(data)) {
        setCategoriesData({
          data: data,
          pagination: { page: 0, limit: data.length, total: data.length, pages: 1 }
        });
      } else {
        setCategoriesData(data as PaginationResponse<ExpenseCategory>);
      }
    } catch (error) {
      console.error('Error loading expense categories:', error);
      setCategoriesData({ data: [], pagination: { page: 0, limit: 10, total: 0, pages: 0 } });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadCategories({ page });
  };

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setSortConfig({ sortBy, sortOrder });
    setCurrentPage(0);
    loadCategories({ page: 0, sortBy, sortOrder });
  };

  const resetForm = () => {
    setFormData({
      category_name: '',
      category_code: '',
      category_group: '',
      itr14_mapping: '',
      allows_vat_claim: 1
    });
    setEditingCategory(null);
    setShowForm(false);
    if (onShowFormChange) {
      onShowFormChange(false);
    }
  };

  const columns: any[] = [
    {
      accessorKey: 'category_code',
      header: 'Code',
      cell: ({ getValue }: any) => (
        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
          {getValue() || 'N/A'}
        </span>
      )
    },
    {
      accessorKey: 'category_name',
      header: 'Category Name',
      cell: ({ getValue }: any) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-picton-blue/10 flex items-center justify-center">
              <BanknotesIcon className="h-5 w-5 text-picton-blue" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {getValue()}
            </div>
          </div>
        </div>
      )
    },
    {
      accessorKey: 'category_group',
      header: 'Group',
      cell: ({ getValue }: any) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {getValue() || 'Other'}
        </span>
      )
    },
    {
      accessorKey: 'itr14_mapping',
      header: 'ITR14 Mapping',
      cell: ({ getValue }: any) => (
        <span className="text-sm text-gray-600">
          {getValue() || '-'}
        </span>
      )
    },
    {
      accessorKey: 'allows_vat_claim',
      header: 'VAT Claim',
      cell: ({ getValue }: any) => (
        getValue() === 1 ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="h-4 w-4 mr-1" />
            Allowed
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="h-4 w-4 mr-1" />
            Not Allowed
          </span>
        )
      )
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row.original)}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-picton-blue hover:bg-picton-blue/90 rounded-lg transition-colors"
          >
            <PencilIcon className="h-3.5 w-3.5 mr-1" />
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.original.category_id)}
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
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingCategory) {
        await ExpenseCategoryModel.update(editingCategory.category_id, formData);
        Swal.fire({ icon: 'success', title: 'Success', text: 'Expense category updated successfully' });
      } else {
        await ExpenseCategoryModel.create(formData);
        Swal.fire({ icon: 'success', title: 'Success', text: 'Expense category created successfully' });
      }
      
      resetForm();
      loadCategories();
    } catch (error) {
      console.error('Error saving expense category:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save expense category' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name,
      category_code: category.category_code || '',
      category_group: category.category_group || '',
      itr14_mapping: category.itr14_mapping,
      allows_vat_claim: category.allows_vat_claim
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will delete the expense category. Transactions using this category will become uncategorized.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await ExpenseCategoryModel.delete(id);
        Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Expense category has been deleted.' });
        loadCategories();
      } catch (error: any) {
        console.error('Error deleting expense category:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.error || 'Failed to delete expense category'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      {!showForm && (
        <Card>
          <DataTable
            data={categoriesData.data}
            columns={columns}
            serverSide={true}
            totalItems={categoriesData.pagination.total}
            currentPage={currentPage}
            onPageChange={handlePageChange}
            onSort={handleSort}
            searchable={false}
            loading={loading}
          />
        </Card>
      )}

      {showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {editingCategory ? 'Edit' : 'Create'} Expense Category
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {editingCategory ? 'Update the expense category details below' : 'Fill in the details to create a new expense category'}
              </p>
              <div className="space-y-4">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        Categories map to ITR14 tax return line items. Set "VAT Claim" to control whether expenses in this category can claim input VAT.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Category Name"
                    type="text"
                    required
                    value={formData.category_name}
                    onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                    placeholder="e.g., Office Supplies"
                    helperText="The display name for this expense category"
                  />

                  <Input
                    label="Category Code"
                    type="text"
                    value={formData.category_code}
                    onChange={(e) => setFormData({ ...formData, category_code: e.target.value.toUpperCase() })}
                    placeholder="e.g., OFFICE"
                    helperText="Short code for reports (optional)"
                  />
                </div>

                <Select
                  label="Category Group"
                  value={formData.category_group}
                  onChange={(e) => setFormData({ ...formData, category_group: e.target.value })}
                  helperText="Logical grouping for better organization"
                >
                  <option value="">Select a group...</option>
                  {categoryGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </Select>

                <Input
                  label="ITR14 Mapping"
                  type="text"
                  required
                  value={formData.itr14_mapping}
                  onChange={(e) => setFormData({ ...formData, itr14_mapping: e.target.value })}
                  placeholder="e.g., Office expenses"
                  helperText="Maps to ITR14 tax return line item"
                />

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="allows_vat_claim"
                    checked={formData.allows_vat_claim === 1}
                    onChange={(e) => setFormData({ ...formData, allows_vat_claim: e.target.checked ? 1 : 0 })}
                    className="h-4 w-4 text-picton-blue focus:ring-picton-blue border-gray-300 rounded"
                  />
                  <label htmlFor="allows_vat_claim" className="text-sm font-medium text-gray-700">
                    Allow VAT Claims
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-7">
                  Enable this if expenses in this category can claim input VAT (e.g., Salaries and Entertainment typically cannot)
                </p>

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
                    {editingCategory ? 'Update Category' : 'Create Category'}
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

export default ExpenseCategoryManager;
