import React, { useState, useEffect } from 'react';
import { CategoryModel } from '../../models';
import { Category, PaginationResponse, PaginationParams } from '../../types';
import { PlusIcon, PencilIcon, TrashIcon, TagIcon } from '@heroicons/react/24/outline';
import { Input, Button, Card, DataTable } from '../../components/UI';
import ExpenseCategoryManager from '../../components/ExpenseCategories/ExpenseCategoryManager';
import Can from '../../components/Can';
import { notify } from '../../utils/notify';

const Categories: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pricing' | 'expense'>('pricing');
  const [expenseSearchQuery, setExpenseSearchQuery] = useState('');
  const [expenseShowForm, setExpenseShowForm] = useState(false);
  // Server-side pagination state
  const [categoriesData, setCategoriesData] = useState<PaginationResponse<Category>>({
    data: [],
    pagination: { page: 0, limit: 10, total: 0, pages: 0 }
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ sortBy: 'category_name', sortOrder: 'asc' as 'asc' | 'desc' });
  
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    category_name: ''
  });

  // Load data with pagination
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
      
      const data = await CategoryModel.getAll(paginationParams);
      
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        // Fallback for non-paginated response
        setCategoriesData({
          data: data,
          pagination: { page: 0, limit: data.length, total: data.length, pages: 1 }
        });
      } else {
        setCategoriesData(data as PaginationResponse<Category>);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategoriesData({ data: [], pagination: { page: 0, limit: 10, total: 0, pages: 0 } });
    } finally {
      setLoading(false);
    }
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadCategories({ page });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(0);
    loadCategories({ page: 0, search: query });
  };

  const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
    setSortConfig({ sortBy, sortOrder });
    setCurrentPage(0);
    loadCategories({ page: 0, sortBy, sortOrder });
  };

  // DataTable columns configuration
  const columns: any[] = [
    {
      accessorKey: 'category_id',
      header: 'ID'
    },
    {
      accessorKey: 'category_name',
      header: 'Category Name',
      cell: ({ getValue }: any) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-picton-blue/10 flex items-center justify-center">
              <TagIcon className="h-5 w-5 text-picton-blue" />
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
        await CategoryModel.update(editingCategory.category_id, formData);
      } else {
        await CategoryModel.create(formData);
      }
      
      resetForm();
      loadCategories();
    } catch (error) {
      console.error('Error saving category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      category_name: category.category_name
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone if the category is being used by pricing items.')) {
      try {
        setLoading(true);
        await CategoryModel.delete(id);
        loadCategories();
      } catch (error: any) {
        console.error('Error deleting category:', error);
        if (error.response?.data?.error) {
          notify.error(error.response.data.error);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      category_name: ''
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Categories</h1>
            <p className="text-white/90">Manage pricing and expense categories</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder={activeTab === 'pricing' ? 'Search categories...' : 'Search expense categories...'}
                value={activeTab === 'pricing' ? searchQuery : expenseSearchQuery}
                onChange={(e) => activeTab === 'pricing' ? handleSearch(e.target.value) : setExpenseSearchQuery(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {activeTab === 'pricing' ? (
              !showForm && (
                <Can permission="categories.create">
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Add Pricing Category
                  </button>
                </Can>
              )
            ) : (
              !expenseShowForm && (
                <Can permission="categories.create">
                  <button
                    onClick={() => setExpenseShowForm(true)}
                    className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Add Expense Category
                  </button>
                </Can>
              )
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-white/10 p-1 rounded-lg backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'pricing'
                ? 'bg-white text-picton-blue shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Pricing Categories
          </button>
          <button
            onClick={() => setActiveTab('expense')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
              activeTab === 'expense'
                ? 'bg-white text-picton-blue shadow-md'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            Expense Categories
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'pricing' ? (
        <>
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

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 w-96">
                <Card className="shadow-xl">
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {editingCategory ? 'Edit Category' : 'Add New Category'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {editingCategory ? 'Update' : 'Create'} a category for organizing items
                    </p>
                  </div>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                      label="Category Name"
                      type="text"
                      required
                      value={formData.category_name}
                      onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
                      placeholder="e.g., Software Development, Consulting"
                      startIcon={<TagIcon className="h-5 w-5" />}
                      helperText="Enter a descriptive name for this category"
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
                        {editingCategory ? 'Update Category' : 'Create Category'}
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          )}
        </>
      ) : (
        <ExpenseCategoryManager 
          searchQuery={expenseSearchQuery}
          showForm={expenseShowForm}
          onShowFormChange={setExpenseShowForm}
        />
      )}
    </div>
  );
};

export default Categories;