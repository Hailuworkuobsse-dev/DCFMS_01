import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, RotateCcw, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/primitives/PageHeader';
import { api } from '../../lib/api/client';

type ReviewContract = {
  id: string;
  contractNo: string;
  commodity: string;
  quantity: number;
  unit: string;
  status: string;
  region?: string | null;
  woreda?: string | null;
  updatedAt: string;
  createdBy?: { fullName?: string };
  parties?: Array<{ farmer?: { user?: { fullName?: string } } }>;
  signatures?: Array<{ role: string; status: string; signedAt?: string | null }>;
};

export const StatutoryReviewPage: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const [contracts, setContracts] = useState<ReviewContract[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.contracts.reviewQueue();
      setContracts(result.contracts || []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load the statutory review queue. Check your reviewer role and jurisdiction.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (contract: ReviewContract, decision: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION') => {
    const note = (notes[contract.id] || '').trim();
    if (decision !== 'APPROVE' && !note) {
      setError('Enter a reason before rejecting or returning a contract for correction.');
      return;
    }
    setBusyId(contract.id);
    setError('');
    setNotice('');
    try {
      await api.contracts.review(contract.id, { decision, note: note || undefined });
      setNotice(`${contract.contractNo} — ${decision === 'APPROVE' ? 'approved' : decision === 'REJECT' ? 'rejected' : 'returned for correction'}.`);
      setContracts((current) => current.filter((item) => item.id !== contract.id));
    } catch (e: any) {
      setError(e?.message || 'The review decision could not be saved.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Statutory Contract Review"
        subtitle="Review fully signed agreements within your assigned government jurisdiction."
        breadcrumbs={[{ label: 'Statutory review' }]}
      />
      {error && <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      {loading ? (
        <div className="border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">Loading review queue…</div>
      ) : contracts.length === 0 ? (
        <div className="border border-stone-200 bg-white p-10 text-center">
          <ClipboardCheck className="mx-auto mb-3 h-8 w-8 text-stone-400" />
          <h2 className="font-semibold text-stone-800">No contracts awaiting review</h2>
          <p className="mt-1 text-sm text-stone-500">Only signed contracts submitted for approval within your scope appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => {
            const signed = contract.signatures?.filter((signature) => signature.status === 'SIGNED').length || 0;
            const total = contract.signatures?.length || 0;
            return (
              <article key={contract.id} className="space-y-4 border border-stone-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <button type="button" className="text-left text-base font-bold text-forest-800 underline-offset-2 hover:underline"
                      onClick={() => onNavigate?.(`/contracts/${contract.id}`)}>
                      {contract.contractNo}
                    </button>
                    <p className="mt-1 text-sm text-stone-700">{contract.commodity} · {contract.quantity} {contract.unit}</p>
                    <p className="mt-1 text-xs text-stone-500">{contract.woreda || 'Woreda not set'}, {contract.region || 'Region not set'} · Submitted by {contract.createdBy?.fullName || 'Contractor'}</p>
                  </div>
                  <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Pending statutory approval</span>
                </div>
                <div className="text-xs text-stone-600">Signature records: {signed} of {total} signed</div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-stone-700">Review note / correction reason</span>
                  <textarea value={notes[contract.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [contract.id]: event.target.value }))}
                    rows={2} maxLength={2000} placeholder="Required for rejection or return for correction"
                    className="w-full resize-y rounded border border-stone-300 p-3 text-sm focus:border-forest-700 focus:outline-none" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === contract.id} onClick={() => void decide(contract, 'APPROVE')}
                    className="inline-flex items-center gap-2 rounded bg-forest-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    <CheckCircle2 size={16} /> Approve
                  </button>
                  <button disabled={busyId === contract.id} onClick={() => void decide(contract, 'RETURN_FOR_CORRECTION')}
                    className="inline-flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50">
                    <RotateCcw size={16} /> Return for correction
                  </button>
                  <button disabled={busyId === contract.id} onClick={() => void decide(contract, 'REJECT')}
                    className="inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
