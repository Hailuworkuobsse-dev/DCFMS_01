import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, WifiOff } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { DataTable, Column } from '../../components/primitives/DataTable';
import { Can } from '../../components/primitives/PermissionGate';
import { api } from '../../lib/api/client';
import { MonitoringRecord } from '../../types/api';
import { useAppStore } from '../../store/useAppStore';
import { formatShortDate } from '../../lib/utils/format';
import {
  cacheOfflineContractReferences,
  enqueueOfflineMutation,
  getOfflineContractReferences,
  OfflineContractReference,
} from '../../lib/offline/syncQueue';

export interface MonitoringPageProps {
  onNavigate?: (path: string) => void;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = () => {
  const { t } = useTranslation();
  const { isOnline, isOfflineSimulated, user, activeScope, refreshQueuedCount } = useAppStore();
  const effectiveOnline = isOnline && !isOfflineSimulated;
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [contracts, setContracts] = useState<OfflineContractReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [formStatus, setFormStatus] = useState('');

  // New Inspection Form
  const [stage, setStage] = useState<'Planting' | 'Vegetative' | 'Flowering' | 'PreHarvest' | 'HarvestReady'>('PreHarvest');
  const [cropHealth, setCropHealth] = useState<'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'>('GOOD');
  const [germinationRatePct, setGerminationRatePct] = useState(90);
  const [inputAppliedCorrectly, setInputAppliedCorrectly] = useState(true);
  const [estimatedYieldKg, setEstimatedYieldKg] = useState(19500);
  const [lat, setLat] = useState(8.0321);
  const [lng, setLng] = useState(39.2145);
  const [contractId, setContractId] = useState('');
  const [notes, setNotes] = useState('');

  const fetchRecords = async () => {
    setIsLoading(true);
    setFormError('');
    try {
      if (!effectiveOnline) {
        const cachedContracts = user && activeScope
          ? await getOfflineContractReferences(user.id, activeScope.id)
          : [];
        setRecords([]);
        setContracts(cachedContracts);
        setContractId((current) =>
          cachedContracts.some((contract) => contract.id === current)
            ? current
            : cachedContracts[0]?.id || ''
        );
        if (cachedContracts.length === 0) {
          setFormError(t('monitoring.offlineContractsUnavailable', 'No contracts are cached on this device. Connect while online to load contract references before capturing inspections offline.'));
        }
        return;
      }

      const [reportResponse, contractResponse] = await Promise.all([
        api.monitoring.list(),
        api.contracts.list(),
      ]);
      const contractReferences = contractResponse.contracts.map(({ id, contractNumber, commodity, producerName }) => ({
        id,
        contractNumber,
        commodity,
        producerName,
      }));
      setRecords(reportResponse.reports || []);
      setContracts(contractReferences);
      setContractId((current) =>
        contractReferences.some((contract) => contract.id === current)
          ? current
          : contractReferences[0]?.id || ''
      );
      if (user && activeScope) {
        try {
          await cacheOfflineContractReferences(contractReferences, user.id, activeScope.id);
        } catch (cacheError) {
          console.error('Failed to cache offline contract references:', cacheError);
          setFormError(t('monitoring.offlineCacheFailed', 'Contract references could not be saved for offline use.'));
        }
      }
    } catch (err) {
      console.error('Failed to load monitoring records:', err);
      setFormError(err instanceof Error ? err.message : 'Unable to load monitoring data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchRecords();
  }, [activeScope?.id, effectiveOnline]);

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeScope || !contractId) return;
    const payload = {
      contractId,
      cropStage: stage,
      germinationRatePct,
      inputAppliedCorrectly,
      sideSellingRisk: cropHealth === 'POOR' ? 'High' as const : cropHealth === 'FAIR' ? 'Medium' as const : 'Low' as const,
      pestOrWeatherAlert: 'None',
      estimatedYieldQt: Math.round(Number(estimatedYieldKg) / 100),
      gpsLat: Number(lat),
      gpsLng: Number(lng),
      qualityNotes: notes.trim(),
    };
    setFormError('');
    setFormStatus('');
    try {
      if (!effectiveOnline) {
        await enqueueOfflineMutation({
          endpoint: '/api/monitoring',
          method: 'POST',
          moduleLabel: 'monitoring',
          summary: `${stage} field visit for ${contracts.find((contract) => contract.id === contractId)?.contractNumber ?? contractId}`,
          payload,
          ownerId: user.id,
          scopeId: activeScope.id,
        });
        await refreshQueuedCount();
        setFormStatus(t('monitoring.offlineSaved', 'Inspection saved on this device. It will sync when you reconnect using this account and scope.'));
      } else {
        await api.monitoring.create(payload);
        setFormStatus(t('monitoring.inspectionSaved', 'Inspection submitted successfully.'));
        await fetchRecords();
      }
      setIsFormOpen(false);
    } catch (err) {
      console.error('Failed to create inspection:', err);
      setFormError(err instanceof Error ? err.message : 'Unable to save this inspection.');
    }
  };

