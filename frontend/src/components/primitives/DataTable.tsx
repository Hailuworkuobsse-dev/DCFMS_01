import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Download,
  X,
  Printer,
} from 'lucide-react';
import { LoadingState, EmptyState } from './States';
import { downloadTextFile } from '../../lib/utils/format';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  getValue?: (item: T) => any;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((item: T) => string);
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  filterComponent?: React.ReactNode;
  exportFileName?: string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (item: T) => void;
  actions?: (item: T) => React.ReactNode;
  initialSortKey?: string;
  initialSortDirection?: 'asc' | 'desc';
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  isLoading = false,
  searchable = true,
  searchPlaceholder,
  filterComponent,
  exportFileName,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  actions,
  initialSortKey,
  initialSortDirection = 'asc',
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey || null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    initialSortDirection
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);

  const getKey = (item: T, idx: number): string => {
    if (typeof keyField === 'function') return keyField(item);
    return String(item[keyField] ?? idx);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted
  const processedData = useMemo(() => {
    let result = [...data];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((item) => {
        return Object.values(item).some((val) => {
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      result.sort((a, b) => {
        let valA = col?.getValue ? col.getValue(a) : a[sortKey];
        let valB = col?.getValue ? col.getValue(b) : b[sortKey];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, searchTerm, sortKey, sortDirection, columns]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / rowsPerPage) || 1;
  // Clamp the effective page immediately when filters or refreshed data shrink the result set.
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = useMemo(() => {
    const start = (safeCurrentPage - 1) * rowsPerPage;
    return processedData.slice(start, start + rowsPerPage);
  }, [processedData, safeCurrentPage, rowsPerPage]);

  const handlePrint = () => {
    // Uses the browser's native print dialog, where users can choose Save as PDF.
    window.print();
  };

  const handleExportCSV = () => {
    if (!processedData.length) return;
    const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`);
    if (actions) headers.push('"Actions"');

    const rows = processedData.map((item) => {
      const row = columns.map((c) => {
        let val = c.getValue ? c.getValue(item) : item[c.key];
        if (typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }
        let cell = String(val ?? '');
        // Prevent spreadsheet formula execution for untrusted text in exported CSV files.
        if (typeof val === 'string' && /^[=+@\t\r]/.test(cell)) cell = `'${cell}`;
        return `"${cell.replace(/"/g, '""')}"`;
      });
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    downloadTextFile(
      `${exportFileName || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
      'text/csv;charset=utf-8;'
    );
  };

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label={searchPlaceholder || t('common.search', 'Search records...')}
                placeholder={searchPlaceholder || t('common.search', 'Search records...')}
                className="w-full pl-9 pr-9 py-2 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-100 text-stone-900 placeholder:text-stone-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                  aria-label={t('common.clearSearch', 'Clear search')}
                  title={t('common.clearSearch', 'Clear search')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-500 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-forest-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {filterComponent}
        </div>

        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-stone-600">
            <span>{t('common.rowsPerPage', 'Rows')}</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              aria-label={t('common.rowsPerPage', 'Rows per page')}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-forest-600"
            >
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          {exportFileName && processedData.length > 0 && (
            <button
              onClick={handleExportCSV}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-900"
              title={t('common.export', 'Export to CSV')}
            >
              <Download className="w-3.5 h-3.5 text-stone-600" />
              <span>{t('common.export', 'Export CSV')}</span>
            </button>
          )}
          {processedData.length > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              title={t('common.printOrSavePdf', 'Print or save as PDF')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-forest-600"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{t('common.print', 'Print / PDF')}</span>
            </button>
          )}
          <span className="text-xs text-stone-500 tabular-nums" aria-live="polite">
            {processedData.length} {t('common.records', 'records')}
          </span>
        </div>
      </div>

      {/* Table Surface */}
      <div className="data-table-surface overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-stone-700 border-collapse">
            <thead className="bg-stone-50 border-b border-stone-200 text-xs font-semibold uppercase tracking-wider text-stone-700">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={sortKey === col.key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`px-4 py-3 select-none ${col.className || ''} ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.sortable ? 'cursor-pointer hover:bg-stone-100' : ''}`}
                  >
                    <button
                      type="button"
                      disabled={!col.sortable}
                      onClick={() => col.sortable && handleSort(col.key)}
                      aria-label={col.sortable ? `${col.header}, ${sortKey === col.key ? sortDirection === 'asc' ? 'ascending' : 'descending' : 'not sorted'}` : col.header}
                      className={`inline-flex items-center gap-1.5 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-forest-600 disabled:cursor-default ${
                        col.align === 'right'
                          ? 'justify-end w-full'
                          : col.align === 'center'
                          ? 'justify-center w-full'
                          : ''
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-stone-400">
                          {sortKey === col.key ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-3.5 h-3.5 text-stone-900" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-stone-900" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
                {actions && (
                  <th scope="col" className="px-4 py-3 text-right">
                    {t('common.actions', 'Actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="p-8 text-center"
                  >
                    <LoadingState message={t('common.loading', 'Loading data...')} />
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="p-8 text-center"
                  >
                    <EmptyState
                      title={emptyTitle || t('common.noRecordsFound', 'No records found')}
                      description={
                        emptyDescription ||
                        (searchTerm
                          ? t('common.tryClearingSearch', 'Try clearing your search query')
                          : t('common.noDataAvailable', 'No data available at this time'))
                      }
                      action={emptyAction}
                    />
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const key = getKey(item, idx);
                  return (
                    <tr
                      key={key}
                      onClick={() => onRowClick && onRowClick(item)}
                      className={`hover:bg-stone-50 transition-colors ${
                        onRowClick ? 'cursor-pointer' : ''
                      }`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 text-sm text-stone-800 ${col.className || ''} ${
                            col.align === 'right'
                              ? 'text-right'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          }`}
                        >
                          {col.render
                            ? col.render(item)
                            : String(item[col.key] ?? '—')}
                        </td>
                      ))}
                      {actions && (
                        <td
                          className="px-4 py-3 text-right text-sm whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {actions(item)}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {processedData.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              {t('common.showing', 'Showing')}{' '}
              <span className="font-semibold text-stone-900 font-mono">
                {Math.min(
                  (safeCurrentPage - 1) * rowsPerPage + 1,
                  processedData.length
                )}
              </span>{' '}
              {t('common.to', 'to')}{' '}
              <span className="font-semibold text-stone-900 font-mono">
                {Math.min(safeCurrentPage * rowsPerPage, processedData.length)}
              </span>{' '}
              {t('common.of', 'of')}{' '}
              <span className="font-semibold text-stone-900 font-mono">
                {processedData.length}
              </span>{' '}
              {t('common.results', 'results')}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, Math.min(p, totalPages) - 1))}
                disabled={safeCurrentPage === 1}
                className="px-2.5 py-1 text-xs border border-stone-300 bg-white font-medium text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                {t('common.previous', 'Previous')}
              </button>
              <span className="px-2 font-mono">
                {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, Math.min(p, totalPages) + 1))}
                disabled={safeCurrentPage === totalPages}
                className="px-2.5 py-1 text-xs border border-stone-300 bg-white font-medium text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-100 focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                {t('common.next', 'Next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
