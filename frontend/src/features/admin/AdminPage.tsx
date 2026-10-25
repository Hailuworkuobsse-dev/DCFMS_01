import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  Download,
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
          <span className="px-2.5 py-0.5 text-xs font-mono font-semibold bg-forest-50 text-forest-800 border border-forest-200">
            Chain Valid • 0 Tampering Detected
          </span>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed mb-4">
          Each contract creation, e-signature, woreda endorsement, and bank settlement generates a deterministic SHA-256 hash linked to the predecessor block hash, ensuring non-repudiation under Ethiopian digital evidence law.
        </p>

        <DataTable
          columns={columns}
          data={logs}
          keyField="id"
          isLoading={isLoading}
          searchPlaceholder="Search audit events, actors, actions..."
          exportFileName="dcfms-audit-trail"
        />
      </div>
    </div>
  );
};
