import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Download,
  X,
} from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { api } from '../../lib/api/client';
import { AuditLogEntry } from '../../types/api';
import { formatShortDate, downloadTextFile } from '../../lib/utils/format';

export interface AdminPageProps {
  onNavigate: (path: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState<'not-run' | 'valid' | 'invalid'>('not-run');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const res = await api.admin.getAuditLogs();
        setLogs(res.logs);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const handleVerifyChain = () => {
    const ordered = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const missingHashes = ordered.some((entry) => !entry.entryHash || !entry.previousHash);
    const brokenLink = ordered.some((entry, index) => index > 0 && entry.previousHash !== ordered[index - 1].entryHash);
    setChainStatus(missingHashes || brokenLink ? 'invalid' : 'valid');
  };

  const handleExportAuditLogs = () => {
    downloadTextFile(
      `DCFMS-Audit-Log-Chain-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(logs, null, 2),
      'application/json;charset=utf-8;'
    );
  };

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'id',
      header: 'Seq #',
      render: (item) => (
        <span className="font-mono text-xs font-bold text-stone-900">
          #{item.id}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action / Event',
      render: (item) => (
        <div>
          <p className="font-mono text-xs font-semibold text-stone-900">{item.action}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            {item.resource} • {item.resourceId}
          </p>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor & Role',
      render: (item) => (
        <div>
          <p className="text-xs font-semibold text-stone-800">{item.actorName}</p>
          <p className="text-[11px] text-stone-500 font-mono">{item.actorRole}</p>
        </div>
      ),
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (item) => (
        <span className="text-xs font-mono text-stone-500">
          {formatShortDate(item.timestamp)}
        </span>
      ),
    },
    {
      key: 'hash',
      header: 'SHA-256 Cryptographic Hash',
      render: (item) => (
        <div className="font-mono text-[10px] text-stone-500 max-w-[160px] truncate" title={item.entryHash}>
          {item.entryHash.slice(0, 16)}...
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.title', 'System Administration & Cryptographic Audit')}
        subtitle={t(
          'admin.subtitle',
          'Tamper-evident audit trail, external interoperability gateways, and platform security'
        )}
        actions={
          <button
            type="button"
            onClick={handleExportAuditLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export Tamper-Evident Ledger</span>
          </button>
        }
      />

      {/* Security Status Box */}
      <div className="bg-white border border-stone-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-forest-700" />
            <h3 className="text-sm font-bold text-stone-900">
              Chained Audit Ledger Verification
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {chainStatus !== 'not-run' && (
              <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${chainStatus === 'valid' ? 'border-forest-200 bg-forest-50 text-forest-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                {chainStatus === 'valid' ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldX className="h-3.5 w-3.5" />}
                {chainStatus === 'valid' ? 'Hash links consistent' : 'Chain link mismatch detected'}
              </span>
            )}
            <button type="button" onClick={handleVerifyChain} disabled={isLoading || logs.length === 0} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">Verify hash links</button>
          </div>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed mb-4">
          Select “Verify hash links” to compare each audit entry's predecessor reference with the prior entry's hash. This checks chain continuity; it does not independently recompute the original digest or replace server-side immutable storage.
        </p>

        <DataTable
          columns={columns}
          data={logs}
          keyField="id"
          isLoading={isLoading}
          searchPlaceholder="Search audit events, actors, actions..."
          exportFileName="dcfms-audit-trail"
          onRowClick={(item) => setSelectedLog(item)}
        />
        {selectedLog && (
          <section aria-label="Audit entry details" className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-stone-900">Audit entry details · {selectedLog.id}</h3><button type="button" onClick={() => setSelectedLog(null)} aria-label="Close audit details" className="rounded-lg p-1.5 text-stone-500 hover:bg-white"><X className="h-4 w-4" /></button></div>
            <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div><dt className="font-semibold text-stone-500">Summary</dt><dd className="mt-1 text-stone-900">{selectedLog.summary || '—'}</dd></div>
              <div><dt className="font-semibold text-stone-500">Scope</dt><dd className="mt-1 text-stone-900">{selectedLog.scope || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="font-semibold text-stone-500">Previous hash</dt><dd className="mt-1 break-all font-mono text-stone-700">{selectedLog.previousHash || '—'}</dd></div>
              <div className="sm:col-span-2"><dt className="font-semibold text-stone-500">Entry hash</dt><dd className="mt-1 break-all font-mono text-stone-700">{selectedLog.entryHash || '—'}</dd></div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
};
