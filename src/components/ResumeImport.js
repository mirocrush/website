import { useRef, useState, useEffect } from 'react';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { parseResume }      from '../api/resumeApi';
import { updateHero, addSectionItem } from '../api/portfolioApi';

// ── Helper ────────────────────────────────────────────────────────────────────

function SectionRow({ label, count, checked, onChange, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold">
          {label}
          {count > 0 && (
            <span className="badge badge-sm ml-2">{count}</span>
          )}
        </span>
        {count > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-base-content/50">
              {checked ? 'Include' : 'Skip'}
            </span>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={checked}
              onChange={onChange}
            />
          </label>
        )}
      </div>
      {count > 0 ? children : (
        <p className="text-xs text-base-content/30">Nothing found</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResumeImport({ open, portfolioId, setPortfolio, onClose }) {
  const inputRef = useRef(null);

  const [step,     setStep]     = useState('upload'); // upload | parsing | preview | applying
  const [parsed,   setParsed]   = useState(null);
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState('');
  const [included, setIncluded] = useState({});

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setStep('upload');
      setParsed(null);
      setError('');
      setProgress('');
    }
  }, [open]);

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setStep('parsing');
    try {
      const res = await parseResume(file);
      if (!res.success) throw new Error(res.message);
      const d = res.data;
      setParsed(d);
      setIncluded({
        profile:        !!(d.name || d.title || d.bio || d.contact?.email),
        socials:        d.socials?.length > 0,
        skills:         d.skills?.length > 0,
        experience:     d.experience?.length > 0,
        education:      d.education?.length > 0,
        certifications: d.certifications?.length > 0,
        projects:       d.projects?.length > 0,
      });
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Parse failed');
      setStep('upload');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleApply = async () => {
    setStep('applying');
    setError('');
    let lastPortfolio = null;

    try {
      // 1. Profile
      if (included.profile) {
        setProgress('Updating profile…');
        const payload = { id: portfolioId };
        if (parsed.name)           payload.name     = parsed.name;
        if (parsed.title)          payload.title    = parsed.title;
        if (parsed.bio)            payload.bio      = parsed.bio;
        if (parsed.location)       payload.location = parsed.location;
        if (parsed.contact?.email || parsed.contact?.phone) payload.contact = parsed.contact;
        const r = await updateHero(payload);
        lastPortfolio = r.data;
      }

      // 2. Socials
      if (included.socials && parsed.socials?.length) {
        setProgress(`Adding ${parsed.socials.length} social link(s)…`);
        for (const item of parsed.socials) {
          const r = await addSectionItem({ id: portfolioId, section: 'socials', item });
          lastPortfolio = r.data;
        }
      }

      // 3. Skills
      if (included.skills && parsed.skills?.length) {
        setProgress(`Adding ${parsed.skills.length} skill(s)…`);
        for (const item of parsed.skills) {
          const r = await addSectionItem({ id: portfolioId, section: 'skills', item });
          lastPortfolio = r.data;
        }
      }

      // 4. Experience
      if (included.experience && parsed.experience?.length) {
        setProgress(`Adding ${parsed.experience.length} experience entr${parsed.experience.length > 1 ? 'ies' : 'y'}…`);
        for (const item of parsed.experience) {
          const r = await addSectionItem({ id: portfolioId, section: 'experience', item });
          lastPortfolio = r.data;
        }
      }

      // 5. Education
      if (included.education && parsed.education?.length) {
        setProgress(`Adding ${parsed.education.length} education entr${parsed.education.length > 1 ? 'ies' : 'y'}…`);
        for (const item of parsed.education) {
          const r = await addSectionItem({ id: portfolioId, section: 'education', item });
          lastPortfolio = r.data;
        }
      }

      // 6. Certifications
      if (included.certifications && parsed.certifications?.length) {
        setProgress(`Adding ${parsed.certifications.length} certification(s)…`);
        for (const item of parsed.certifications) {
          const r = await addSectionItem({ id: portfolioId, section: 'certifications', item });
          lastPortfolio = r.data;
        }
      }

      // 7. Projects
      if (included.projects && parsed.projects?.length) {
        setProgress(`Adding ${parsed.projects.length} project(s)…`);
        for (const item of parsed.projects) {
          const r = await addSectionItem({ id: portfolioId, section: 'projects', item });
          lastPortfolio = r.data;
        }
      }

      if (lastPortfolio) setPortfolio(lastPortfolio);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to apply');
      setStep('preview');
    }
  };

  const toggle = (key) => setIncluded((p) => ({ ...p, [key]: !p[key] }));

  const anyIncluded = included && Object.values(included).some(Boolean);

  if (!open) return null;

  const canClose = step !== 'parsing' && step !== 'applying';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">

        {/* ── Upload step ─────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <>
            <h3 className="font-bold text-lg mb-4">Import Resume</h3>

            {error && (
              <div role="alert" className="alert alert-error text-sm mb-4">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center border-2 border-dashed border-primary/40 rounded-xl p-10 text-center cursor-pointer bg-base-200 hover:bg-base-300 transition-colors"
            >
              <Upload size={44} className="text-primary mb-2" />
              <p className="font-semibold">
                Drop your resume here or{' '}
                <span className="underline">browse</span>
              </p>
              <p className="text-xs text-base-content/50 mt-1">PDF or DOCX · max 10 MB</p>
            </div>

            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            <div role="alert" className="alert alert-info text-sm mt-4">
              <AlertCircle size={16} />
              <span>
                Use a <strong>text-based PDF</strong> (exported from Word, Google Docs, etc.).
                Scanned image PDFs cannot be parsed.
              </span>
            </div>

            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => inputRef.current?.click()}>
                Choose File
              </button>
            </div>
          </>
        )}

        {/* ── Parsing step ────────────────────────────────────────────────── */}
        {step === 'parsing' && (
          <>
            <h3 className="font-bold text-lg mb-4">Analyzing Resume…</h3>
            <div className="flex flex-col items-center py-10 gap-3">
              <span className="loading loading-spinner loading-lg text-primary" />
              <p className="text-base-content/60 text-sm">Extracting and parsing your resume data…</p>
            </div>
          </>
        )}

        {/* ── Preview step ─────────────────────────────────────────────────── */}
        {step === 'preview' && parsed && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-success" />
              <h3 className="font-bold text-lg">Resume Parsed — Review &amp; Apply</h3>
            </div>

            <div className="overflow-y-auto max-h-[65vh] pr-1">
              {error && (
                <div role="alert" className="alert alert-error text-sm mb-4">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Profile */}
              <SectionRow
                label="Profile"
                count={parsed.name || parsed.title || parsed.bio || parsed.contact?.email ? 1 : 0}
                checked={included.profile}
                onChange={() => toggle('profile')}
              >
                <div className="flex flex-col gap-1 text-sm">
                  {parsed.name     && <p><b>Name:</b> {parsed.name}</p>}
                  {parsed.title    && <p><b>Title:</b> {parsed.title}</p>}
                  {parsed.location && <p><b>Location:</b> {parsed.location}</p>}
                  {parsed.contact?.email && <p><b>Email:</b> {parsed.contact.email}</p>}
                  {parsed.contact?.phone && <p><b>Phone:</b> {parsed.contact.phone}</p>}
                  {parsed.bio && (
                    <p className="text-base-content/60 italic mt-1">
                      "{parsed.bio.slice(0, 120)}{parsed.bio.length > 120 ? '…' : ''}"
                    </p>
                  )}
                </div>
              </SectionRow>

              <div className="divider my-2" />

              {/* Socials */}
              <SectionRow label="Social Links" count={parsed.socials?.length || 0}
                checked={included.socials} onChange={() => toggle('socials')}>
                <div className="flex flex-wrap gap-1">
                  {parsed.socials.map((s, i) => (
                    <span key={i} className="badge badge-outline badge-sm">
                      {s.platform}: {s.url.replace('https://', '')}
                    </span>
                  ))}
                </div>
              </SectionRow>

              <div className="divider my-2" />

              {/* Skills */}
              <SectionRow label="Skills" count={parsed.skills?.length || 0}
                checked={included.skills} onChange={() => toggle('skills')}>
                <div className="flex flex-wrap gap-1 mb-2">
                  {parsed.skills.slice(0, 20).map((s, i) => (
                    <span key={i} className="badge badge-sm">{s.name}</span>
                  ))}
                  {parsed.skills.length > 20 && (
                    <span className="badge badge-outline badge-sm">
                      +{parsed.skills.length - 20} more
                    </span>
                  )}
                </div>
                <div role="alert" className="alert alert-warning text-xs py-1">
                  <AlertCircle size={13} />
                  <span>All skill levels default to <strong>intermediate</strong> — review them after importing.</span>
                </div>
              </SectionRow>

              <div className="divider my-2" />

              {/* Experience */}
              <SectionRow label="Experience" count={parsed.experience?.length || 0}
                checked={included.experience} onChange={() => toggle('experience')}>
                {parsed.experience.map((e, i) => (
                  <p key={i} className="text-sm mb-1">
                    • <b>{e.role || 'Unknown role'}</b>
                    {e.company ? ` @ ${e.company}` : ''}
                    {(e.startDate || e.endDate) ? (
                      <span className="text-base-content/50"> ({e.startDate || '?'} – {e.endDate || 'Present'})</span>
                    ) : null}
                  </p>
                ))}
              </SectionRow>

              <div className="divider my-2" />

              {/* Education */}
              <SectionRow label="Education" count={parsed.education?.length || 0}
                checked={included.education} onChange={() => toggle('education')}>
                {parsed.education.map((e, i) => (
                  <p key={i} className="text-sm mb-1">
                    • <b>{e.degree || 'Degree'}</b>
                    {e.institution ? ` — ${e.institution}` : ''}
                    {e.startYear
                      ? <span className="text-base-content/50"> ({e.startYear}{e.endYear ? `–${e.endYear}` : '–Present'})</span>
                      : null}
                  </p>
                ))}
              </SectionRow>

              <div className="divider my-2" />

              {/* Certifications */}
              <SectionRow label="Certifications" count={parsed.certifications?.length || 0}
                checked={included.certifications} onChange={() => toggle('certifications')}>
                {parsed.certifications.map((c, i) => (
                  <p key={i} className="text-sm mb-1">
                    • <b>{c.title}</b>
                    {c.issuer ? ` — ${c.issuer}` : ''}
                    {c.date ? <span className="text-base-content/50"> ({c.date})</span> : null}
                  </p>
                ))}
              </SectionRow>

              <div className="divider my-2" />

              {/* Projects */}
              <SectionRow label="Projects" count={parsed.projects?.length || 0}
                checked={included.projects} onChange={() => toggle('projects')}>
                {parsed.projects.map((p, i) => (
                  <p key={i} className="text-sm mb-1">
                    • <b>{p.title}</b>
                    {p.tech?.length
                      ? <span className="text-base-content/50"> ({p.tech.slice(0, 4).join(', ')})</span>
                      : null}
                  </p>
                ))}
              </SectionRow>

              <div role="alert" className="alert alert-info text-sm mt-4">
                <AlertCircle size={16} />
                <span>
                  Imported items will be <strong>added</strong> to your existing portfolio data, not replaced.
                  Review each section after importing.
                </span>
              </div>
            </div>

            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={() => setStep('upload')}>Back</button>
              <button
                className="btn btn-primary"
                onClick={handleApply}
                disabled={!anyIncluded}
              >
                Apply to Portfolio
              </button>
            </div>
          </>
        )}

        {/* ── Applying step ────────────────────────────────────────────────── */}
        {step === 'applying' && (
          <>
            <h3 className="font-bold text-lg mb-4">Applying to Portfolio…</h3>
            <div className="py-6">
              <progress className="progress progress-primary w-full mb-4" />
              <p className="text-center text-base-content/60 text-sm">{progress}</p>
            </div>
            {error && (
              <div role="alert" className="alert alert-error text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Backdrop close — only when not busy */}
      {canClose && (
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      )}
    </dialog>
  );
}
