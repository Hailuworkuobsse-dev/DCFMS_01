import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowRight, RefreshCw, AlertCircle, RotateCcw, X, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';

export interface LinkagePageProps {
  onNavigate: (path: string) => void;
}

export const LinkagePage: React.FC<LinkagePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const [linkages, setLinkages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formData, setFormData] = useState({ commodity: 'Durum Wheat', woreda: '', kebele: '', farmersCount: '', totalHectares: '', estimatedVolumeQt: '' });

  useEffect(() => {
    const fetchLinkages = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const res = await api.linkages.list();
        setLinkages(res.linkages);
      } catch (err) {
        console.error('Failed to load linkages:', err);
        setLoadError(err instanceof Error ? err.message : t('linkage.loadFailed', 'Unable to load market demand records.'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchLinkages();
  }, []);

  const handleCreateLinkage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError('');
    const payload = { commodity: formData.commodity, woreda: formData.woreda.trim(), kebele: formData.kebele.trim(), farmersCount: Number(formData.farmersCount), totalHectares: Number(formData.totalHectares), estimatedVolumeQt: Number(formData.estimatedVolumeQt) };
    if (!payload.woreda || !payload.kebele || payload.farmersCount <= 0 || payload.totalHectares <= 0 || payload.estimatedVolumeQt <= 0) {
      setActionError(t('linkage.validationError', 'Enter a woreda, kebele, and positive farmer, land-area and volume values.'));
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.linkages.create(payload);
      setLinkages((current) => [response.linkage, ...current]);
      setFormData({ commodity: 'Durum Wheat', woreda: '', kebele: '', farmersCount: '', totalHectares: '', estimatedVolumeQt: '' });
      setIsCreateOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('linkage.createFailed', 'Unable to create the market linkage.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDemandQt = linkages.reduce((sum, item) => sum + Number(item.estimatedVolumeQt || 0), 0);
  const matchedDemandCount = linkages.filter((item) => String(item.status || '').toUpperCase() === 'MATCHED').length;
  const columns: Column<any>[] = [
    {
      key: 'demandId',
      header: t('linkage.demandRef', 'Demand Ref'),
      render: (item) => (
        <span className="font-mono font-semibold text-stone-900">
          {item.demandId || (item.id ? `LNK-${String(item.id).slice(-4)}` : '—')}
        </span>
      ),
    },
    {
      key: 'commodity',
      header: t('linkage.commodity', 'Commodity'),
      render: (item) => (
        <div>
          <p className="font-medium text-stone-900">{item.commodity}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            {item.variety || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'buyer',
      header: t('linkage.buyer', 'Off-Taker / Buyer'),
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">{item.buyerOrgName || 'Buyer not assigned'}</p>
          <p className="text-[11px] text-stone-500">{`${item.farmersCount ?? 0} farmers · ${item.totalHectares ?? 0} ha`}</p>
        </div>
      ),
    },
    {
      key: 'demandVolume',
      header: t('linkage.demandVolume', 'Required Volume'),
      align: 'right',
      render: (item) => (
        <div className="text-right">
          <p className="font-mono font-semibold text-stone-900">
            {item.estimatedVolumeQt == null ? '—' : `${Number(item.estimatedVolumeQt).toLocaleString()} Qtl`}
          </p>
          <p className="text-[11px] text-stone-500 font-mono">
            {item.estimatedVolumeQt == null ? '—' : `${(Number(item.estimatedVolumeQt) * 100).toLocaleString()} Kg`}
          </p>
        </div>
      ),
    },
    {
      key: 'targetPrice',
      header: t('linkage.indicativePrice', 'Indicative Price'),
      align: 'right',
      render: (item) => (
        <div className="text-right font-mono font-semibold text-forest-800">
          {'Not specified'}
        </div>
      ),
    },
    {
      key: 'matchedCoops',
      header: t('linkage.matchedProducers', 'Matched Cooperatives'),
      render: (item) => (
        <span className="text-xs text-stone-700">
          {item.farmersCount == null ? 'Not assessed' : `${item.farmersCount} farmers`}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('linkage.status', 'Status'),
      render: (item) => (
        <StatusBadge status={item.status || 'UNKNOWN'} />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('linkage.title', 'Market Linkage & Demand Registry')}
        subtitle={t(
          'linkage.subtitle',
          'Connecting industrial processors, exporters, and cooperatives prior to planting season'
        )}
        actions={
          <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setIsLoading(true); setLoadError(''); void api.linkages.list().then((res) => setLinkages(res.linkages)).catch((err) => setLoadError(err instanceof Error ? err.message : t('linkage.loadFailed', 'Unable to load market demand records.'))).finally(() => setIsLoading(false)); }} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />{t('common.refresh', 'Refresh')}</button>
          <Can resource="linkage" action="create">
            <button
              type="button"
              onClick={() => { setActionError(''); setIsCreateOpen(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('linkage.publishDemand', 'Create Market Linkage')}</span>
            </button>
          </Can>
          </div>
        }
      />

      {loadError && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><div className="flex gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{t('linkage.loadFailedTitle', 'Market demand records could not be loaded')}</p><p className="mt-1">{loadError}</p></div></div><button type="button" onClick={() => { setIsLoading(true); setLoadError(''); void api.linkages.list().then((res) => setLinkages(res.linkages)).catch((err) => setLoadError(err instanceof Error ? err.message : t('linkage.loadFailed', 'Unable to load market demand records.'))).finally(() => setIsLoading(false)); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold"><RotateCcw className="h-3 w-3" />{t('common.retry', 'Retry')}</button></div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Registered Market Linkages
          </p>
          <p className="text-2xl font-bold font-mono text-stone-900 mt-1">{linkages.length.toLocaleString()} Demands</p>
          <p className="text-xs text-stone-500 mt-1">Total estimated production across linked farmers</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Total Estimated Volume
          </p>
          <p className="text-2xl font-bold font-mono text-forest-800 mt-1">{totalDemandQt ? `${(totalDemandQt / 10).toLocaleString()} MT` : '—'}</p>
          <p className="text-xs text-stone-500 mt-1">Calculated from available demand records</p>
        </div>

        <div className="bg-white border border-stone-200 p-4 shadow-xs">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Matched Linkages
          </p>
          <p className="text-2xl font-bold font-mono text-harvest-700 mt-1">{matchedDemandCount.toLocaleString()}</p>
          <p className="text-xs text-stone-500 mt-1">Records currently marked as matched</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={linkages}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('linkage.searchPlaceholder', 'Search demands, commodities, buyers...')}
        exportFileName="dcfms-linkages"
        actions={(item) => (
          <Can resource="contract" action="create">
            <button
              type="button"
              onClick={() => onNavigate(`/contracts/new?linkageId=${encodeURIComponent(String(item.id ?? ''))}`)}
              className="inline-flex items-center gap-1 rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1.5 text-xs font-semibold text-forest-800 hover:bg-forest-100"
            >
              <span>Convert to Contract</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </Can>
        )}
      />

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSubmitting) setIsCreateOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="linkage-create-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="linkage-create-title" className="text-lg font-bold text-stone-900">{t('linkage.createTitle', 'Create market linkage')}</h2><p className="mt-1 text-sm text-stone-500">Register production capacity for linkage and contract matching.</p></div><button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting} aria-label={t('common.close', 'Close')} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
            {actionError && <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</div>}
            <form onSubmit={(event) => void handleCreateLinkage(event)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-stone-700">Commodity<select required value={formData.commodity} onChange={(event) => setFormData((current) => ({ ...current, commodity: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"><option>Durum Wheat</option><option>Malt Barley</option><option>Sesame Seed</option><option>Soybean</option><option>Coffee Arabica</option><option>White Teff</option></select></label>
                <label className="block text-sm font-medium text-stone-700">Woreda<input required value={formData.woreda} onChange={(event) => setFormData((current) => ({ ...current, woreda: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" placeholder="Enter woreda" /></label>
                <label className="block text-sm font-medium text-stone-700">Kebele<input required value={formData.kebele} onChange={(event) => setFormData((current) => ({ ...current, kebele: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" placeholder="Enter kebele" /></label>
                <label className="block text-sm font-medium text-stone-700">Number of farmers<input required type="number" min="1" step="1" value={formData.farmersCount} onChange={(event) => setFormData((current) => ({ ...current, farmersCount: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-medium text-stone-700">Total land area (hectares)<input required type="number" min="0.1" step="0.1" value={formData.totalHectares} onChange={(event) => setFormData((current) => ({ ...current, totalHectares: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /></label>
                <label className="block text-sm font-medium text-stone-700">Estimated volume (quintals)<input required type="number" min="0.1" step="0.1" value={formData.estimatedVolumeQt} onChange={(event) => setFormData((current) => ({ ...current, estimatedVolumeQt: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm" /></label>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4"><button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-900 disabled:opacity-50">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSubmitting ? 'Saving…' : 'Create linkage'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
