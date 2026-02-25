import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, Alert, Stack, CircularProgress,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions,
  Card, CardContent, CardActions, IconButton, Chip, FormControlLabel,
  Switch, Select, MenuItem, FormControl, InputLabel, Container, Divider,
} from '@mui/material';
import {
  ArrowBack as BackIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, Save as SaveIcon, OpenInNew as OpenIcon,
  KeyboardArrowUp as UpIcon, KeyboardArrowDown as DownIcon,
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import {
  createPortfolio, getPortfolioBySlug,
  updateHero, addSectionItem, updateSectionItem, deleteSectionItem,
  updateSettings,
} from '../api/portfolioApi';
import { listThemes } from '../api/themesApi';

// ── Constants ──────────────────────────────────────────────────────────────────

const SKILL_LEVELS     = ['beginner', 'intermediate', 'advanced', 'expert'];
const SKILL_CATS       = ['frontend', 'backend', 'devops', 'design', 'other'];
const EXP_TYPES        = ['full-time', 'part-time', 'contract', 'internship', 'freelance'];
const SOCIAL_PLATFORMS = ['github', 'linkedin', 'twitter', 'youtube', 'instagram', 'other'];
const DEFAULT_SECTIONS = ['skills', 'experience', 'projects', 'education', 'certifications'];
const SECTION_LABELS   = {
  skills: 'Skills', experience: 'Experience', projects: 'Projects',
  education: 'Education', certifications: 'Certifications',
};

// ── Small helpers ──────────────────────────────────────────────────────────────

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

function SectionCard({ children, onEdit, onDelete }) {
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: '8px !important' }}>{children}</CardContent>
      <CardActions sx={{ pt: 0, px: 2, pb: 1 }}>
        <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
        <IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
      </CardActions>
    </Card>
  );
}

function useSectionDialog() {
  const [dlg, setDlg] = useState({ open: false, item: null });
  const openAdd  = () => setDlg({ open: true, item: null });
  const openEdit = (item) => setDlg({ open: true, item });
  const close    = () => setDlg({ open: false, item: null });
  return { dlg, openAdd, openEdit, close };
}

// ── Section dialog forms ───────────────────────────────────────────────────────

