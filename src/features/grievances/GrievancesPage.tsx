import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { Grievance } from '../../types/api';
import { formatShortDate } from '../../lib/utils/format';

export interface GrievancesPageProps {
  onNavigate?: (path: string) => void;
}

export const GrievancesPage: React.FC<GrievancesPageProps> = () => {
  const { t } = useTranslation();
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Form State
  const [category, setCategory] = useState<'PRICE' | 'QUALITY' | 'DELIVERY' | 'PAYMENT' | 'INPUT' | 'BREACH'>('QUALITY');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [title, setTitle] = useState('Grain moisture dispute at intake warehouse');
  const [description, setDescription] = useState('Agro-processor test meter showed 13.2% moisture while DA certified meter showed 12.1%. Requested secondary verification by WBoA.');

  const fetchGrievances = async () => {
    setIsLoading(true);
    try {
      const res = await api.grievances.list();
      setGrievances(res.grievances);
    } catch (err) {
      console.error('Failed to load grievances:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGrievances();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.grievances.create({
        contractId: 'CTR-2026-001',
        category,
        severity,
        title,
        description,
      });
      setIsNewModalOpen(false);
      await fetchGrievances();
    } catch (err) {
      console.error('Failed to file grievance:', err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await api.grievances.resolve(id, {
        resolutionNotes: 'Parties agreed to secondary grain testing by WBoA accredited laboratory. Price adjusted accordingly.',
      });
      await fetchGrievances();
    } catch (err) {
      console.error('Failed to resolve grievance:', err);
    }
  };

  const columns: Column<Grievance>[] = [
    {
      key: 'caseNumber',
      header: t('grievances.caseNumber', 'Case #'),
      render: (item) => (
        <span className="font-mono font-bold text-stone-900">
          {item.caseNumber || `GRV-2025-${item.id.slice(-4)}`}
        </span>
      ),
    },
    {
      key: 'title',
      header: t('grievances.subject', 'Dispute Subject'),
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">{item.title}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            Contract #{item.contractId?.slice(0, 8)} • Filed by {item.complainantName}
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('grievances.category', 'Category'),
      render: (item) => (
        <span className="text-xs font-mono font-medium text-stone-700">
          {item.category}
        </span>
      ),
    },
    {
      key: 'severity',
      header: t('grievances.severity', 'Severity'),
      render: (item) => {
        const color =
          item.severity === 'CRITICAL' || item.severity === 'HIGH'
            ? 'bg-rose-50 text-rose-800 border-rose-300'
            : 'bg-harvest-50 text-harvest-800 border-harvest-300';
        return (
          <span className={`text-[11px] px-2 py-0.5 border font-semibold ${color}`}>
            {item.severity}
          </span>
        );
      },
    },
    {
      key: 'stage',
      header: t('grievances.forum', 'Forum'),
      render: (item) => (
        <span className="text-xs text-stone-600">
          {item.stage === 'COURT' ? 'Woreda Court Bench' : 'WBoA Conciliation'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('grievances.status', 'Status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'createdAt',
      header: t('grievances.filed', 'Filed Date'),
      render: (item) => (
        <span className="text-xs font-mono text-stone-500">
          {formatShortDate(item.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('grievances.title', 'Grievance & Dispute Resolution')}
        subtitle={t(
          'grievances.subtitle',
          'Statutory conciliation, tripartite mediation, and judicial adjudication under Proclamation No. 1289/2023'
        )}
        actions={
          <Can permission="grievance:create:own">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('grievances.fileNew', 'File Dispute')}</span>
            </button>
          </Can>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Woreda Mediation Cases</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">4 Open</p>
          <p className="text-xs text-stone-500 mt-1">15-day statutory conciliation</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Judicial Escalations</p>
          <p className="text-2xl font-bold font-mono text-earth-800 mt-1">1 Case</p>
          <p className="text-xs text-stone-500 mt-1">Woreda Court docket</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Amicable Settlements</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">92.4%</p>
          <p className="text-xs text-stone-500 mt-1">Resolved without court intervention</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={grievances}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('grievances.searchPlaceholder', 'Search disputes, contract #, parties...')}
        exportFileName="dcfms-grievances"
        actions={(item) =>
          item.status !== 'RESOLVED' ? (
            <Can permission="grievance:approve:woreda">
              <button
                type="button"
                onClick={() => handleResolve(item.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolve Dispute</span>
              </button>
            </Can>
          ) : (
            <span className="text-xs text-stone-400 font-mono">Resolved</span>
          )
        }
      />

      {/* New Grievance Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-stone-300 shadow-xl p-6">
            <h3 className="text-base font-bold text-stone-900 mb-1">
              File Official Contract Dispute
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              Under Ethiopian Contract Farming Proclamation 1289/2023.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Dispute Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="QUALITY">Quality & Moisture Dispute</option>
                    <option value="PRICE">Price Floor Breach</option>
                    <option value="DELIVERY">Delivery Delay / Refusal</option>
                    <option value="PAYMENT">Payment Default / Escrow</option>
                    <option value="INPUT">Input Quality / Delay</option>
                    <option value="BREACH">Side Selling / General Breach</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Severity Level
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High (Urgent intake)</option>
                    <option value="CRITICAL">Critical (Total loss risk)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Dispute Summary
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Detailed Claim & Evidence
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
                >
                  Submit for WBoA Mediation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
