import { create } from 'zustand';
import { Contact, Quotation, Invoice, QuoteItem, InvoiceItem, PricingItem, Category, User } from '../types';

interface AppState {
  // Authentication
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  
  // Contacts
  contacts: Contact[];
  customers: Contact[];
  suppliers: Contact[];
  setContacts: (contacts: Contact[]) => void;
  setCustomers: (customers: Contact[]) => void;
  setSuppliers: (suppliers: Contact[]) => void;
  
  // Quotations
  quotations: Quotation[];
  currentQuotation: Quotation | null;
  setQuotations: (quotations: Quotation[]) => void;
  setCurrentQuotation: (quotation: Quotation | null) => void;
  
  // Invoices
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  setInvoices: (invoices: Invoice[]) => void;
  setCurrentInvoice: (invoice: Invoice | null) => void;
  
  // Pricing
  pricingItems: PricingItem[];
  setPricingItems: (items: PricingItem[]) => void;
  
  // Categories
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  
  // UI State
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

// Initialize user from localStorage if available
const getInitialUser = (): User | null => {
  try {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr); 
    return user;
  } catch (error) {
    console.error('Failed to parse user from localStorage:', error);
    localStorage.removeItem('user');
    localStorage.removeItem('jwt_token');
    return null;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // Authentication
  user: getInitialUser(),
  isAuthenticated: !!localStorage.getItem('jwt_token'),
  setUser: (user) => set({ user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  logout: () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    set({ user: null, isAuthenticated: false });
  },
  hasPermission: (permission: string) => {
    const { user } = get();
    if (!user) return false;
    if (user.is_admin || user.is_staff) return true;
    return user.permissions?.some((p: any) => p.slug === permission) || false;
  },
  
  // Helper property to check admin status
  get isAdmin() {
    const { user } = get();
    return user?.is_admin || false;
  },
  
  // Contacts
  contacts: [],
  customers: [],
  suppliers: [],
  setContacts: (contacts) => set({ contacts }),
  setCustomers: (customers) => set({ customers }),
  setSuppliers: (suppliers) => set({ suppliers }),
  
  // Quotations
  quotations: [],
  currentQuotation: null,
  setQuotations: (quotations) => set({ quotations }),
  setCurrentQuotation: (quotation) => set({ currentQuotation: quotation }),
  
  // Invoices
  invoices: [],
  currentInvoice: null,
  setInvoices: (invoices) => set({ invoices }),
  setCurrentInvoice: (invoice) => set({ currentInvoice: invoice }),
  
  // Pricing
  pricingItems: [],
  setPricingItems: (items) => set({ pricingItems: items }),
  
  // Categories
  categories: [],
  setCategories: (categories) => set({ categories }),
  
  // UI State
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  loading: false,
  setLoading: (loading) => set({ loading }),
}));