function SocialDialog({ open, initial, onSave, onClose }) {
  const empty = { platform: 'github', url: '', label: '' };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm(initial
      ? { platform: initial.platform || 'github', url: initial.url || '', label: initial.label || '' }
      : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Social Link' : 'Add Social Link'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Platform</InputLabel>
            <Select value={form.platform} label="Platform" onChange={f('platform')}>
              {SOCIAL_PLATFORMS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="URL" fullWidth autoFocus value={form.url} onChange={f('url')} placeholder="https://..." />
          <TextField label="Label (optional)" fullWidth value={form.label} onChange={f('label')} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.url.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function SkillDialog({ open, initial, onSave, onClose }) {
  const empty = { name: '', level: 'intermediate', category: 'other', yearsOfExperience: '' };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm(initial
      ? { name: initial.name || '', level: initial.level || 'intermediate', category: initial.category || 'other', yearsOfExperience: initial.yearsOfExperience || '' }
      : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Skill' : 'Add Skill'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Skill name" fullWidth autoFocus value={form.name} onChange={f('name')} />
          <FormControl fullWidth>
            <InputLabel>Level</InputLabel>
            <Select value={form.level} label="Level" onChange={f('level')}>
              {SKILL_LEVELS.map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={form.category} label="Category" onChange={f('category')}>
              {SKILL_CATS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Years of experience" type="number" fullWidth value={form.yearsOfExperience} onChange={f('yearsOfExperience')} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function ExperienceDialog({ open, initial, onSave, onClose }) {
  const empty = { role: '', company: '', type: 'full-time', location: '', remote: false, startDate: '', endDate: '', description: '' };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm(initial ? {
      role: initial.role || '', company: initial.company || '', type: initial.type || 'full-time',
      location: initial.location || '', remote: initial.remote || false,
      startDate: initial.startDate || '', endDate: initial.endDate || '',
      description: initial.description || '',
    } : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Experience' : 'Add Experience'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Role / Job title" fullWidth autoFocus value={form.role} onChange={f('role')} />
          <TextField label="Company" fullWidth value={form.company} onChange={f('company')} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ flex: 1 }}>
              <InputLabel>Type</InputLabel>
              <Select value={form.type} label="Type" onChange={f('type')}>
                {EXP_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Location" sx={{ flex: 1 }} value={form.location} onChange={f('location')} />
          </Box>
          <FormControlLabel
            control={<Switch checked={form.remote} onChange={(e) => setForm((p) => ({ ...p, remote: e.target.checked }))} />}
            label="Remote"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Start (YYYY-MM)" sx={{ flex: 1 }} value={form.startDate} onChange={f('startDate')} placeholder="2022-01" />
            <TextField label="End (YYYY-MM)" sx={{ flex: 1 }} value={form.endDate} onChange={f('endDate')} placeholder="Leave blank = Present" />
          </Box>
          <TextField label="Description" fullWidth multiline rows={4} value={form.description} onChange={f('description')} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.role.trim() || !form.company.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function ProjectDialog({ open, initial, onSave, onClose }) {
  const empty = { title: '', description: '', tech: '', demoUrl: '', repoUrl: '', imageUrl: '', featured: false };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm(initial ? {
      title: initial.title || '', description: initial.description || '',
      tech: (initial.tech || []).join(', '),
      demoUrl: initial.demoUrl || '', repoUrl: initial.repoUrl || '',
      imageUrl: initial.imageUrl || '', featured: initial.featured || false,
    } : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const toItem = () => ({ ...form, tech: form.tech.split(',').map((t) => t.trim()).filter(Boolean) });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Project' : 'Add Project'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Project title" fullWidth autoFocus value={form.title} onChange={f('title')} />
          <TextField label="Description" fullWidth multiline rows={3} value={form.description} onChange={f('description')} />
          <TextField label="Tech stack (comma-separated)" fullWidth value={form.tech} onChange={f('tech')} placeholder="React, Node.js, MongoDB" />
          <TextField label="Demo URL" fullWidth value={form.demoUrl} onChange={f('demoUrl')} placeholder="https://..." />
          <TextField label="Repo URL" fullWidth value={form.repoUrl} onChange={f('repoUrl')} placeholder="https://github.com/..." />
          <ImageUpload
            label="Project image"
            value={form.imageUrl}
            onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
            size={96}
          />
          <FormControlLabel
            control={<Switch checked={form.featured} onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} />}
            label="Featured project"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(toItem())} disabled={!form.title.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function EducationDialog({ open, initial, onSave, onClose }) {
  const empty = { degree: '', institution: '', startYear: '', endYear: '', description: '' };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm(initial ? {
      degree: initial.degree || '', institution: initial.institution || '',
      startYear: initial.startYear || '', endYear: initial.endYear || '',
      description: initial.description || '',
    } : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Education' : 'Add Education'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Degree / Certificate title" fullWidth autoFocus value={form.degree} onChange={f('degree')} />
          <TextField label="Institution" fullWidth value={form.institution} onChange={f('institution')} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Start year" sx={{ flex: 1 }} value={form.startYear} onChange={f('startYear')} placeholder="2018" />
            <TextField label="End year" sx={{ flex: 1 }} value={form.endYear} onChange={f('endYear')} placeholder="Leave blank = Present" />
          </Box>
          <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={f('description')} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.degree.trim() || !form.institution.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function CertificationDialog({ open, initial, onSave, onClose }) {
  const empty = { title: '', issuer: '', date: '', credentialUrl: '' };
  const [form, setForm] = useState(empty);
  useEffect(() => {
    setForm(initial ? {
      title: initial.title || '', issuer: initial.issuer || '',
      date: initial.date || '', credentialUrl: initial.credentialUrl || '',
    } : empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial ? 'Edit Certification' : 'Add Certification'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Certification title" fullWidth autoFocus value={form.title} onChange={f('title')} />
          <TextField label="Issuer / Organization" fullWidth value={form.issuer} onChange={f('issuer')} />
          <TextField label="Date (YYYY-MM)" fullWidth value={form.date} onChange={f('date')} placeholder="2023-06" />
          <TextField label="Credential URL" fullWidth value={form.credentialUrl} onChange={f('credentialUrl')} placeholder="https://..." />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => onSave(form)} disabled={!form.title.trim()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Profile tab ────────────────────────────────────────────────────────────────

function ProfileTab({ portfolio, portfolioId, setPortfolio }) {
  const [form, setForm] = useState({
    name: portfolio.name || '',
    title: portfolio.title || '',
    tagline: portfolio.tagline || '',
    bio: portfolio.bio || '',
    avatarUrl: portfolio.avatarUrl || '',
    location: portfolio.location || '',
    availableForWork: portfolio.availableForWork || false,
    contactEmail: portfolio.contact?.email || '',
    contactPhone: portfolio.contact?.phone || '',
    contactWebsite: portfolio.contact?.website || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim()) { setError('Name and title are required'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await updateHero({
        id: portfolioId,
        name: form.name.trim(), title: form.title.trim(), tagline: form.tagline.trim(),
        bio: form.bio.trim(), avatarUrl: form.avatarUrl.trim(), location: form.location.trim(),
        availableForWork: form.availableForWork,
        contact: {
          email: form.contactEmail.trim(),
          phone: form.contactPhone.trim(),
          website: form.contactWebsite.trim(),
        },
      });
      setPortfolio(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}
      {saved  && <Alert severity="success">Profile saved!</Alert>}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField label="Display name" required sx={{ flex: 1, minWidth: 200 }} value={form.name} onChange={f('name')} />
        <TextField label="Title / Role" required sx={{ flex: 1, minWidth: 200 }} value={form.title} onChange={f('title')} placeholder="e.g. Full-Stack Developer" />
      </Box>
      <TextField label="Tagline" fullWidth value={form.tagline} onChange={f('tagline')} placeholder="A short, catchy phrase" />
      <TextField label="Bio" fullWidth multiline rows={5} value={form.bio} onChange={f('bio')} />
      <ImageUpload
        label="Avatar / Profile photo"
        value={form.avatarUrl}
        onChange={(url) => setForm((p) => ({ ...p, avatarUrl: url }))}
        size={100}
      />
      <TextField label="Location" fullWidth value={form.location} onChange={f('location')} placeholder="City, Country" />
      <FormControlLabel
        control={<Switch checked={form.availableForWork} onChange={(e) => setForm((p) => ({ ...p, availableForWork: e.target.checked }))} />}
        label="Open to opportunities / available for work"
      />
      <Divider />
      <Typography variant="subtitle2" fontWeight={700}>Contact info</Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField label="Email" sx={{ flex: 1, minWidth: 200 }} value={form.contactEmail} onChange={f('contactEmail')} />
        <TextField label="Phone" sx={{ flex: 1, minWidth: 200 }} value={form.contactPhone} onChange={f('contactPhone')} />
      </Box>
      <TextField label="Website" fullWidth value={form.contactWebsite} onChange={f('contactWebsite')} placeholder="https://..." />
      <Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
      </Box>
    </Stack>
  );
}

// ── Section tabs ───────────────────────────────────────────────────────────────

function SocialsTab({ portfolio, portfolioId, setPortfolio }) {
  const { dlg, openAdd, openEdit, close } = useSectionDialog();
  const [err, setErr] = useState('');
  const items = portfolio.socials || [];

  const handleSave = async (values) => {
    setErr('');
    try {
      const res = dlg.item
        ? await updateSectionItem({ id: portfolioId, section: 'socials', itemId: dlg.item._id, item: values })
        : await addSectionItem({ id: portfolioId, section: 'socials', item: values });
      setPortfolio(res.data); close();
    } catch { setErr('Save failed'); }
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteSectionItem({ id: portfolioId, section: 'socials', itemId });
      setPortfolio(res.data);
    } catch { setErr('Delete failed'); }
  };

  return (
    <>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <Typography fontWeight={700} sx={{ textTransform: 'capitalize' }}>{item.platform}</Typography>
          <Typography variant="body2" color="text.secondary">{item.url}</Typography>
          {item.label && <Typography variant="caption" color="text.disabled">{item.label}</Typography>}
        </SectionCard>
      ))}
      {items.length === 0 && <Typography color="text.disabled" sx={{ mb: 2 }}>No social links yet.</Typography>}
      <Button startIcon={<AddIcon />} onClick={openAdd}>Add Social Link</Button>
      <SocialDialog open={dlg.open} initial={dlg.item} onSave={handleSave} onClose={close} />
    </>
  );
}

function SkillsTab({ portfolio, portfolioId, setPortfolio }) {
  const { dlg, openAdd, openEdit, close } = useSectionDialog();
  const [err, setErr] = useState('');
  const items = portfolio.skills || [];

  const handleSave = async (values) => {
    setErr('');
    try {
      const res = dlg.item
        ? await updateSectionItem({ id: portfolioId, section: 'skills', itemId: dlg.item._id, item: values })
        : await addSectionItem({ id: portfolioId, section: 'skills', item: values });
      setPortfolio(res.data); close();
    } catch { setErr('Save failed'); }
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteSectionItem({ id: portfolioId, section: 'skills', itemId });
      setPortfolio(res.data);
    } catch { setErr('Delete failed'); }
  };

  return (
    <>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography fontWeight={700}>{item.name}</Typography>
            <Chip label={item.level} size="small" />
            <Chip label={item.category} size="small" variant="outlined" />
            {item.yearsOfExperience > 0 && (
              <Typography variant="caption" color="text.disabled">{item.yearsOfExperience}y exp</Typography>
            )}
          </Box>
        </SectionCard>
      ))}
      {items.length === 0 && <Typography color="text.disabled" sx={{ mb: 2 }}>No skills yet.</Typography>}
      <Button startIcon={<AddIcon />} onClick={openAdd}>Add Skill</Button>
      <SkillDialog open={dlg.open} initial={dlg.item} onSave={handleSave} onClose={close} />
    </>
  );
}

function ExperienceTab({ portfolio, portfolioId, setPortfolio }) {
  const { dlg, openAdd, openEdit, close } = useSectionDialog();
  const [err, setErr] = useState('');
  const items = portfolio.experience || [];

  const handleSave = async (values) => {
    setErr('');
    try {
      const res = dlg.item
        ? await updateSectionItem({ id: portfolioId, section: 'experience', itemId: dlg.item._id, item: values })
        : await addSectionItem({ id: portfolioId, section: 'experience', item: values });
      setPortfolio(res.data); close();
    } catch { setErr('Save failed'); }
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteSectionItem({ id: portfolioId, section: 'experience', itemId });
      setPortfolio(res.data);
    } catch { setErr('Delete failed'); }
  };

  return (
    <>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <Typography fontWeight={700}>{item.role}</Typography>
          <Typography variant="body2" color="text.secondary">{item.company}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {item.type && <Chip label={item.type} size="small" />}
            {item.remote && <Chip label="Remote" size="small" color="info" />}
          </Box>
          <Typography variant="caption" color="text.disabled">
            {item.startDate} – {item.endDate || 'Present'}{item.location ? ` · ${item.location}` : ''}
          </Typography>
        </SectionCard>
      ))}
      {items.length === 0 && <Typography color="text.disabled" sx={{ mb: 2 }}>No experience yet.</Typography>}
      <Button startIcon={<AddIcon />} onClick={openAdd}>Add Experience</Button>
      <ExperienceDialog open={dlg.open} initial={dlg.item} onSave={handleSave} onClose={close} />
    </>
  );
}

function ProjectsTab({ portfolio, portfolioId, setPortfolio }) {
  const { dlg, openAdd, openEdit, close } = useSectionDialog();
  const [err, setErr] = useState('');
  const items = portfolio.projects || [];

  const handleSave = async (values) => {
    setErr('');
    try {
      const res = dlg.item
        ? await updateSectionItem({ id: portfolioId, section: 'projects', itemId: dlg.item._id, item: values })
        : await addSectionItem({ id: portfolioId, section: 'projects', item: values });
      setPortfolio(res.data); close();
    } catch { setErr('Save failed'); }
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteSectionItem({ id: portfolioId, section: 'projects', itemId });
      setPortfolio(res.data);
    } catch { setErr('Delete failed'); }
  };

  return (
    <>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography fontWeight={700} sx={{ flex: 1 }}>{item.title}</Typography>
            {item.featured && <Chip label="Featured" size="small" color="primary" />}
          </Box>
          {item.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{item.description}</Typography>
          )}
          {item.tech?.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {item.tech.map((t) => <Chip key={t} label={t} size="small" variant="outlined" />)}
            </Box>
          )}
        </SectionCard>
      ))}
      {items.length === 0 && <Typography color="text.disabled" sx={{ mb: 2 }}>No projects yet.</Typography>}
      <Button startIcon={<AddIcon />} onClick={openAdd}>Add Project</Button>
      <ProjectDialog open={dlg.open} initial={dlg.item} onSave={handleSave} onClose={close} />
    </>
  );
}

