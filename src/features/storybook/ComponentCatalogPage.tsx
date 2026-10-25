import React from 'react';
import { Palette } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { StatusBadge } from '../../components/primitives/StatusBadge';
import { StatCard } from '../../components/primitives/StatCard';
import { EmptyState, ErrorState } from '../../components/primitives/States';
import { ContractStatus } from '../../types/api';

export const ComponentCatalogPage: React.FC = () => {
  const sampleStatuses: ContractStatus[] = [
    'Draft',
    'Signed',
    'Approved',
    'Completed',
    'Adjusted',
    'Rejected',
    'ACTIVE',
    'DISPUTED',
    'SETTLED',
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <PageHeader
        title="DCFMS Design System & Component Catalog"
        subtitle="Zero-pill, high-contrast, low-bandwidth UI components adhering to Ethiopian agricultural standards."
        badge={
          <span className="font-mono text-xs px-2 py-0.5 bg-stone-100 text-stone-800 border border-stone-300">
            WCAG 2.1 AA Compliant
          </span>
        }
      />

      {/* Palette Section */}
      <section className="bg-white border border-stone-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <Palette className="w-4 h-4 text-forest-700" />
          <span>Color System (Agricultural Earth Tokens)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-forest-800 text-white border border-forest-900">
            <p className="font-bold">Forest 800</p>
            <p className="font-mono text-[11px] opacity-80">#1b4332</p>
            <p className="text-[10px] mt-2">Primary branding, government approval</p>
          </div>
          <div className="p-3 bg-harvest-600 text-stone-900 border border-harvest-700">
            <p className="font-bold">Harvest 600</p>
            <p className="font-mono text-[11px] opacity-80">#d97706</p>
            <p className="text-[10px] mt-2">Crops, alerts, pending states</p>
          </div>
          <div className="p-3 bg-earth-800 text-white border border-earth-900">
            <p className="font-bold">Earth 800</p>
            <p className="font-mono text-[11px] opacity-80">#92400e</p>
            <p className="text-[10px] mt-2">Soil, grain quotas, legal benches</p>
          </div>
          <div className="p-3 bg-stone-900 text-white border border-stone-950">
            <p className="font-bold">Stone 900</p>
            <p className="font-mono text-[11px] opacity-80">#1c1917</p>
            <p className="text-[10px] mt-2">High contrast typography, buttons</p>
          </div>
        </div>
      </section>

      {/* Status Badges Section */}
      <section className="bg-white border border-stone-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-900">
          Contract Lifecycle Status Badges (Zero-Pill Rectangular)
        </h3>
        <div className="flex flex-wrap gap-2.5">
          {sampleStatuses.map((st) => (
            <StatusBadge key={st} status={st} />
          ))}
        </div>
      </section>

      {/* Button Styles */}
      <section className="bg-white border border-stone-200 p-6 space-y-4">
        <h3 className="text-sm font-bold text-stone-900">Button Disciplines (No Pill Radii)</h3>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900">
            Primary Forest
          </button>
          <button className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800">
            Primary Neutral
          </button>
          <button className="px-4 py-2 text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50">
            Secondary Outline
          </button>
          <button className="px-4 py-2 text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-300 hover:bg-rose-100">
            Destructive
          </button>
          <button disabled className="px-4 py-2 text-xs font-semibold text-stone-400 bg-stone-100 border border-stone-200 cursor-not-allowed">
            Disabled State
          </button>
        </div>
      </section>

      {/* StatCards */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-stone-900">KPI StatCards</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Active Contracts"
            value="7,834"
            change="+14.2% MoM"
            trend="up"
            color="forest"
          />
          <StatCard
            title="Total Grain Volume"
            value="424,000 MT"
            change="On target"
            trend="neutral"
            color="harvest"
          />
          <StatCard
            title="Dispute Rate"
            value="1.2%"
            change="-0.4% MoM"
            trend="up"
            color="earth"
          />
        </div>
      </section>

      {/* System States */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white border border-stone-200">
          <EmptyState
            title="Empty Table Demo"
            description="When no records match the filter criteria."
          />
        </div>
        <div className="p-6 bg-white border border-stone-200">
          <ErrorState
            title="Error Notice Demo"
            description="Connection interrupted. Click retry to refresh."
            onRetry={() => {}}
          />
        </div>
      </section>
    </div>
  );
};
