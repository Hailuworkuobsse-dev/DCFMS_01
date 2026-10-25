import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, CheckCircle2, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { Contract, Grievance } from '../../types/api';
import { formatShortDate } from '../../lib/utils/format';
import { useAppStore } from '../../store/useAppStore';

export interface GrievancesPageProps {
  onNavigate?: (path: string) => void;
}

export const GrievancesPage: React.FC<GrievancesPageProps> = () => {
  const { t } = useTranslation();
  const user = useAppStore((state) => state.user);
  const activeScopeId = useAppStore((state) => state.activeScope?.id);
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ grievance: Grievance; action: 'resolve' | 'escalate' } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [pendingActionId, setPendingActionId] = useState('');

  // Form State
  const [category, setCategory] = useState<'PRICE' | 'QUALITY' | 'DELIVERY' | 'PAYMENT' | 'INPUT' | 'BREACH'>('QUALITY');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [contractId, setContractId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const fetchGrievances = async () => {
    setIsLoading(true);
    try {
      const [grievanceRes, contractRes] = await Promise.all([api.grievances.list(), api.contracts.list()]);
      setGrievances(grievanceRes.grievances);
      setContracts(contractRes.contracts);
      setContractId((current) =>
        contractRes.contracts.some((contract) => contract.id === current)
          ? current
          : contractRes.contracts[0]?.id || ''
      );
    } catch (err) {
      console.error('Failed to load grievances:', err);
      setActionError(err instanceof Error ? err.message : 'Unable to load grievance data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchGrievances();
  }, [activeScopeId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !contractId) return;
    setActionError('');
    try {
      await api.grievances.create({
        contractId,
        category,
        severity,
        title,
        description,
      });
      setTitle('');
      setDescription('');
      setIsNewModalOpen(false);
      await fetchGrievances();
    } catch (err) {
      console.error('Failed to file grievance:', err);
      setActionError(err instanceof Error ? err.message : 'Unable to file the grievance.');
    }
  };

  const handleCaseAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingAction) return;
    setPendingActionId(pendingAction.grievance.id);
    setActionError('');
    try {
      if (pendingAction.action === 'resolve') {
        await api.grievances.resolve(pendingAction.grievance.id, { resolutionNotes: actionReason.trim() });
      } else {
        await api.grievances.escalate(pendingAction.grievance.id, { reason: actionReason.trim() });
      }
      setPendingAction(null);
      setActionReason('');
      await fetchGrievances();
    } catch (err) {
      console.error('Failed to update grievance:', err);
      setActionError(err instanceof Error ? err.message : 'Unable to update the grievance.');
    } finally {
      setPendingActionId('');
    }
  };

  const resolvedGrievances = grievances.filter((item) => ['Resolved', 'RESOLVED', 'DISMISSED'].includes(String(item.status))).length;
  const openGrievances = grievances.length - resolvedGrievances;
  const courtEscalations = grievances.filter((item) => item.escalationLevel === 'CourtArbitration').length;
  const resolutionRate = grievances.length ? (resolvedGrievances / grievances.length) * 100 : 0;

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
          <p className="font-semibold text-stone-900">{item.title || item.category}</p>
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
          {item.escalationLevel}
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
          <div className="flex items-center gap-2">
          <button type="button" onClick={() => void fetchGrievances()} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />{t('common.refresh', 'Refresh')}</button>
          <Can resource="grievance" action="create">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('grievances.fileNew', 'File Dispute')}</span>
            </button>
          </Can>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Open grievance cases</p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{openGrievances.toLocaleString()}</p>
          <p className="text-xs text-stone-500 mt-1">Current authorized case list</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Court escalations</p>
          <p className="text-2xl font-bold font-mono text-earth-800 mt-1">{courtEscalations.toLocaleString()}</p>
          <p className="text-xs text-stone-500 mt-1">Cases at court arbitration stage</p>
        </div>
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase">Cases resolved</p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{resolutionRate.toFixed(1)}%</p>
          <p className="text-xs text-stone-500 mt-1">{resolvedGrievances} of {grievances.length} loaded cases resolved or dismissed</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={grievances}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('grievances.searchPlaceholder', 'Search disputes, contract #, parties...')}
        exportFileName="dcfms-grievances"
        actions={(item) => {
          const isResolved = item.status === 'Resolved' || item.status === 'RESOLVED' || item.status === 'DISMISSED';
          const canEscalate = !isResolved && item.escalationLevel !== 'CourtArbitration';
          if (isResolved) {
            return <span className="text-xs text-stone-400 font-mono">{t('grievances.resolved', 'Resolved')}</span>;
          }
          return (
            <div className="flex items-center gap-2">
              {canEscalate && (
                <Can resource="grievance" action="escalate">
                  <button
                    type="button"
                    onClick={() => {
                      setActionReason('');
                      setPendingAction({ grievance: item, action: 'escalate' });
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-stone-800 border border-stone-300 hover:bg-stone-50"
                  >
                    {t('grievances.escalate', 'Escalate')}
                  </button>
                </Can>
              )}
              <Can resource="grievance" action="update">
                <button
                  type="button"
                  onClick={() => {
                    setActionReason('');
                    setPendingAction({ grievance: item, action: 'resolve' });
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('grievances.resolve', 'Resolve')}</span>
                </button>
              </Can>
            </div>
          );
        }}
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
              <div>
                <label htmlFor="grievance-contract" className="block text-xs font-semibold text-stone-700 mb-1">
                  {t('grievances.contract', 'Related contract')}
                </label>
                <select
                  id="grievance-contract"
                  required
                  value={contractId}
                  onChange={(event) => setContractId(event.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 p-2"
                >
                  <option value="" disabled>{t('common.select', 'Select a contract')}</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.contractNumber} · {contract.commodity} · {contract.producerName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Dispute Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as typeof category)}
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
                    onChange={(e) => setSeverity(e.target.value as typeof severity)}
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
                  required
                  minLength={5}
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
                  required
                  minLength={10}
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
                  disabled={!contractId || title.trim().length < 5 || description.trim().length < 10}
                  className="px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 disabled:opacity-50"
                >
                  Submit for WBoA Mediation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {actionError && (
        <div role="alert" className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {actionError}
        </div>
      )}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <form onSubmit={handleCaseAction} className="w-full max-w-md space-y-4 border border-stone-300 bg-white p-6 shadow-xl">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {pendingAction.action === 'resolve'
                  ? t('grievances.resolveTitle', 'Record grievance resolution')
                  : t('grievances.escalateTitle', 'Escalate grievance')}
              </h2>
              <p className="mt-1 text-xs text-stone-600">{pendingAction.grievance.caseNumber}</p>
            </div>
            <label className="block text-xs font-semibold text-stone-700">
              {pendingAction.action === 'resolve'
                ? t('grievances.resolutionSummary', 'Resolution and evidence summary')
                : t('grievances.escalationReason', 'Reason for escalation')}
              <textarea
                required
                minLength={pendingAction.action === 'resolve' ? 10 : 5}
                value={actionReason}
                onChange={(event) => setActionReason(event.target.value)}
                rows={4}
                className="mt-1 w-full border border-stone-300 p-2 text-sm font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  pendingActionId === pendingAction.grievance.id ||
                  actionReason.trim().length < (pendingAction.action === 'resolve' ? 10 : 5)
                }
                className="bg-forest-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pendingActionId === pendingAction.grievance.id
                  ? t('common.saving', 'Saving...')
                  : pendingAction.action === 'resolve'
                    ? t('grievances.resolve', 'Resolve')
                    : t('grievances.escalate', 'Escalate')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