function EducationTab({ portfolio, portfolioId, setPortfolio }) {
  const { dlg, openAdd, openEdit, close } = useSectionDialog();
  const [err, setErr] = useState('');
  const items = portfolio.education || [];

  const handleSave = async (values) => {
    setErr('');
    try {
      const res = dlg.item
        ? await updateSectionItem({ id: portfolioId, section: 'education', itemId: dlg.item._id, item: values })
        : await addSectionItem({ id: portfolioId, section: 'education', item: values });
      setPortfolio(res.data); close();
    } catch { setErr('Save failed'); }
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteSectionItem({ id: portfolioId, section: 'education', itemId });
      setPortfolio(res.data);
    } catch { setErr('Delete failed'); }
  };

  return (
    <>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <Typography fontWeight={700}>{item.degree}</Typography>
          <Typography variant="body2" color="text.secondary">{item.institution}</Typography>
          <Typography variant="caption" color="text.disabled">
            {item.startYear} – {item.endYear || 'Present'}
          </Typography>
        </SectionCard>
      ))}
      {items.length === 0 && <Typography color="text.disabled" sx={{ mb: 2 }}>No education yet.</Typography>}
      <Button startIcon={<AddIcon />} onClick={openAdd}>Add Education</Button>
      <EducationDialog open={dlg.open} initial={dlg.item} onSave={handleSave} onClose={close} />
    </>
  );
}

