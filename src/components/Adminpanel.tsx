import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { CATEGORIES, parseCSV } from './CertificateSection';

const SAMPLE_CSV =
  'name,college,event,team\n' +
  'Vishnu,Adhiparasakthi Engineering College,PaperQuest,\n' +
  'Sachin,Adhiparasakthi Engineering College,Checkmate,Team Phoenix\n' +
  'Gokul,Adhiparasakthi Engineering College,Checkmate,Team Phoenix\n';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
};

const inputCls =
  'w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/20 text-sm font-semibold text-white focus:outline-none focus:border-phoenix-orange';

export const AdminPanel: React.FC = () => {
  const [repo, setRepo] = useState('vishnuprasath2406/Certificate');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [csvText, setCsvText] = useState('');
  const [status, setStatus] = useState<{ type: 'ok' | 'err' | 'busy'; msg: string } | null>(null);

  const rows = useMemo(() => parseCSV(csvText), [csvText]);
  const known = useMemo(() => Object.values(CATEGORIES).flat().map(norm), []);
  const unknownEvents = useMemo(
    () => Array.from(new Set(rows.map((r) => r.event).filter((e) => !known.includes(norm(e))))),
    [rows, known]
  );
  const perEvent = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      m[r.event] = (m[r.event] || 0) + 1;
    });
    return m;
  }, [rows]);
  const teamCount = useMemo(() => new Set(rows.map((r) => r.team).filter(Boolean)).size, [rows]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => {
      setCsvText(t);
      setStatus(null);
    });
  };

  const downloadSample = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
    a.download = 'participants-sample.csv';
    a.click();
  };

  const publish = async () => {
    setStatus({ type: 'busy', msg: 'Publishing to GitHub…' });
    try {
      const url = `https://api.github.com/repos/${repo.trim()}/contents/public/participants.csv`;
      const headers = {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      };
      const cur = await fetch(`${url}?ref=${encodeURIComponent(branch.trim())}`, { headers });
      let sha: string | undefined;
      if (cur.ok) sha = (await cur.json()).sha;
      else if (cur.status !== 404)
        throw new Error(`GitHub returned ${cur.status}. Check the token, repo and branch.`);

      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Update participants (${rows.length} rows) via admin page`,
          content: toBase64(csvText),
          branch: branch.trim(),
          sha,
        }),
      });
      if (!res.ok) throw new Error(`Publish failed (${res.status}). The token needs Contents: write.`);
      setStatus({
        type: 'ok',
        msg: 'Published! Vercel will redeploy in about a minute, then the new list is live.',
      });
    } catch (err) {
      setStatus({ type: 'err', msg: err instanceof Error ? err.message : 'Something went wrong.' });
    }
  };

  const canPublish = rows.length > 0 && token.trim() !== '' && status?.type !== 'busy';

  return (
    <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="text-center mb-6 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          PIXEL<span className="text-phoenix-orange">-3.O</span> Admin
        </h1>
        <p className="text-xs sm:text-sm text-white/60">
          Upload the participant CSV and publish it to the live site.
        </p>
      </div>

      <div className="bg-[#0f0f13]/85 backdrop-blur-xl rounded-3xl border border-white/15 shadow-2xl p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="sm:col-span-2 text-[11px] font-semibold text-white/60">
            GitHub repo (owner/name)
            <input className={inputCls} value={repo} onChange={(e) => setRepo(e.target.value)} />
          </label>
          <label className="text-[11px] font-semibold text-white/60">
            Branch
            <input className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)} />
          </label>
          <label className="sm:col-span-3 text-[11px] font-semibold text-white/60">
            GitHub access token (only you should have this; it is never stored)
            <input
              type="password"
              className={inputCls}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="phoenix-gradient-btn py-3 px-5 rounded-full text-white font-extrabold text-xs uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
          </label>
          <button
            type="button"
            onClick={downloadSample}
            className="text-xs font-bold text-phoenix-gold hover:underline"
          >
            Download sample CSV
          </button>
          <span className="text-[11px] text-white/40">
            Columns: name, college, event, team (team is optional). In Excel use Save As → CSV UTF-8.
          </span>
        </div>

        {csvText && (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                No valid rows found. The file needs at least the columns &quot;name&quot; and
                &quot;event&quot;.
              </div>
            ) : (
              <>
                <div className="text-sm font-bold text-white">
                  {rows.length} participants · {teamCount} teams
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(perEvent).map(([ev, n]) => (
                    <span
                      key={ev}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/10 text-white border border-white/20"
                    >
                      {ev}: {n}
                    </span>
                  ))}
                </div>
                {unknownEvents.length > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    Unknown event name(s): {unknownEvents.join(', ')}. Participants with these won&apos;t
                    appear on the site. Expected: {Object.values(CATEGORIES).flat().join(', ')}.
                  </div>
                )}
                <div className="max-h-56 overflow-auto rounded-xl border border-white/15">
                  <table className="w-full text-left text-xs text-white/80">
                    <thead className="sticky top-0 bg-[#17171d] text-white/50 uppercase text-[10px]">
                      <tr>
                        <th className="p-2">Name</th>
                        <th className="p-2">Event</th>
                        <th className="p-2">Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={`${r.name}-${r.event}-${i}`} className="border-t border-white/10">
                          <td className="p-2 font-semibold">{r.name}</td>
                          <td className="p-2">{r.event}</td>
                          <td className="p-2">{r.team || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={publish}
          disabled={!canPublish}
          className="phoenix-gradient-btn w-full py-4 rounded-full text-white font-extrabold tracking-wider uppercase text-sm disabled:opacity-40"
        >
          Publish to live site
        </button>

        {status && (
          <div
            className={`p-4 rounded-2xl text-xs sm:text-sm flex items-start gap-2 border ${
              status.type === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : status.type === 'err'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-white/5 border-white/15 text-white/70'
            }`}
          >
            {status.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
};