  const columns: Column<MonitoringRecord>[] = [
    {
      key: 'inspectionDate',
      header: t('monitoring.date', 'Inspection Date'),
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-stone-900">
          {formatShortDate(item.createdAt || item.inspectionDate || '2026-08-15')}
        </span>
      ),
    },
    {
      key: 'contractId',
      header: t('monitoring.contract', 'Contract / Location'),
      render: (item) => (
        <div>
          <p className="font-semibold text-stone-900">Contract #{item.contractId?.slice(0, 8)}</p>
          <p className="text-[11px] text-stone-500 font-mono">
            {item.gpsLat && item.gpsLng
              ? `${item.gpsLat.toFixed(4)}°N, ${item.gpsLng.toFixed(4)}°E`
              : item.gpsCoordinates
              ? `${item.gpsCoordinates.latitude.toFixed(4)}°N, ${item.gpsCoordinates.longitude.toFixed(4)}°E`
              : 'Geotagged'}
          </p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: t('monitoring.growthStage', 'Crop Growth Stage'),
      render: (item) => (
        <span className="text-xs font-semibold text-stone-800">
          {item.cropStage || item.stage || 'Vegetative'}
        </span>
      ),
    },
    {
      key: 'cropHealth',
      header: t('monitoring.health', 'Health Assessment'),
      render: (item) => {
        const health = item.cropHealth || (item.sideSellingRisk === 'Low' ? 'GOOD' : 'FAIR');
        const color =
          health === 'EXCELLENT' || health === 'GOOD'
            ? 'text-forest-700 bg-forest-50 border-forest-200'
            : 'text-harvest-700 bg-harvest-50 border-harvest-200';
        return (
          <span className={`text-xs px-2 py-0.5 border font-semibold ${color}`}>
            {health}
          </span>
        );
      },
    },
    {
      key: 'estimatedYieldKg',
      header: t('monitoring.yieldEstimate', 'Yield Estimate'),
      align: 'right',
      render: (item) => {
        const yieldVal = item.estimatedYieldQt
          ? item.estimatedYieldQt
          : item.estimatedYieldKg
          ? item.estimatedYieldKg / 100
          : 195;
        return (
          <div className="text-right font-mono font-semibold text-stone-900">
            {yieldVal.toFixed(1)} Qtl
          </div>
        );
      },
    },
    {
      key: 'inspectorName',
      header: t('monitoring.inspector', 'Inspector / DA'),
      render: (item) => (
        <div>
          <p className="text-xs font-medium text-stone-800">{item.inspectorName || 'Kebele DA'}</p>
          <p className="text-[11px] text-stone-500">{item.inspectorRole || 'Development Agent'}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('monitoring.title', 'Field Monitoring & Plot Inspections')}
        subtitle={t(
          'monitoring.subtitle',
          'Geotagged DA plot inspections, crop health checks, and pre-harvest yield estimations'
        )}
        actions={
          <Can resource="monitoring" action="create">
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('monitoring.recordInspection', 'Record Plot Inspection')}</span>
            </button>
          </Can>
        }
      />

      {!effectiveOnline && (
        <div role="status" className="p-3 bg-harvest-50 border border-harvest-300 text-xs text-harvest-900 flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0 text-harvest-700" />
          <span>
            {t(
              'monitoring.offlineNotice',
              'Offline Field Mode Active: You can record GPS inspections in remote kebeles. Records will automatically sync to the federal database when connectivity returns.'
            )}
          </span>
        </div>
      )}
      {formStatus && <div role="status" aria-live="polite" className="border border-forest-200 bg-forest-50 p-3 text-sm text-forest-800">{formStatus}</div>}
      {formError && <div role="alert" className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{formError}</div>}

      <DataTable
        columns={columns}
        data={records}
        keyField="id"
        isLoading={isLoading}
        searchPlaceholder={t('monitoring.searchPlaceholder', 'Search inspections, stages, kebeles...')}
        exportFileName="dcfms-plot-inspections"
      />

      {/* Record Inspection Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-stone-300 shadow-xl p-6">
            <h3 className="text-base font-bold text-stone-900 mb-1">
              {t('monitoring.newInspectionTitle', 'Record Field Plot Inspection')}
            </h3>
            <p className="text-xs text-stone-600 mb-4">
              Development Agent (DA) statutory pre-harvest evaluation.
            </p>

            <form onSubmit={handleCreateInspection} className="space-y-4">
              <div>
                <label htmlFor="inspection-contract" className="block text-xs font-semibold text-stone-700 mb-1">
                  {t('monitoring.contract', 'Contract')}
                </label>
                <select
                  id="inspection-contract"
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
                  <label htmlFor="inspection-stage" className="block text-xs font-semibold text-stone-700 mb-1">
                    Growth Stage
                  </label>
                  <select
                    id="inspection-stage"
                    value={stage}
                    onChange={(e) => setStage(e.target.value as typeof stage)}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="Planting">Planting / Germination</option>
                    <option value="Vegetative">Vegetative Tillering</option>
                    <option value="Flowering">Flowering / Booting</option>
                    <option value="PreHarvest">Grain Filling / Maturity</option>
                    <option value="HarvestReady">Harvest Ready</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="inspection-health" className="block text-xs font-semibold text-stone-700 mb-1">
                    Crop Health Condition
                  </label>
                  <select
                    id="inspection-health"
                    value={cropHealth}
                    onChange={(e) => setCropHealth(e.target.value as typeof cropHealth)}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="EXCELLENT">Excellent (No defects)</option>
                    <option value="GOOD">Good (Normal stand)</option>
                    <option value="FAIR">Fair (Minor water/pest stress)</option>
                    <option value="POOR">Poor (Alert triggered)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="inspection-germination" className="block text-xs font-semibold text-stone-700 mb-1">
                    {t('monitoring.germinationRate', 'Germination rate (%)')}
                  </label>
                  <input
                    id="inspection-germination"
                    required
                    min="0"
                    max="100"
                    type="number"
                    value={germinationRatePct}
                    onChange={(event) => setGerminationRatePct(Number(event.target.value))}
                    className="w-full text-xs bg-white border border-stone-300 p-2 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="inspection-inputs" className="block text-xs font-semibold text-stone-700 mb-1">
                    {t('monitoring.inputCheck', 'Inputs applied correctly')}
                  </label>
                  <select
                    id="inspection-inputs"
                    value={inputAppliedCorrectly ? 'yes' : 'no'}
                    onChange={(event) => setInputAppliedCorrectly(event.target.value === 'yes')}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="yes">{t('common.yes', 'Yes')}</option>
                    <option value="no">{t('common.no', 'No')}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="inspection-yield" className="block text-xs font-semibold text-stone-700 mb-1">
                    {t('monitoring.yieldEstimate', 'Estimated Yield (Kg)')}
                  </label>
                  <input
                    id="inspection-yield"
                    required
                    min="1"
                    type="number"
                    value={estimatedYieldKg}
                    onChange={(e) => setEstimatedYieldKg(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-stone-300 p-2 font-mono"
                  />
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    = {(estimatedYieldKg / 100).toFixed(1)} Quintals
                  </p>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-stone-700 mb-1">
                    GPS Coordinates (Ethiopian Bounds)
                  </span>
                  <div className="flex gap-1 font-mono text-xs">
                    <input
                      aria-label={t('monitoring.latitude', 'Latitude')}
                      required
                      min="3"
                      max="15"
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(Number(e.target.value))}
                      className="w-1/2 p-2 border border-stone-300"
                      placeholder="Lat °N"
                    />
                    <input
                      aria-label={t('monitoring.longitude', 'Longitude')}
                      required
                      min="32"
                      max="48"
                      type="number"
                      step="0.0001"
                      value={lng}
                      onChange={(e) => setLng(Number(e.target.value))}
                      className="w-1/2 p-2 border border-stone-300"
                      placeholder="Lon °E"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  DA Field Observations
                </label>
                <textarea
                  required
                  minLength={4}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs bg-white border border-stone-300 p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!contractId || !notes.trim() || Number(estimatedYieldKg) <= 0}
                  className="px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900"
                >
                  {t('monitoring.saveInspection', 'Save & Commit Inspection')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