function CertificationsTab({ portfolio, portfolioId, setPortfolio }) {
  const { dlg, openAdd, openEdit, close } = useSectionDialog();
  const [err, setErr] = useState('');
  const items = portfolio.certifications || [];

  const handleSave = async (values) => {
    setErr('');
    try {
      const res = dlg.item
        ? await updateSectionItem({ id: portfolioId, section: 'certifications', itemId: dlg.item._id, item: values })
        : await addSectionItem({ id: portfolioId, section: 'certifications', item: values });
      setPortfolio(res.data); close();
    } catch { setErr('Save failed'); }
  };

  const handleDelete = async (itemId) => {
    try {
      const res = await deleteSectionItem({ id: portfolioId, section: 'certifications', itemId });
      setPortfolio(res.data);
    } catch { setErr('Delete failed'); }
  };

  return (
    <>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <Typography fontWeight={700}>{item.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {item.issuer}{item.date ? ` · ${item.date}` : ''}
          </Typography>
          {item.credentialUrl && (
            <Typography variant="caption">
              <a href={item.credentialUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                View credential →
              </a>
            </Typography>
          )}
        </SectionCard>
      ))}
      {items.length === 0 && <Typography color="text.disabled" sx={{ mb: 2 }}>No certifications yet.</Typography>}
      <Button startIcon={<AddIcon />} onClick={openAdd}>Add Certification</Button>
      <CertificationDialog open={dlg.open} initial={dlg.item} onSave={handleSave} onClose={close} />
    </>
  );
}

