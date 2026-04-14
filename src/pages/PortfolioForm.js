import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Plus, Pencil, Trash2, Save, ExternalLink,
  ChevronUp, ChevronDown, Upload,
} from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import ResumeImport from '../components/ResumeImport';
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

function SectionCard({ children, onEdit, onDelete }) {
  return (
    <div className="card card-bordered bg-base-100 mb-3">
      <div className="card-body py-3 px-4">
        {children}
        <div className="flex gap-1 mt-2">
          <button className="btn btn-ghost btn-xs btn-square" onClick={onEdit}>
            <Pencil size={13} />
          </button>
          <button className="btn btn-ghost btn-xs btn-square text-error" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
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

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">{initial ? 'Edit Social Link' : 'Add Social Link'}</h3>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Platform</span></div>
            <select className="select select-bordered" value={form.platform} onChange={f('platform')}>
              {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">URL</span></div>
            <input className="input input-bordered" autoFocus value={form.url} onChange={f('url')} placeholder="https://..." />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Label (optional)</span></div>
            <input className="input input-bordered" value={form.label} onChange={f('label')} />
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.url.trim()}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
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

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">{initial ? 'Edit Skill' : 'Add Skill'}</h3>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Skill name</span></div>
            <input className="input input-bordered" autoFocus value={form.name} onChange={f('name')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Level</span></div>
            <select className="select select-bordered" value={form.level} onChange={f('level')}>
              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Category</span></div>
            <select className="select select-bordered" value={form.category} onChange={f('category')}>
              {SKILL_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Years of experience</span></div>
            <input className="input input-bordered" type="number" value={form.yearsOfExperience} onChange={f('yearsOfExperience')} />
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.name.trim()}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
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

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">{initial ? 'Edit Experience' : 'Add Experience'}</h3>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Role / Job title</span></div>
            <input className="input input-bordered" autoFocus value={form.role} onChange={f('role')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Company</span></div>
            <input className="input input-bordered" value={form.company} onChange={f('company')} />
          </label>
          <div className="flex gap-3">
            <label className="form-control flex-1">
              <div className="label"><span className="label-text">Type</span></div>
              <select className="select select-bordered" value={form.type} onChange={f('type')}>
                {EXP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="form-control flex-1">
              <div className="label"><span className="label-text">Location</span></div>
              <input className="input input-bordered" value={form.location} onChange={f('location')} />
            </label>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={form.remote}
              onChange={(e) => setForm((p) => ({ ...p, remote: e.target.checked }))}
            />
            <span className="label-text">Remote</span>
          </label>
          <div className="flex gap-3">
            <label className="form-control flex-1">
              <div className="label"><span className="label-text">Start (YYYY-MM)</span></div>
              <input className="input input-bordered" value={form.startDate} onChange={f('startDate')} placeholder="2022-01" />
            </label>
            <label className="form-control flex-1">
              <div className="label"><span className="label-text">End (YYYY-MM)</span></div>
              <input className="input input-bordered" value={form.endDate} onChange={f('endDate')} placeholder="Leave blank = Present" />
            </label>
          </div>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Description</span></div>
            <textarea className="textarea textarea-bordered" rows={4} value={form.description} onChange={f('description')} />
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.role.trim() || !form.company.trim()}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
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

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">{initial ? 'Edit Project' : 'Add Project'}</h3>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Project title</span></div>
            <input className="input input-bordered" autoFocus value={form.title} onChange={f('title')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Description</span></div>
            <textarea className="textarea textarea-bordered" rows={3} value={form.description} onChange={f('description')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Tech stack (comma-separated)</span></div>
            <input className="input input-bordered" value={form.tech} onChange={f('tech')} placeholder="React, Node.js, MongoDB" />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Demo URL</span></div>
            <input className="input input-bordered" value={form.demoUrl} onChange={f('demoUrl')} placeholder="https://..." />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Repo URL</span></div>
            <input className="input input-bordered" value={form.repoUrl} onChange={f('repoUrl')} placeholder="https://github.com/..." />
          </label>
          <ImageUpload
            label="Project image"
            value={form.imageUrl}
            onChange={(url) => setForm((p) => ({ ...p, imageUrl: url }))}
            size={96}
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={form.featured}
              onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))}
            />
            <span className="label-text">Featured project</span>
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(toItem())} disabled={!form.title.trim()}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
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

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">{initial ? 'Edit Education' : 'Add Education'}</h3>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Degree / Certificate title</span></div>
            <input className="input input-bordered" autoFocus value={form.degree} onChange={f('degree')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Institution</span></div>
            <input className="input input-bordered" value={form.institution} onChange={f('institution')} />
          </label>
          <div className="flex gap-3">
            <label className="form-control flex-1">
              <div className="label"><span className="label-text">Start year</span></div>
              <input className="input input-bordered" value={form.startYear} onChange={f('startYear')} placeholder="2018" />
            </label>
            <label className="form-control flex-1">
              <div className="label"><span className="label-text">End year</span></div>
              <input className="input input-bordered" value={form.endYear} onChange={f('endYear')} placeholder="Leave blank = Present" />
            </label>
          </div>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Description</span></div>
            <textarea className="textarea textarea-bordered" rows={2} value={form.description} onChange={f('description')} />
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.degree.trim() || !form.institution.trim()}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
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

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-lg mb-4">{initial ? 'Edit Certification' : 'Add Certification'}</h3>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Certification title</span></div>
            <input className="input input-bordered" autoFocus value={form.title} onChange={f('title')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Issuer / Organization</span></div>
            <input className="input input-bordered" value={form.issuer} onChange={f('issuer')} />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Date (YYYY-MM)</span></div>
            <input className="input input-bordered" value={form.date} onChange={f('date')} placeholder="2023-06" />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">Credential URL</span></div>
            <input className="input input-bordered" value={form.credentialUrl} onChange={f('credentialUrl')} placeholder="https://..." />
          </label>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!form.title.trim()}>Save</button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
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
    <div className="flex flex-col gap-4">
      {error && <div role="alert" className="alert alert-error text-sm"><span>{error}</span></div>}
      {saved  && <div role="alert" className="alert alert-success text-sm"><span>Profile saved!</span></div>}

      <div className="flex gap-3 flex-wrap">
        <label className="form-control flex-1 min-w-48">
          <div className="label"><span className="label-text font-medium">Display name <span className="text-error">*</span></span></div>
          <input className="input input-bordered" value={form.name} onChange={f('name')} />
        </label>
        <label className="form-control flex-1 min-w-48">
          <div className="label"><span className="label-text font-medium">Title / Role <span className="text-error">*</span></span></div>
          <input className="input input-bordered" value={form.title} onChange={f('title')} placeholder="e.g. Full-Stack Developer" />
        </label>
      </div>

      <label className="form-control w-full">
        <div className="label"><span className="label-text">Tagline</span></div>
        <input className="input input-bordered" value={form.tagline} onChange={f('tagline')} placeholder="A short, catchy phrase" />
      </label>

      <label className="form-control w-full">
        <div className="label"><span className="label-text">Bio</span></div>
        <textarea className="textarea textarea-bordered" rows={5} value={form.bio} onChange={f('bio')} />
      </label>

      <ImageUpload
        label="Avatar / Profile photo"
        value={form.avatarUrl}
        onChange={(url) => setForm((p) => ({ ...p, avatarUrl: url }))}
        size={100}
      />

      <label className="form-control w-full">
        <div className="label"><span className="label-text">Location</span></div>
        <input className="input input-bordered" value={form.location} onChange={f('location')} placeholder="City, Country" />
      </label>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="toggle toggle-primary toggle-sm"
          checked={form.availableForWork}
          onChange={(e) => setForm((p) => ({ ...p, availableForWork: e.target.checked }))}
        />
        <span className="label-text">Open to opportunities / available for work</span>
      </label>

      <div className="divider my-1" />
      <p className="font-bold text-sm">Contact info</p>

      <div className="flex gap-3 flex-wrap">
        <label className="form-control flex-1 min-w-48">
          <div className="label"><span className="label-text">Email</span></div>
          <input className="input input-bordered" value={form.contactEmail} onChange={f('contactEmail')} />
        </label>
        <label className="form-control flex-1 min-w-48">
          <div className="label"><span className="label-text">Phone</span></div>
          <input className="input input-bordered" value={form.contactPhone} onChange={f('contactPhone')} />
        </label>
      </div>

      <label className="form-control w-full">
        <div className="label"><span className="label-text">Website</span></div>
        <input className="input input-bordered" value={form.contactWebsite} onChange={f('contactWebsite')} placeholder="https://..." />
      </label>

      <div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-sm" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
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
      {err && <div role="alert" className="alert alert-error text-sm mb-3"><span>{err}</span></div>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <p className="font-bold capitalize">{item.platform}</p>
          <p className="text-sm text-base-content/60">{item.url}</p>
          {item.label && <p className="text-xs text-base-content/40">{item.label}</p>}
        </SectionCard>
      ))}
      {items.length === 0 && <p className="text-base-content/40 mb-3">No social links yet.</p>}
      <button className="btn btn-outline btn-sm" onClick={openAdd}><Plus size={14} /> Add Social Link</button>
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
      {err && <div role="alert" className="alert alert-error text-sm mb-3"><span>{err}</span></div>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold">{item.name}</span>
            <span className="badge badge-sm">{item.level}</span>
            <span className="badge badge-outline badge-sm">{item.category}</span>
            {item.yearsOfExperience > 0 && (
              <span className="text-xs text-base-content/40">{item.yearsOfExperience}y exp</span>
            )}
          </div>
        </SectionCard>
      ))}
      {items.length === 0 && <p className="text-base-content/40 mb-3">No skills yet.</p>}
      <button className="btn btn-outline btn-sm" onClick={openAdd}><Plus size={14} /> Add Skill</button>
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
      {err && <div role="alert" className="alert alert-error text-sm mb-3"><span>{err}</span></div>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <p className="font-bold">{item.role}</p>
          <p className="text-sm text-base-content/60">{item.company}</p>
          <div className="flex gap-1 flex-wrap mt-1">
            {item.type && <span className="badge badge-sm">{item.type}</span>}
            {item.remote && <span className="badge badge-info badge-sm">Remote</span>}
          </div>
          <p className="text-xs text-base-content/40 mt-0.5">
            {item.startDate} – {item.endDate || 'Present'}{item.location ? ` · ${item.location}` : ''}
          </p>
        </SectionCard>
      ))}
      {items.length === 0 && <p className="text-base-content/40 mb-3">No experience yet.</p>}
      <button className="btn btn-outline btn-sm" onClick={openAdd}><Plus size={14} /> Add Experience</button>
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
      {err && <div role="alert" className="alert alert-error text-sm mb-3"><span>{err}</span></div>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <div className="flex items-center gap-2">
            <span className="font-bold flex-1">{item.title}</span>
            {item.featured && <span className="badge badge-primary badge-sm">Featured</span>}
          </div>
          {item.description && (
            <p className="text-sm text-base-content/60 mt-0.5">{item.description}</p>
          )}
          {item.tech?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {item.tech.map((t) => <span key={t} className="badge badge-outline badge-sm">{t}</span>)}
            </div>
          )}
        </SectionCard>
      ))}
      {items.length === 0 && <p className="text-base-content/40 mb-3">No projects yet.</p>}
      <button className="btn btn-outline btn-sm" onClick={openAdd}><Plus size={14} /> Add Project</button>
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
      {err && <div role="alert" className="alert alert-error text-sm mb-3"><span>{err}</span></div>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <p className="font-bold">{item.degree}</p>
          <p className="text-sm text-base-content/60">{item.institution}</p>
          <p className="text-xs text-base-content/40">{item.startYear} – {item.endYear || 'Present'}</p>
        </SectionCard>
      ))}
      {items.length === 0 && <p className="text-base-content/40 mb-3">No education yet.</p>}
      <button className="btn btn-outline btn-sm" onClick={openAdd}><Plus size={14} /> Add Education</button>
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
      {err && <div role="alert" className="alert alert-error text-sm mb-3"><span>{err}</span></div>}
      {items.map((item) => (
        <SectionCard key={item._id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item._id)}>
          <p className="font-bold">{item.title}</p>
          <p className="text-sm text-base-content/60">
            {item.issuer}{item.date ? ` · ${item.date}` : ''}
          </p>
          {item.credentialUrl && (
            <a href={item.credentialUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline">
              View credential →
            </a>
          )}
        </SectionCard>
      ))}
      {items.length === 0 && <p className="text-base-content/40 mb-3">No certifications yet.</p>}
      <button className="btn btn-outline btn-sm" onClick={openAdd}><Plus size={14} /> Add Certification</button>
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
    <div className="flex flex-col gap-6">
      {error && <div role="alert" className="alert alert-error text-sm"><span>{error}</span></div>}
      {saved  && <div role="alert" className="alert alert-success text-sm"><span>Settings saved!</span></div>}

      {/* Theme */}
      <div>
        <p className="font-bold text-sm mb-2">Theme</p>
        <select
          className="select select-bordered w-full max-w-xs"
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
        >
          {themes.map((t) => (
            <option key={t.themeId} value={t.themeId}>
              {t.name}{t.isPremium ? ' ✦ Premium' : ''}
            </option>
          ))}
          {themes.length === 0 && <option value="minimal">Minimal</option>}
        </select>
      </div>

      {/* Section order & visibility */}
      <div>
        <p className="font-bold text-sm mb-2">Section order &amp; visibility</p>
        <div className="flex flex-col gap-2">
          {order.map((key, i) => (
            <div key={key} className="flex items-center gap-3 px-4 py-2 border border-base-300 rounded-lg">
              <span className="flex-1 text-sm">{SECTION_LABELS[key] || key}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-base-content/50">Visible</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm"
                  checked={visible[key] !== false}
                  onChange={() => toggleVisible(key)}
                />
              </label>
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => moveUp(i)} disabled={i === 0}>
                <ChevronUp size={14} />
              </button>
              <button className="btn btn-ghost btn-xs btn-square" onClick={() => moveDown(i)} disabled={i === order.length - 1}>
                <ChevronDown size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SEO */}
      <div>
        <p className="font-bold text-sm mb-2">SEO</p>
        <div className="flex flex-col gap-3">
          <label className="form-control w-full">
            <div className="label"><span className="label-text">SEO title</span></div>
            <input
              className="input input-bordered"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="My Portfolio — Full-Stack Developer"
            />
          </label>
          <label className="form-control w-full">
            <div className="label"><span className="label-text">SEO description</span></div>
            <textarea
              className="textarea textarea-bordered"
              rows={2}
              value={seoDesc}
              onChange={(e) => setSeoDesc(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-sm" /> : <Save size={15} />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

// ── Edit dashboard ─────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Socials', 'Skills', 'Experience', 'Projects', 'Education', 'Certifications', 'Settings'];

function EditPortfolioDashboard({ initialPortfolio }) {
  const navigate = useNavigate();
  const [portfolio,  setPortfolio]  = useState(initialPortfolio);
  const [tab,        setTab]        = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const portfolioId = portfolio._id || portfolio.id;

  const handleUpdate = useCallback((updated) => setPortfolio(updated), []);

  const tabContent = [
    <ProfileTab       portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <SocialsTab       portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <SkillsTab        portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <ExperienceTab    portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <ProjectsTab      portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <EducationTab     portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <CertificationsTab portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
    <SettingsTab      portfolio={portfolio} portfolioId={portfolioId} setPortfolio={handleUpdate} />,
  ];

  return (
    <div className="bg-base-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-base-200">
        <button className="btn btn-ghost btn-sm gap-1" onClick={() => navigate('/portfolios')}>
          <ArrowLeft size={15} /> Portfolios
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{portfolio.name}</p>
          <p className="text-xs text-base-content/40">/{portfolio.slug}</p>
        </div>
        <button className="btn btn-outline btn-sm gap-1" onClick={() => setImportOpen(true)}>
          <Upload size={14} /> Import Resume
        </button>
        <a
          className="btn btn-outline btn-sm gap-1"
          href={`/${portfolio.slug}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview <ExternalLink size={13} />
        </a>
      </div>

      <ResumeImport
        open={importOpen}
        portfolioId={portfolioId}
        setPortfolio={handleUpdate}
        onClose={() => setImportOpen(false)}
      />

      {/* Tabs */}
      <div className="border-b border-base-200 px-2 sm:px-4 overflow-x-auto">
        <div role="tablist" className="tabs tabs-bordered flex-nowrap whitespace-nowrap">
          {TABS.map((label, i) => (
            <button
              key={label}
              role="tab"
              className={`tab ${tab === i ? 'tab-active' : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-3xl px-4 py-6">
        {tabContent[tab]}
      </div>
    </div>
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
    <div className="container mx-auto max-w-lg px-4 mt-10 mb-12">
      <div className="flex items-center gap-2 mb-6">
        <button className="btn btn-ghost btn-sm gap-1" onClick={() => navigate('/portfolios')}>
          <ArrowLeft size={15} /> Back
        </button>
        <h1 className="text-2xl font-bold flex-1">New Portfolio</h1>
      </div>

      {error && <div role="alert" className="alert alert-error text-sm mb-4"><span>{error}</span></div>}

      <div className="flex flex-col gap-4">
        <label className="form-control w-full">
          <div className="label"><span className="label-text font-medium">Portfolio name <span className="text-error">*</span></span></div>
          <input
            className="input input-bordered" autoFocus
            value={form.name} onChange={f('name')}
            placeholder="e.g. John's Dev Portfolio"
          />
        </label>
        <label className="form-control w-full">
          <div className="label"><span className="label-text font-medium">Your title / role <span className="text-error">*</span></span></div>
          <input
            className="input input-bordered"
            value={form.title} onChange={f('title')}
            placeholder="e.g. Full-Stack Developer"
          />
        </label>
        <label className="form-control w-full">
          <div className="label"><span className="label-text">Bio (optional)</span></div>
          <textarea className="textarea textarea-bordered" rows={4} value={form.bio} onChange={f('bio')} />
        </label>
        <div className="flex gap-3">
          <button className="btn btn-outline" onClick={() => navigate('/portfolios')} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : null}
            {saving ? 'Creating…' : 'Create Portfolio'}
          </button>
        </div>
      </div>
    </div>
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
      <div className="flex justify-center mt-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!portfolio) return null;

  return <EditPortfolioDashboard initialPortfolio={portfolio} />;
}
