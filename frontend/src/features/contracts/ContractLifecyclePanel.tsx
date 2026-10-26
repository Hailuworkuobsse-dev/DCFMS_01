import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Bell, CheckCircle2, ClipboardCheck, FileClock, FileWarning, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api/client';

type Props = {
  contractId: string;
  status: string;
  currentUserId?: string;
  currentUserRole?: string;
  initialContent?: Record<string, unknown>;
  currentVersion: number;
  onRefresh?: () => Promise<void> | void;
};

const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

export const ContractLifecyclePanel: React.FC<Props> = ({
  contractId, status, currentUserId, currentUserRole, initialContent, currentVersion, onRefresh,
}) => {
  const [events, setEvents] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [amendments, setAmendments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [closure, setClosure] = useState<any>(null);
  const [integrity, setIntegrity] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendmentContent, setAmendmentContent] = useState(JSON.stringify(initialContent || {}, null, 2));
  const [closureNotes, setClosureNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isContractor = currentUserRole?.toUpperCase() === 'CONTRACTOR';
  const isReviewer = ['MOA_OFFICER', 'RBOA_OFFICER', 'WBOA_OFFICER', 'MOTRI_OFFICER', 'ECC_OFFICER', 'EAA_OFFICER'].includes(currentUserRole?.toUpperCase() || '');

  const load = useCallback(async () => {
    setError('');
    try {
      const [eventResult, milestoneResult, amendmentResult, notificationResult, closureResult] = await Promise.all([
        api.contracts.events(contractId),
        api.contracts.milestones(contractId),
        api.contracts.amendments(contractId),
        api.contracts.notifications(true),
        api.contracts.closure(contractId),
      ]);
      setEvents(eventResult.events || []);
      setMilestones(milestoneResult.milestones || []);
      setAmendments(amendmentResult.amendments || []);
      setNotifications((notificationResult.notifications || []).filter((n: any) => n.contractId === contractId));
      setClosure(closureResult || null);
    } catch (e: any) {
      setError(e?.message || 'Unable to load contract lifecycle records.');
    }
  }, [contractId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setAmendmentContent(JSON.stringify(initialContent || {}, null, 2)); }, [initialContent, currentVersion]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      await onRefresh?.();
    } catch (e: any) {
      setError(e?.message || 'The requested lifecycle action failed.');
    } finally {
      setBusy(false);
    }
  };

  const createMilestone = () => {
    if (!title.trim()) { setError('Enter a milestone title.'); return; }
    void run(async () => {
      await api.contracts.createMilestone(contractId, { title: title.trim(), dueAt: dueAt || undefined, required: true });
      setTitle('');
      setDueAt('');
    });
  };

  const proposeAmendment = () => {
    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(amendmentContent);
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Amendment content must be a JSON object.');
      parsed = candidate;
    } catch (e: any) {
      setError(e?.message || 'Enter valid JSON for the proposed amendment.');
      return;
    }
    if (!amendmentReason.trim()) { setError('Provide the reason for the amendment.'); return; }
    void run(async () => {
      await api.contracts.proposeAmendment(contractId, { proposedContent: parsed, reason: amendmentReason.trim(), baseVersion: currentVersion });
      setAmendmentReason('');
    });
  };

  const integrityLabel = integrity?.intact === true ? 'Integrity verified' : integrity?.intact === false ? 'Integrity check failed' : 'Not checked';

  return (
    <section className="mt-6 space-y-5" aria-label="Contract lifecycle and integrity">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Lifecycle, integrity & closure</h2>
          <p className="text-sm text-stone-500">Event history, execution milestones, amendments and formal closure records.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void run(() => api.contracts.integrity(contractId).then(setIntegrity))} className="inline-flex items-center gap-2 rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50">
          <ShieldCheck size={16} /> Verify integrity
        </button>
      </header>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {integrity && <div className={`rounded border p-3 text-sm ${integrity.intact ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        <strong>{integrityLabel}</strong> · content {integrity.currentContentIntact ? 'OK' : 'MISMATCH'} · versions {integrity.versionIntegrity ? 'OK' : 'MISMATCH'} · annexes {integrity.annexIntegrity ? 'OK' : 'MISMATCH'} · event ledger {integrity.eventLedgerIntegrity ? 'OK' : 'MISMATCH'}
      </div>}

      {notifications.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold"><Bell size={16} /> Unread contract notifications</h3>
        <ul className="space-y-2">{notifications.map((n) => <li key={n.id} className="flex items-start justify-between gap-3 text-sm">
          <div><strong>{n.title}</strong><p>{n.message}</p><p className="text-xs text-stone-500">{dateLabel(n.createdAt)}</p></div>
          <button type="button" className="shrink-0 underline" onClick={() => void run(() => api.contracts.markNotificationRead(n.id))}>Mark read</button>
        </li>)}</ul>
      </div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-stone-200 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><ClipboardCheck size={17} /> Execution milestones</h3>
          {milestones.length === 0 ? <p className="text-sm text-stone-500">No milestones have been recorded yet.</p> : <ul className="space-y-3">
            {milestones.map((m) => <li key={m.id} className="border-b border-stone-100 pb-3 last:border-0">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{m.title}</strong><p className="text-xs text-stone-500">Due: {dateLabel(m.dueAt)} · {m.required ? 'Required' : 'Optional'}</p></div><span className="rounded bg-stone-100 px-2 py-1 text-xs">{m.status}</span></div>
              {m.description && <p className="mt-1 text-sm">{m.description}</p>}
              {['APPROVED','IN_EXECUTION'].includes(status) && m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && <div className="mt-2 flex flex-wrap gap-2">
                {m.status === 'PENDING' && <button type="button" disabled={busy} className="rounded border px-2 py-1 text-xs" onClick={() => void run(() => api.contracts.updateMilestone(contractId, m.id, { status: 'IN_PROGRESS' }))}>Start</button>}
                <button type="button" disabled={busy} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white" onClick={() => void run(() => api.contracts.updateMilestone(contractId, m.id, { status: 'COMPLETED', notes: 'Marked complete by an authorized contracting party.' }))}>Mark complete</button>
                <button type="button" disabled={busy} className="rounded border px-2 py-1 text-xs" onClick={() => void run(() => api.contracts.updateMilestone(contractId, m.id, { status: 'BLOCKED', notes: 'Milestone blocked; follow-up required.' }))}>Mark blocked</button>
              </div>}
            </li>)}
          </ul>}
          {isContractor && ['APPROVED','IN_EXECUTION'].includes(status) && <div className="mt-4 space-y-2 border-t pt-3">
            <label className="block text-sm font-medium">Add milestone</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Milestone title" className="w-full rounded border px-3 py-2 text-sm" />
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full rounded border px-3 py-2 text-sm" />
            <button type="button" disabled={busy} onClick={createMilestone} className="rounded bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50">Add required milestone</button>
          </div>}
          {isContractor && status === 'APPROVED' && <button type="button" disabled={busy} onClick={() => void run(() => api.contracts.startExecution(contractId))} className="mt-3 rounded border border-emerald-700 px-3 py-2 text-sm text-emerald-800 disabled:opacity-50">Start contract execution</button>}
        </div>

        <div className="rounded-lg border border-stone-200 p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><FileWarning size={17} /> Formal amendments</h3>
          {amendments.length === 0 ? <p className="text-sm text-stone-500">No amendments have been proposed.</p> : <ul className="space-y-3">
            {amendments.map((a) => <li key={a.id} className="border-b border-stone-100 pb-3 last:border-0">
              <div className="flex flex-wrap justify-between gap-2"><strong>Amendment #{a.amendmentNo}</strong><span className="rounded bg-stone-100 px-2 py-1 text-xs">{a.status}</span></div>
              <p className="mt-1 text-sm">{a.reason}</p><p className="text-xs text-stone-500">Base version {a.baseVersion} · {dateLabel(a.createdAt)}</p>
              {isContractor && a.status === 'DRAFT' && <button type="button" disabled={busy} className="mt-2 rounded border px-2 py-1 text-xs" onClick={() => void run(() => api.contracts.submitAmendment(contractId, a.id))}>Submit for statutory review</button>}
              {isReviewer && a.status === 'PENDING_APPROVAL' && <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} className="rounded bg-emerald-700 px-2 py-1 text-xs text-white" onClick={() => void run(() => api.contracts.reviewAmendment(contractId, a.id, { decision: 'APPROVE' }))}>Approve amendment</button>
                <button type="button" disabled={busy} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => { const note = window.prompt('Reason for rejecting this amendment?'); if (note?.trim()) void run(() => api.contracts.reviewAmendment(contractId, a.id, { decision: 'REJECT', note })); }}>Reject</button>
              </div>}
            </li>)}
          </ul>}
          {isContractor && ['SIGNED','APPROVED','IN_EXECUTION'].includes(status) && <div className="mt-4 space-y-2 border-t pt-3">
            <label className="block text-sm font-medium">Propose amendment</label>
            <textarea value={amendmentReason} onChange={(e) => setAmendmentReason(e.target.value)} placeholder="Explain why the contract needs to change" rows={2} className="w-full rounded border px-3 py-2 text-sm" />
            <textarea value={amendmentContent} onChange={(e) => setAmendmentContent(e.target.value)} rows={6} className="w-full rounded border px-3 py-2 font-mono text-xs" aria-label="Proposed contract content JSON" />
            <button type="button" disabled={busy} onClick={proposeAmendment} className="rounded bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-50">Save amendment draft</button>
          </div>}
        </div>
      </div>

      {isContractor && status === 'IN_EXECUTION' && !closure && <div className="rounded-lg border border-stone-200 p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 size={17} /> Formal closure</h3>
        <p className="mb-3 text-sm text-stone-500">Closure is permitted only after every required milestone is complete and the integrity check passes.</p>
        <textarea value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} rows={3} placeholder="Closure summary, delivery and settlement evidence references" className="w-full rounded border px-3 py-2 text-sm" />
        <button type="button" disabled={busy || !closureNotes.trim()} onClick={() => void run(() => api.contracts.closeContract(contractId, { notes: closureNotes.trim() }))} className="mt-2 rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">Close contract</button>
      </div>}
      {closure && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <h3 className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 size={17} /> Contract closure record</h3>
        <p className="text-sm">{closure.notes}</p><p className="mt-1 text-xs">Closed {dateLabel(closure.closedAt)} · Final content hash: {closure.finalContentHash}</p>
      </div>}

      <div className="rounded-lg border border-stone-200 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><Activity size={17} /> Actual event history</h3>
        {events.length === 0 ? <p className="text-sm text-stone-500">No lifecycle events have been recorded yet.</p> : <ol className="space-y-3">
          {events.map((event) => <li key={event.id} className="border-l-2 border-stone-200 pl-3">
            <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{event.summary}</strong><span className="text-xs text-stone-500">{dateLabel(event.createdAt)}</span></div>
            <p className="text-xs text-stone-500">{event.eventType}{event.fromStatus || event.toStatus ? ` · ${event.fromStatus || '—'} → ${event.toStatus || '—'}` : ''}</p>
            <p className="break-all font-mono text-[10px] text-stone-400">SHA-256: {event.eventHash}</p>
          </li>)}
        </ol>}
      </div>
    </section>
  );
};