// ── Settings tab ───────────────────────────────────────────────────────────────

function SettingsTab({ portfolio, portfolioId, setPortfolio }) {
  const [themes,   setThemes]   = useState([]);
  const [themeId,  setThemeId]  = useState(portfolio.themeId || 'minimal');
  const [visible,  setVisible]  = useState(portfolio.settings?.sectionsVisible || {});
  const [order,    setOrder]    = useState(portfolio.settings?.sectionsOrder   || DEFAULT_SECTIONS);
  const [seoTitle, setSeoTitle] = useState(portfolio.settings?.seoTitle        || '');
  const [seoDesc,  setSeoDesc]  = useState(portfolio.settings?.seoDescription  || '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    listThemes().then((r) => setThemes(r.data || [])).catch(() => {});
  }, []);

  const toggleVisible = (key) =>
    setVisible((p) => ({ ...p, [key]: p[key] === false ? true : false }));

  const moveUp = (i) => {
    if (i === 0) return;
    setOrder((o) => { const a = [...o]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; });
  };
  const moveDown = (i) => {
    setOrder((o) => {
      if (i === o.length - 1) return o;
      const a = [...o]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a;
    });
  };

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await updateHero({ id: portfolioId, themeId });
      const r = await updateSettings({
        id: portfolioId, sectionsOrder: order,
        sectionsVisible: visible, seoTitle, seoDescription: seoDesc,
      });
      setPortfolio(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={4}>
      {error && <Alert severity="error">{error}</Alert>}
      {saved  && <Alert severity="success">Settings saved!</Alert>}

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Theme</Typography>
        <FormControl sx={{ minWidth: 260 }}>
          <InputLabel>Theme</InputLabel>
          <Select value={themeId} label="Theme" onChange={(e) => setThemeId(e.target.value)}>
            {themes.map((t) => (
              <MenuItem key={t.themeId} value={t.themeId}>
                {t.name}{t.isPremium ? ' ✦ Premium' : ''}
              </MenuItem>
            ))}
            {themes.length === 0 && <MenuItem value="minimal">Minimal</MenuItem>}
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
          Section order &amp; visibility
        </Typography>
        <Stack spacing={1}>
          {order.map((key, i) => (
            <Box key={key} sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5,
              border: '1px solid', borderColor: 'divider', borderRadius: 1,
            }}>
              <Typography sx={{ flex: 1 }}>{SECTION_LABELS[key] || key}</Typography>
              <FormControlLabel
                control={
                  <Switch size="small" checked={visible[key] !== false}
                    onChange={() => toggleVisible(key)} />
                }
                label="Visible"
                labelPlacement="start"
                sx={{ mr: 0 }}
              />
              <IconButton size="small" onClick={() => moveUp(i)} disabled={i === 0}>
                <UpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => moveDown(i)} disabled={i === order.length - 1}>
                <DownIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>SEO</Typography>
        <Stack spacing={2}>
          <TextField
            label="SEO title" fullWidth value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            placeholder="My Portfolio — Full-Stack Developer"
          />
          <TextField
            label="SEO description" fullWidth multiline rows={2} value={seoDesc}
            onChange={(e) => setSeoDesc(e.target.value)}
          />
        </Stack>
      </Box>

      <Box>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </Box>
    </Stack>
  );
}

