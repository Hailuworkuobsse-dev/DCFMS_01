import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api/client';

interface ContractNegotiationPanelProps {
  contractId: string;
  status: string;
  initialContent: Record<string, unknown>;
  currentUserId?: string;
  onSaved?: () => void;
}

export const ContractNegotiationPanel: React.FC<ContractNegotiationPanelProps> = ({
  contractId, status, initialContent, currentUserId, onSaved,
}) => {
  const [versions, setVersions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [annexes, setAnnexes] = useState<any[]>([]);
  const [acceptances, setAcceptances] = useState<any[]>([]);
  const [contentText, setContentText] = useState(JSON.stringify(initialContent || {}, null, 2));
  const [changeSummary, setChangeSummary] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentClause, setCommentClause] = useState('');
  const [annexTitle, setAnnexTitle] = useState('');
  const [annexDescription, setAnnexDescription] = useState('');
  const [annexUrl, setAnnexUrl] = useState('');
  const [olderVersion, setOlderVersion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [versionResult, commentResult, annexResult, acceptanceResult] = await Promise.all([
        api.contracts.versions(contractId),
        api.contracts.comments(contractId),
        api.contracts.annexes(contractId),
        api.contracts.changeAcceptances(contractId),
      ]);
      setVersions(versionResult.versions);
      setComments(commentResult.comments);
      setAnnexes(annexResult.annexes);
      setAcceptances(acceptanceResult.acceptances);
      const latest = versionResult.versions[versionResult.versions.length - 1];
      setContentText(JSON.stringify(latest?.content || initialContent || {}, null, 2));
      if (versionResult.versions.length > 1) setOlderVersion((current) => current || String(versionResult.versions[versionResult.versions.length - 2].version));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load negotiation history.');
    } finally {
      setIsLoading(false);
    }
  }, [contractId, initialContent]);

  useEffect(() => { void load(); }, [load]);

  const latestVersion = versions.length ? versions[versions.length - 1] : null;
  const selectedOlder = versions.find((version) => String(version.version) === olderVersion);
  const latestContent = latestVersion?.content || {};
  const changedKeys = useMemo(() => {
    if (!selectedOlder || !latestVersion) return [];
    const keys = new Set([...Object.keys(selectedOlder.content || {}), ...Object.keys(latestVersion.content || {})]);
    return [...keys].filter((key) => JSON.stringify(selectedOlder.content?.[key]) !== JSON.stringify(latestVersion.content?.[key]));
  }, [selectedOlder, latestVersion]);
  const ownAcceptance = acceptances.find((item) => item.version === latestVersion?.version && item.userId === currentUserId);

  const saveDraft = async () => {
    setError(''); setNotice('');
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(contentText) as Record<string, unknown>; }
    catch { setError('Draft content must be valid JSON before it can be saved.'); return; }
    if (!latestVersion) { setError('No saved version exists for this contract.'); return; }
    setIsSaving(true);
    try {
      await api.contracts.saveDraft(contractId, { content: parsed, expectedVersion: latestVersion.version, changeSummary: changeSummary.trim() || undefined });
      setChangeSummary('');
      setNotice('Draft saved as a new version. Other parties can review and respond to the change.');
      await load();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save this draft.');
    } finally { setIsSaving(false); }
  };

  const postComment = async () => {
    setError(''); setNotice('');
    if (!commentText.trim()) { setError('Enter a comment before posting.'); return; }
    try {
      await api.contracts.addComment(contractId, { body: commentText.trim(), clauseKey: commentClause.trim() || undefined });
      setCommentText(''); setCommentClause('');
      setNotice('Negotiation comment added.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to add comment.'); }
  };

  const addAnnex = async () => {
    setError(''); setNotice('');
    if (!annexTitle.trim()) { setError('Annex title is required.'); return; }
    try {
      await api.contracts.addAnnex(contractId, {
        title: annexTitle.trim(), description: annexDescription.trim() || undefined,
        storageUrl: annexUrl.trim() || undefined,
        content: annexDescription.trim() ? { summary: annexDescription.trim() } : undefined,
      });
      setAnnexTitle(''); setAnnexDescription(''); setAnnexUrl('');
      setNotice('Annex record added.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to add annex.'); }
  };

  const respondToChange = async (accepted: boolean) => {
    if (!latestVersion) return;
    setError(''); setNotice('');
    try {
      await api.contracts.acceptChange(contractId, { version: latestVersion.version, accepted });
      setNotice(accepted ? 'You accepted the latest draft version.' : 'You requested further changes to the latest draft.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to record your response.'); }
  };

  return (
    <section className="mt-8 space-y-5 rounded-2xl border border-stone-200 bg-white p-4 sm:p-6" aria-labelledby="negotiation-heading">
      <div>
        <h2 id="negotiation-heading" className="text-lg font-bold text-stone-900">Drafting & negotiation</h2>
        <p className="mt-1 text-xs text-stone-500">Review clause-level changes, preserve version history, and record each party's response before the agreement moves forward.</p>
      </div>
      {error && <div role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
      {isLoading ? <p className="text-xs text-stone-500">Loading negotiation history…</p> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Draft clauses and terms</h3>
              <label className="block text-xs font-medium text-stone-700" htmlFor="draft-content">Structured agreement content (JSON)</label>
              <textarea id="draft-content" rows={14} value={contentText} disabled={status !== 'DRAFT'} onChange={(event) => setContentText(event.target.value)} className="w-full rounded-lg border border-stone-300 p-3 font-mono text-xs disabled:bg-stone-100" />
              <label className="block text-xs font-medium text-stone-700" htmlFor="change-summary">Change summary</label>
              <input id="change-summary" value={changeSummary} disabled={status !== 'DRAFT'} onChange={(event) => setChangeSummary(event.target.value)} placeholder="Explain what changed and why" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs disabled:bg-stone-100" />
              <button type="button" onClick={() => void saveDraft()} disabled={isSaving || status !== 'DRAFT'} className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{isSaving ? 'Saving…' : 'Save new draft version'}</button>
              <p className="text-[11px] text-stone-500">Approved template clauses marked mandatory cannot be removed; locked clause text is checked on the server. Saves use optimistic version checks to prevent overwriting another party's latest draft.</p>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Version comparison</h3>
              <div className="flex items-center gap-2">
                <label htmlFor="older-version" className="text-xs text-stone-600">Compare version</label>
                <select id="older-version" value={olderVersion} onChange={(event) => setOlderVersion(event.target.value)} className="min-w-0 rounded border border-stone-300 px-2 py-1.5 text-xs">
                  <option value="">Select previous version</option>
                  {versions.filter((version) => version.version < (latestVersion?.version || 0)).map((version) => <option key={version.id} value={String(version.version)}>Version {version.version}</option>)}
                </select>
                <span className="ml-auto text-xs font-semibold text-stone-700">Latest: v{latestVersion?.version ?? '—'}</span>
              </div>
              {!selectedOlder ? <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">Save a second version to compare changes.</p> : changedKeys.length === 0 ? <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500">No top-level content differences found.</p> : (
                <div className="space-y-2">
                  {changedKeys.map((key) => <div key={key} className="rounded-lg border border-stone-200 p-3">
                    <p className="text-xs font-semibold text-stone-900">{key}</p>
                    <p className="mt-2 text-[11px] font-semibold text-rose-700">Version {selectedOlder.version}</p>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] text-stone-600">{JSON.stringify(selectedOlder.content?.[key] ?? null, null, 2)}</pre>
                    <p className="mt-2 text-[11px] font-semibold text-emerald-700">Version {latestVersion.version}</p>
                    <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[11px] text-stone-600">{JSON.stringify(latestContent?.[key] ?? null, null, 2)}</pre>
                  </div>)}
                </div>
              )}
              <div className="rounded-xl border border-stone-200 p-3">
                <p className="text-xs font-semibold text-stone-900">Your response to the latest version</p>
                <p className="mt-1 text-[11px] text-stone-500">Responses are stored against a specific version; a new edit requires a new response.</p>
                {ownAcceptance && <p className="mt-2 text-xs">Your current response: <strong>{ownAcceptance.accepted ? 'Accepted' : 'Changes requested'}</strong></p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={status !== 'DRAFT' || !latestVersion} onClick={() => void respondToChange(true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Accept version</button>
                  <button type="button" disabled={status !== 'DRAFT' || !latestVersion} onClick={() => void respondToChange(false)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-900 disabled:opacity-50">Request changes</button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Negotiation comments</h3>
              <div className="space-y-2">
                {comments.map((comment) => <article key={comment.id} className="rounded-lg border border-stone-200 p-3">
                  <p className="text-[11px] text-stone-500">{comment.authorId} · {comment.clauseKey ? `Clause: ${comment.clauseKey} · ` : ''}{new Date(comment.createdAt).toLocaleString()}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-stone-800">{comment.body}</p>
                </article>)}
                {comments.length === 0 && <p className="text-xs text-stone-500">No negotiation comments yet.</p>}
              </div>
              <input value={commentClause} onChange={(event) => setCommentClause(event.target.value)} disabled={status !== 'DRAFT'} placeholder="Clause key (optional)" className="w-full rounded border border-stone-300 px-3 py-2 text-xs disabled:bg-stone-100" />
              <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} disabled={status !== 'DRAFT'} rows={3} placeholder="Comment on a term, propose a change, or ask a question…" className="w-full rounded border border-stone-300 p-3 text-xs disabled:bg-stone-100" />
              <button type="button" onClick={() => void postComment()} disabled={status !== 'DRAFT'} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Post comment</button>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Annexes</h3>
              {annexes.map((annex) => <article key={annex.id} className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs font-semibold text-stone-900">{annex.title}</p>
                {annex.description && <p className="mt-1 text-xs text-stone-600">{annex.description}</p>}
                {annex.storageUrl && <a className="mt-2 inline-block break-all text-xs text-blue-700 underline" href={annex.storageUrl} target="_blank" rel="noreferrer">Open linked annex</a>}
                <p className="mt-2 text-[10px] text-stone-500">Checksum: {annex.checksum || 'Not available'}</p>
              </article>)}
              {annexes.length === 0 && <p className="text-xs text-stone-500">No annexes have been added.</p>}
              <input value={annexTitle} onChange={(event) => setAnnexTitle(event.target.value)} disabled={status !== 'DRAFT'} placeholder="Annex title" className="w-full rounded border border-stone-300 px-3 py-2 text-xs disabled:bg-stone-100" />
              <textarea value={annexDescription} onChange={(event) => setAnnexDescription(event.target.value)} disabled={status !== 'DRAFT'} rows={2} placeholder="Annex summary or notes" className="w-full rounded border border-stone-300 p-3 text-xs disabled:bg-stone-100" />
              <input value={annexUrl} onChange={(event) => setAnnexUrl(event.target.value)} disabled={status !== 'DRAFT'} placeholder="Optional HTTPS document link" className="w-full rounded border border-stone-300 px-3 py-2 text-xs disabled:bg-stone-100" />
              <button type="button" onClick={() => void addAnnex()} disabled={status !== 'DRAFT'} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Add annex</button>
              <p className="text-[11px] text-stone-500">This stores annex metadata, structured notes, an optional HTTPS link, and a checksum. Binary file upload/storage is not part of this increment.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
