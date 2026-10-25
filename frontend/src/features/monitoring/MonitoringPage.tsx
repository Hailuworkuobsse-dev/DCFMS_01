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

export interface MonitoringPageProps {
  onNavigate?: (path: string) => void;
}

export const MonitoringPage: React.FC<MonitoringPageProps> = () => {
  const { t } = useTranslation();
  const { isOnline, isOfflineSimulated } = useAppStore();
  const [records, setRecords] = useState<MonitoringRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // New Inspection Form
  const [stage, setStage] = useState<'PLANTING' | 'VEGETATIVE' | 'FLOWERING' | 'GRAIN_FILLING' | 'MATURITY' | 'HARVEST_READY'>('GRAIN_FILLING');
  const [cropHealth, setCropHealth] = useState<'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'>('GOOD');
  const [estimatedYieldKg, setEstimatedYieldKg] = useState(19500);
  const [lat, setLat] = useState(8.0321);
  const [lng, setLng] = useState(39.2145);
  const [notes, setNotes] = useState('Crop stands in good condition. No armyworm infestation observed. Moisture adequate.');

  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await api.monitoring.list();
      setRecords(res.reports || []);
    } catch (err) {
      console.error('Failed to load monitoring records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.monitoring.create({
        contractId: 'CTR-2026-001',
        cropStage: stage,
        estimatedYieldQt: Math.round(Number(estimatedYieldKg) / 100),
        gpsLat: Number(lat),
        gpsLng: Number(lng),
        qualityNotes: notes,
      });
      setIsFormOpen(false);
      await fetchRecords();
    } catch (err) {
      console.error('Failed to create inspection:', err);
    }
  };

  const effectiveOnline = isOnline && !isOfflineSimulated;

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
          <Can permission="monitoring:create:woreda">
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
        <div className="p-3 bg-harvest-50 border border-harvest-300 text-xs text-harvest-900 flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0 text-harvest-700" />
          <span>
            {t(
              'monitoring.offlineNotice',
              'Offline Field Mode Active: You can record GPS inspections in remote kebeles. Records will automatically sync to the federal database when connectivity returns.'
            )}
          </span>
        </div>
      )}

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Growth Stage
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as any)}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="PLANTING">Planting / Germination</option>
                    <option value="VEGETATIVE">Vegetative Tillering</option>
                    <option value="FLOWERING">Flowering / Booting</option>
                    <option value="GRAIN_FILLING">Grain Filling (Milk/Dough)</option>
                    <option value="MATURITY">Maturity</option>
                    <option value="HARVEST_READY">Harvest Ready</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Crop Health Condition
                  </label>
                  <select
                    value={cropHealth}
                    onChange={(e) => setCropHealth(e.target.value as any)}
                    className="w-full text-xs bg-white border border-stone-300 p-2"
                  >
                    <option value="EXCELLENT">Excellent (No defects)</option>
                    <option value="GOOD">Good (Normal stand)</option>
                    <option value="FAIR">Fair (Minor water/pest stress)</option>
                    <option value="POOR">Poor (Alert triggered)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Estimated Yield (Kg)
                  </label>
                  <input
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
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    GPS Coordinates (Ethiopian Bounds)
                  </label>
                  <div className="flex gap-1 font-mono text-xs">
                    <input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(Number(e.target.value))}
                      className="w-1/2 p-2 border border-stone-300"
                      placeholder="Lat °N"
                    />
                    <input
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