// ── Edit dashboard ─────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Socials', 'Skills', 'Experience', 'Projects', 'Education', 'Certifications', 'Settings'];

function EditPortfolioDashboard({ initialPortfolio }) {
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [tab, setTab] = useState(0);
  const portfolioId = portfolio._id || portfolio.id;

  const handleUpdate = useCallback((updated) => setPortfolio(updated), []);

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{
        borderBottom: '1px solid', borderColor: 'divider',
        px: { xs: 2, sm: 3 }, py: 1.5,
        display: 'flex', alignItems: 'center', gap: 2,
      }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/portfolios')} color="inherit" size="small">
          Portfolios
        </Button>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{portfolio.name}</Typography>
          <Typography variant="caption" color="text.disabled">/{portfolio.slug}</Typography>
        </Box>
        <Button
          variant="outlined" size="small" endIcon={<OpenIcon />}
          component="a" href={`/${portfolio.slug}`} target="_blank" rel="noopener"
        >
          Preview
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: { xs: 0, sm: 2 } }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {TABS.map((label) => <Tab key={label} label={label} />)}
        </Tabs>
      </Box>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 4 }}>
        <TabPanel value={tab} index={0}>
          <ProfileTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <SocialsTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <SkillsTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={3}>
          <ExperienceTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={4}>
          <ProjectsTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={5}>
          <EducationTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={6}>
          <CertificationsTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
        <TabPanel value={tab} index={7}>
          <SettingsTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />
        </TabPanel>
      </Container>
    </Box>
  );
}

