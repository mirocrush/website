import React, { useRef, useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, CircularProgress, Alert,
  Chip, Divider, FormControlLabel, Switch, Stack, LinearProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Warning as WarnIcon,
} from '@mui/icons-material';
import { parseResume }      from '../api/resumeApi';
import { updateHero, addSectionItem } from '../api/portfolioApi';

// ── Helper ────────────────────────────────────────────────────────────────────

function SectionRow({ label, count, checked, onChange, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {label}
          {count > 0 && (
            <Chip label={count} size="small" sx={{ ml: 1, height: 18, fontSize: 11 }} />
          )}
        </Typography>
        {count > 0 && (
          <FormControlLabel
            control={<Switch size="small" checked={checked} onChange={onChange} />}
            label={checked ? 'Include' : 'Skip'}
            labelPlacement="start"
            sx={{ mr: 0, '& .MuiTypography-root': { fontSize: 12, color: 'text.secondary' } }}
          />
        )}
      </Box>
      {count > 0 ? children : (
        <Typography variant="caption" color="text.disabled">Nothing found</Typography>
      )}
    </Box>
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={step === 'parsing' || step === 'applying' ? undefined : onClose}
      maxWidth="sm" fullWidth>

      {/* ── Upload step ─────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <>
          <DialogTitle>Import Resume</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Drop zone */}
            <Box
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              sx={{
                border: '2px dashed', borderColor: 'primary.light',
                borderRadius: 2, p: 5, textAlign: 'center',
                cursor: 'pointer', bgcolor: 'action.hover',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <UploadIcon color="primary" sx={{ fontSize: 44, mb: 1 }} />
              <Typography variant="body1" fontWeight={600}>
                Drop your resume here or <span style={{ textDecoration: 'underline' }}>browse</span>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                PDF or DOCX · max 10 MB
              </Typography>
            </Box>

            <input
              ref={inputRef} type="file" hidden
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            <Alert severity="info" icon={<WarnIcon />} sx={{ mt: 2 }}>
              Use a <strong>text-based PDF</strong> (exported from Word, Google Docs, etc.).
              Scanned image PDFs cannot be parsed.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={() => inputRef.current?.click()}>
              Choose File
            </Button>
          </DialogActions>
        </>
      )}

      {/* ── Parsing step ────────────────────────────────────────────────── */}
      {step === 'parsing' && (
        <>
          <DialogTitle>Analyzing Resume…</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 5, gap: 2 }}>
              <CircularProgress size={48} />
              <Typography color="text.secondary">Extracting and parsing your resume data…</Typography>
            </Box>
          </DialogContent>
        </>
      )}

      {/* ── Preview step ─────────────────────────────────────────────────── */}
      {step === 'preview' && parsed && (
        <>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckIcon color="success" />
            Resume Parsed — Review &amp; Apply
          </DialogTitle>
          <DialogContent dividers sx={{ maxHeight: '65vh' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Profile */}
            <SectionRow
              label="Profile"
              count={parsed.name || parsed.title || parsed.bio || parsed.contact?.email ? 1 : 0}
              checked={included.profile}
              onChange={() => toggle('profile')}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                {parsed.name     && <Typography variant="body2"><b>Name:</b> {parsed.name}</Typography>}
                {parsed.title    && <Typography variant="body2"><b>Title:</b> {parsed.title}</Typography>}
                {parsed.location && <Typography variant="body2"><b>Location:</b> {parsed.location}</Typography>}
                {parsed.contact?.email && <Typography variant="body2"><b>Email:</b> {parsed.contact.email}</Typography>}
                {parsed.contact?.phone && <Typography variant="body2"><b>Phone:</b> {parsed.contact.phone}</Typography>}
                {parsed.bio && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                    "{parsed.bio.slice(0, 120)}{parsed.bio.length > 120 ? '…' : ''}"
                  </Typography>
                )}
              </Box>
            </SectionRow>

            <Divider sx={{ my: 1.5 }} />

            {/* Socials */}
            <SectionRow label="Social Links" count={parsed.socials?.length || 0}
              checked={included.socials} onChange={() => toggle('socials')}>
              <Stack direction="row" flexWrap="wrap" gap={0.5}>
                {parsed.socials.map((s, i) => (
                  <Chip key={i} label={`${s.platform}: ${s.url.replace('https://', '')}`} size="small" />
                ))}
              </Stack>
            </SectionRow>

            <Divider sx={{ my: 1.5 }} />

            {/* Skills */}
            <SectionRow label="Skills" count={parsed.skills?.length || 0}
              checked={included.skills} onChange={() => toggle('skills')}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {parsed.skills.slice(0, 20).map((s, i) => (
                  <Chip key={i} label={s.name} size="small"
                    sx={{ bgcolor: s.category === 'frontend' ? 'primary.50' : undefined }} />
                ))}
                {parsed.skills.length > 20 && (
                  <Chip label={`+${parsed.skills.length - 20} more`} size="small" variant="outlined" />
                )}
              </Box>
              <Alert severity="warning" sx={{ py: 0.25 }}>
                All skill levels default to <strong>intermediate</strong> — review them after importing.
              </Alert>
            </SectionRow>

            <Divider sx={{ my: 1.5 }} />

            {/* Experience */}
            <SectionRow label="Experience" count={parsed.experience?.length || 0}
              checked={included.experience} onChange={() => toggle('experience')}>
              {parsed.experience.map((e, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.4 }}>
                  • <b>{e.role || 'Unknown role'}</b>
                  {e.company ? ` @ ${e.company}` : ''}
                  {(e.startDate || e.endDate) ? (
                    <span style={{ color: '#888' }}> ({e.startDate || '?'} – {e.endDate || 'Present'})</span>
                  ) : null}
                </Typography>
              ))}
            </SectionRow>

            <Divider sx={{ my: 1.5 }} />

            {/* Education */}
            <SectionRow label="Education" count={parsed.education?.length || 0}
              checked={included.education} onChange={() => toggle('education')}>
              {parsed.education.map((e, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.4 }}>
                  • <b>{e.degree || 'Degree'}</b>
                  {e.institution ? ` — ${e.institution}` : ''}
                  {e.startYear ? <span style={{ color: '#888' }}> ({e.startYear}{e.endYear ? `–${e.endYear}` : '–Present'})</span> : null}
                </Typography>
              ))}
            </SectionRow>

            <Divider sx={{ my: 1.5 }} />

            {/* Certifications */}
            <SectionRow label="Certifications" count={parsed.certifications?.length || 0}
              checked={included.certifications} onChange={() => toggle('certifications')}>
              {parsed.certifications.map((c, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.4 }}>
                  • <b>{c.title}</b>
                  {c.issuer ? ` — ${c.issuer}` : ''}
                  {c.date ? <span style={{ color: '#888' }}> ({c.date})</span> : null}
                </Typography>
              ))}
            </SectionRow>

            <Divider sx={{ my: 1.5 }} />

            {/* Projects */}
            <SectionRow label="Projects" count={parsed.projects?.length || 0}
              checked={included.projects} onChange={() => toggle('projects')}>
              {parsed.projects.map((p, i) => (
                <Typography key={i} variant="body2" sx={{ mb: 0.4 }}>
                  • <b>{p.title}</b>
                  {p.tech?.length ? <span style={{ color: '#888' }}> ({p.tech.slice(0, 4).join(', ')})</span> : null}
                </Typography>
              ))}
            </SectionRow>

            <Alert severity="info" sx={{ mt: 2 }}>
              Imported items will be <strong>added</strong> to your existing portfolio data, not replaced.
              Review each section after importing.
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setStep('upload')}>Back</Button>
            <Button variant="contained" onClick={handleApply} disabled={!anyIncluded}>
              Apply to Portfolio
            </Button>
          </DialogActions>
        </>
      )}

      {/* ── Applying step ────────────────────────────────────────────────── */}
      {step === 'applying' && (
        <>
          <DialogTitle>Applying to Portfolio…</DialogTitle>
          <DialogContent>
            <Box sx={{ py: 4 }}>
              <LinearProgress sx={{ mb: 3 }} />
              <Typography textAlign="center" color="text.secondary">{progress}</Typography>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
