import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlusIcon, PencilIcon, TrashIcon, UserIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon, MapPinIcon, ReceiptPercentIcon, EyeIcon } from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { ContactModel } from '../models';
import { useAppStore } from '../store';
import { Contact } from '../types';
import { Input, Select, Textarea, Button, Card, DataTable, BackButton } from '../components/UI';
import Can from '../components/Can';
import Swal from 'sweetalert2';

const Contacts: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, suppliers, setCustomers, setSuppliers } = useAppStore();
  
  // Get edit ID from URL query params
  const [searchParams] = React.useState(() => new URLSearchParams(window.location.search));
  const editId = searchParams.get('edit');
  
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState<Partial<Contact>>({
    contact_name: '',
    contact_type: 1,
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    contact_alt_phone: '',
    contact_address: '',
    contact_vat: '',
    contact_notes: '',
  });

  useEffect(() => {
    loadContacts();
  }, [activeTab, pagination.page, pagination.limit, search]);

  useEffect(() => {
    // Handle edit from URL parameter
    if (editId) {
      const allContacts = [...customers, ...suppliers];
      const contact = allContacts.find(c => c.contact_id === parseInt(editId));
      if (contact) {
        setEditingContact(contact);
        setFormData(contact);
        setActiveTab(contact.contact_type === 1 ? 'customers' : 'suppliers');
        setShowForm(true);
      }
    } else if (id) {
      // Handle legacy edit from route parameter
      const allContacts = [...customers, ...suppliers];
      const contact = allContacts.find(c => c.contact_id === parseInt(id));
      if (contact) {
        setEditingContact(contact);
        setFormData(contact);
        setActiveTab(contact.contact_type === 1 ? 'customers' : 'suppliers');
        setShowForm(true);
      }
    }
  }, [editId, id, customers, suppliers]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await ContactModel.getAll(activeTab, {
        page: pagination.page,
        limit: pagination.limit,
        search: search
      });
      
      if (Array.isArray(data)) {
        if (activeTab === 'customers') {
          setCustomers(data);
        } else {
          setSuppliers(data);
        }
      } else {
        const result = data as any;
        if (activeTab === 'customers') {
          setCustomers(result.data);
        } else {
          setSuppliers(result.data);
        }
        if (result.pagination) {
          setPagination(prev => ({ 
            ...prev, 
            total: result.pagination.total 
          }));
        }
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load contacts' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: '',
      contact_type: activeTab === 'customers' ? 1 : 2,
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      contact_alt_phone: '',
      contact_address: '',
      contact_vat: '',
      contact_notes: '',
    });
    setEditingContact(null);
    setShowForm(false);
    if (id) {
      navigate('/contacts');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const selectedContactType = formData.contact_type ?? (activeTab === 'customers' ? 1 : 2);

      if (editingContact) {
        await ContactModel.update(editingContact.contact_id!, {
          ...formData,
          contact_type: selectedContactType
        });
        Swal.fire({ icon: 'success', title: 'Success!', text: 'Contact updated successfully', timer: 2000, showConfirmButton: false });
      } else {
        await ContactModel.create({
          ...formData,
          contact_type: selectedContactType
        });
        Swal.fire({ icon: 'success', title: 'Success!', text: 'Contact created successfully', timer: 2000, showConfirmButton: false });
      }
      
      resetForm();
      loadContacts();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save contact' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData(contact);
    setShowForm(true);
  };

  const handleDelete = async (contactId: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      setLoading(true);
      await ContactModel.delete(contactId);
      Swal.fire({ icon: 'success', title: 'Success!', text: 'Contact deleted successfully', timer: 2000, showConfirmButton: false });
      loadContacts();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete contact' });
    } finally {
      setLoading(false);
    }
  };

  const currentContacts = activeTab === 'customers' ? customers : suppliers;

  // Table columns configuration
  const columns = useMemo<ColumnDef<Contact>[]>(() => [
    {
      accessorKey: 'contact_name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-picton-blue/10 flex items-center justify-center">
              {row.original.contact_type === 1 ? (
                <UserIcon className="h-5 w-5 text-picton-blue" />
              ) : (
                <BuildingOfficeIcon className="h-5 w-5 text-green-600" />
              )}
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.original.contact_name}
            </div>
            {row.original.contact_person && (
              <div className="text-sm text-gray-500">
                {row.original.contact_person}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contact_email',
      header: 'Email',
      cell: ({ getValue }) => {
        const email = getValue() as string;
        return email ? (
          <a href={`mailto:${email}`} className="text-picton-blue hover:text-picton-blue/80">
            {email}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'contact_phone',
      header: 'Phone',
      cell: ({ getValue }) => {
        const phone = getValue() as string;
        return phone ? (
          <a href={`tel:${phone}`} className="text-picton-blue hover:text-picton-blue/80">
            {phone}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'contact_vat',
      header: 'VAT Number',
      cell: ({ getValue }) => {
        const vat = getValue() as string;
        return vat || <span className="text-gray-400">-</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Can permission="contacts.view">
            <button
              onClick={() => navigate(`/contacts/${row.original.contact_id}`)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-picton-blue hover:bg-picton-blue/90 rounded-lg transition-colors"
            >
              <EyeIcon className="h-3.5 w-3.5 mr-1" />
              View {row.original.contact_type === 1 ? 'Customer' : 'Supplier'}
            </button>
          </Can>
          <Can permission="contacts.edit">
            <button
              onClick={() => handleEdit(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
            >
              <PencilIcon className="h-3.5 w-3.5 mr-1" />
              Edit
            </button>
          </Can>
          <Can permission="contacts.delete">
            <button
              onClick={() => handleDelete(row.original.contact_id!)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-scarlet hover:bg-scarlet/90 rounded-lg transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5 mr-1" />
              Delete
            </button>
          </Can>
        </div>
      ),
    },
  ], []);

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {editingContact ? 'Edit' : 'Add New'} {activeTab === 'customers' ? 'Customer' : 'Supplier'}
            </h1>
            <p className="text-gray-600">
              {editingContact ? 'Update' : 'Create'} contact information
            </p>
          </div>
          <BackButton onClick={resetForm} />
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Contact Name"
                type="text"
                required
                value={formData.contact_name || ''}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Enter company or person name"
                startIcon={<BuildingOfficeIcon />}
              />

              <Input
                label="Contact Person"
                type="text"
                value={formData.contact_person || ''}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Enter contact person name"
                startIcon={<UserIcon />}
              />

              <Select
                label="Contact Type"
                required
                value={String(formData.contact_type ?? (activeTab === 'customers' ? 1 : 2))}
                onChange={(e) => setFormData({ ...formData, contact_type: parseInt(e.target.value, 10) })}
                helperText="Determines whether this record is treated as a customer or supplier."
              >
                <option value="1">Customer</option>
                <option value="2">Supplier</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Email"
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="Enter email address"
                startIcon={<EnvelopeIcon />}
              />

              <Input
                label="Phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Enter phone number"
                startIcon={<PhoneIcon />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Alternative Phone"
                type="tel"
                value={formData.contact_alt_phone}
                onChange={(e) => setFormData({ ...formData, contact_alt_phone: e.target.value })}
                placeholder="Enter alternative phone"
                startIcon={<PhoneIcon />}
                helperText="Alternative contact number"
              />

              <Input
                label="VAT Number"
                type="text"
                value={formData.contact_vat}
                onChange={(e) => setFormData({ ...formData, contact_vat: e.target.value })}
                placeholder="Enter VAT registration number"
                startIcon={<ReceiptPercentIcon />}
                helperText="Tax identification number"
              />
            </div>

            <Textarea
              label="Address"
              value={formData.contact_address}
              onChange={(e) => setFormData({ ...formData, contact_address: e.target.value })}
              placeholder="Enter complete address..."
              rows={3}
              helperText="Complete business or residential address"
            />

            <Textarea
              label="Notes"
              value={formData.contact_notes}
              onChange={(e) => setFormData({ ...formData, contact_notes: e.target.value })}
              placeholder="Additional notes or comments..."
              rows={3}
              helperText="Any additional information about this contact"
            />

          <div className="flex justify-end space-x-4 mt-6">
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
              {editingContact ? 'Update Contact' : 'Create Contact'}
            </Button>
          </div>
        </form>
      </Card>
      </div>
    );
  }

  return (
    <Can 
      permission="contacts.view"
      fallback={
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500">You don't have permission to view contacts.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Contacts</h1>
            <p className="text-white/90">Manage your customers and suppliers</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Can permission="contacts.create">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add New Contact
              </button>
            </Can>
          </div>
        </div>

        {/* Tab Navigation inside header */}
        <div className="border-b border-white/20">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customers'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/70 hover:text-white hover:border-white/50'
              }`}
            >
              <UserIcon className="h-5 w-5 inline mr-2" />
              Customers ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'suppliers'
                  ? 'border-white text-white'
                  : 'border-transparent text-white/70 hover:text-white hover:border-white/50'
              }`}
            >
              <BuildingOfficeIcon className="h-5 w-5 inline mr-2" />
              Suppliers ({suppliers.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Contacts Table */}
      <DataTable
        data={currentContacts}
        columns={columns}
        loading={loading}
        searchable={false}
        emptyMessage={`No ${activeTab} found. Click "Add New Contact" to get started.`}
        pageSize={pagination.limit}
        serverSide={true}
        currentPage={pagination.page}
        totalItems={pagination.total}
        onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
        onSearch={(query: string) => {
          setSearch(query);
          setPagination(prev => ({ ...prev, page: 0 }));
        }}
      />
      </div>
    </Can>
  );
};

export default Contacts;