// ── Create view ────────────────────────────────────────────────────────────────

function CreatePortfolioView() {
  const navigate = useNavigate();
  const [form,   setForm]   = useState({ name: '', title: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.name.trim() || !form.title.trim()) { setError('Name and title are required'); return; }
    setSaving(true); setError('');
    try {
      const res = await createPortfolio({ name: form.name.trim(), title: form.title.trim(), bio: form.bio.trim() });
      navigate(`/portfolios/${res.data.slug}`, { state: { portfolio: res.data } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create portfolio');
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 6, mb: 8 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 1 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/portfolios')} color="inherit">
          Back
        </Button>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>New Portfolio</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Stack spacing={3}>
        <TextField
          label="Portfolio name" required fullWidth autoFocus
          value={form.name} onChange={f('name')}
          placeholder="e.g. John's Dev Portfolio"
        />
        <TextField
          label="Your title / role" required fullWidth
          value={form.title} onChange={f('title')}
          placeholder="e.g. Full-Stack Developer"
        />
        <TextField
          label="Bio (optional)" fullWidth multiline rows={4}
          value={form.bio} onChange={f('bio')}
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={() => navigate('/portfolios')} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create Portfolio'}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function PortfolioForm() {
  const { portfolioKey } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isEdit = Boolean(portfolioKey);
  const [portfolio, setPortfolio] = useState(null);
  const [loading,   setLoading]   = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;

    const prefetched = location.state?.portfolio;
    if (prefetched) {
      setPortfolio(prefetched);
      setLoading(false);
      return;
    }

    getPortfolioBySlug(portfolioKey)
      .then((res) => {
        const p = res.data;
        const ownerId = (typeof p.userId === 'object' ? p.userId._id : p.userId)?.toString();
        if (ownerId !== user?._id?.toString()) {
          navigate('/portfolios', { replace: true });
          return;
        }
        setPortfolio(p);
      })
      .catch(() => navigate('/portfolios', { replace: true }))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioKey, isEdit]);

  if (!isEdit) return <CreatePortfolioView />;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!portfolio) return null;

  return <EditPortfolioDashboard initialPortfolio={portfolio} />;
}
