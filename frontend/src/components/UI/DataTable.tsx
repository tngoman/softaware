import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import Input from './Input';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  className?: string;
  emptyMessage?: string;
  // Server-side pagination props
  serverSide?: boolean;
  totalItems?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onSearch?: (query: string) => void;
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

function DataTable<T>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  onRowClick,
  className = '',
  emptyMessage = 'No data available',
  // Server-side pagination props
  serverSide = false,
  totalItems,
  currentPage = 0,
  onPageChange,
  onSearch,
  onSort,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setGlobalFilter(value);
    if (serverSide && onSearch) {
      onSearch(value);
    }
  };

  // Handle sorting changes
  const handleSortingChange = (updaterOrValue: any) => {
    setSorting(updaterOrValue);
    if (serverSide && onSort && typeof updaterOrValue === 'function') {
      const newSorting = updaterOrValue(sorting);
      if (newSorting.length > 0) {
        const { id, desc } = newSorting[0];
        onSort(id, desc ? 'desc' : 'asc');
      }
    }
  };

  const tableState = useMemo(() => {
    const base: any = {
      sorting,
      columnFilters,
      globalFilter,
    };
    if (serverSide) {
      base.pagination = { pageIndex: currentPage, pageSize };
    }
    return base;
  }, [sorting, columnFilters, globalFilter, serverSide, currentPage, pageSize]);

  const table = useReactTable({
    data,
    columns,
    manualPagination: serverSide, // server-side pagination
    manualSorting: serverSide,
    manualFiltering: serverSide,
    pageCount: serverSide ? Math.ceil((totalItems || 0) / pageSize) : undefined,
    state: tableState,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: serverSide ? undefined : getPaginationRowModel(),
    getSortedRowModel: serverSide ? undefined : getSortedRowModel(),
    getFilteredRowModel: serverSide ? undefined : getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize,
        pageIndex: currentPage,
      },
    },
  });

  const getSortIcon = (isSorted: false | 'asc' | 'desc') => {
    if (isSorted === 'asc') {
      return <ChevronUpIcon className="h-4 w-4" />;
    }
    if (isSorted === 'desc') {
      return <ChevronDownIcon className="h-4 w-4" />;
    }
    return <div className="h-4 w-4" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Bar */}
      {searchable && (
        <div className="max-w-sm">
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => handleSearchChange(e.target.value)}
            startIcon={<MagnifyingGlassIcon className="h-5 w-5" />}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <div className="flex items-center space-x-1">
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            {header.column.getCanSort() && (
                              <span className="text-gray-400">
                                {getSortIcon(header.column.getIsSorted())}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-6 py-12 text-center text-gray-500"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-gray-50 ${
                          onRowClick ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => onRowClick?.(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => {
                    if (serverSide && onPageChange) {
                      onPageChange(currentPage - 1);
                    } else {
                      table.previousPage();
                    }
                  }}
                  disabled={serverSide ? currentPage === 0 : !table.getCanPreviousPage()}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (serverSide && onPageChange) {
                      onPageChange(currentPage + 1);
                    } else {
                      table.nextPage();
                    }
                  }}
                  disabled={serverSide 
                    ? currentPage >= Math.ceil((totalItems || 0) / pageSize) - 1
                    : !table.getCanNextPage()
                  }
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {serverSide 
                        ? currentPage * pageSize + 1
                        : (table.getState().pagination?.pageIndex ?? 0) * pageSize + 1
                      }
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {serverSide 
                        ? Math.min((currentPage + 1) * pageSize, totalItems || 0)
                        : Math.min(
                            ((table.getState().pagination?.pageIndex ?? 0) + 1) * pageSize,
                            // Fallback to data length when filtered row model isn't available
                            (typeof (table as any).getFilteredRowModel === 'function'
                              ? (table as any).getFilteredRowModel().rows.length
                              : data.length)
                          )
                      }
                    </span>{' '}
                    of{' '}
                    <span className="font-medium">
                      {serverSide 
                        ? totalItems 
                        : (typeof (table as any).getFilteredRowModel === 'function'
                            ? (table as any).getFilteredRowModel().rows.length
                            : data.length)}
                    </span>{' '}
                    results
                  </p>
                </div>
                <div>
                  <nav
                    className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                    aria-label="Pagination"
                  >
                    <button
                      onClick={() => {
                        if (serverSide && onPageChange) {
                          onPageChange(currentPage - 1);
                        } else {
                          table.previousPage();
                        }
                      }}
                      disabled={serverSide ? currentPage === 0 : !table.getCanPreviousPage()}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    
                    {/* Smart page numbers - show first, last, current and nearby pages */}
                    {(() => {
                      const totalPages = serverSide 
                        ? Math.ceil((totalItems || 0) / pageSize) 
                        : table.getPageCount?.() ?? 1;
                      const current = serverSide ? currentPage : (table.getState().pagination?.pageIndex ?? 0);
                      const pages: (number | string)[] = [];
                      
                      if (totalPages <= 7) {
                        // Show all pages if 7 or fewer
                        for (let i = 0; i < totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Always show first page
                        pages.push(0);
                        
                        // Show ellipsis or pages around current
                        if (current > 2) {
                          pages.push('...');
                        }
                        
                        // Show current page and neighbors
                        for (let i = Math.max(1, current - 1); i <= Math.min(totalPages - 2, current + 1); i++) {
                          if (!pages.includes(i)) {
                            pages.push(i);
                          }
                        }
                        
                        // Show ellipsis or pages before last
                        if (current < totalPages - 3) {
                          pages.push('...');
                        }
                        
                        // Always show last page
                        if (!pages.includes(totalPages - 1)) {
                          pages.push(totalPages - 1);
                        }
                      }
                      
                      return pages.map((page, idx) => {
                        if (page === '...') {
                          return (
                            <span
                              key={`ellipsis-${idx}`}
                              className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                            >
                              ...
                            </span>
                          );
                        }
                        
                        const pageNum = page as number;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {
                              if (serverSide && onPageChange) {
                                onPageChange(pageNum);
                              } else {
                                table.setPageIndex(pageNum);
                              }
                            }}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              pageNum === current
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum + 1}
                          </button>
                        );
                      });
                    })()}

                    <button
                      onClick={() => {
                        if (serverSide && onPageChange) {
                          onPageChange(currentPage + 1);
                        } else {
                          table.nextPage();
                        }
                      }}
                      disabled={serverSide 
                        ? currentPage >= Math.ceil((totalItems || 0) / pageSize) - 1
                        : !table.getCanNextPage()
                      }
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DataTable;