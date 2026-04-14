import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Edit, Trash2, AlertCircle, User } from 'lucide-react';
import {
  listProfiles, createProfile, updateProfile, deleteProfile,
  uploadPicture, deletePicture,
} from '../api/profilesApi';

// ── Country list ──────────────────────────────────────────────────────────────
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Democratic Republic of the Congo','Denmark','Djibouti','Dominica',
  'Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea',
  'Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala',
  'Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland',
  'India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica',
  'Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein',
  'Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali',
  'Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia',
  'Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger',
  'Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan',
  'Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis',
  'Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino',
  'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles',
  'Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia',
  'South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
  'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
  'Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia',
  'Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates',
  'United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

// ── Avatar helper ─────────────────────────────────────────────────────────────
function ProfileAvatar({ src, name, size = 12 }) {
  const initials = name?.[0]?.toUpperCase();
  return (
    <div
      className={`avatar placeholder shrink-0 w-${size} h-${size} rounded-full bg-primary text-primary-content flex items-center justify-center overflow-hidden`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
    >
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover rounded-full" />
        : <span className="text-lg font-bold">{initials || <User size={20} />}</span>
      }
    </div>
  );
}

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, onEdit, onDelete }) {
  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body p-4 flex-row items-center gap-4">
        <ProfileAvatar src={profile.pictureUrl} name={profile.name} size={14} />

        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight truncate">{profile.name}</p>
          <p className="text-xs text-base-content/40 font-mono mb-1 truncate">ID: {profile.id}</p>
          {profile.nationality && (
            <p className="text-xs text-base-content/60">🌐 {profile.nationality}</p>
          )}
          {profile.expertEmail && (
            <p className="text-xs text-base-content/60 truncate">✉ {profile.expertEmail}</p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            title="Edit"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => onEdit(profile)}
          >
            <Edit size={15} />
          </button>
          <button
            title="Delete"
            className="btn btn-ghost btn-sm btn-circle text-error"
            onClick={() => onDelete(profile)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Country autocomplete ──────────────────────────────────────────────────────
function CountrySelect({ value, onChange }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen]   = useState(false);
  const wrapperRef        = useRef(null);

  // Keep input in sync when value is cleared externally
  useEffect(() => { setQuery(value || ''); }, [value]);

  const filtered = query.length >= 1
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (country) => {
    setQuery(country);
    onChange(country);
    setOpen(false);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    onChange(e.target.value || null);
    setOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          className="input input-bordered w-full pr-8"
          placeholder="Search country…"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
            onClick={handleClear}
          >×</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((country) => (
            <li
              key={country}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-base-200"
              onMouseDown={() => select(country)}
            >
              {country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Profile form dialog ───────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', nationality: null, expertEmail: '' };

function ProfileDialog({ open, onClose, onSaved, editData }) {
  const [form, setForm]          = useState(EMPTY_FORM);
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState('');
  const [picFile, setPicFile]    = useState(null);
  const [picPreview, setPicPrev] = useState(null);
  const [deletePic, setDelPic]   = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setForm({
        name:        editData.name || '',
        nationality: editData.nationality || null,
        expertEmail: editData.expertEmail || '',
      });
      setPicPrev(editData.pictureUrl || null);
    } else {
      setForm(EMPTY_FORM);
      setPicPrev(null);
    }
    setPicFile(null);
    setDelPic(false);
    setError('');
  }, [open, editData]);

  const handlePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPicFile(file);
    setPicPrev(URL.createObjectURL(file));
    setDelPic(false);
  };

  const handleRemovePic = () => {
    setPicFile(null);
    setPicPrev(null);
    setDelPic(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      let saved;
      if (editData) {
        const res = await updateProfile({
          id:          editData.id,
          name:        form.name,
          nationality: form.nationality || null,
          expertEmail: form.expertEmail || null,
        });
        saved = res.data.data;
      } else {
        const res = await createProfile({
          name:        form.name,
          nationality: form.nationality || null,
          expertEmail: form.expertEmail || null,
        });
        saved = res.data.data;
      }

      // Handle picture changes
      if (picFile) {
        const res = await uploadPicture(saved.id, picFile);
        saved = res.data.data;
      } else if (deletePic && editData?.pictureUrl) {
        const res = await deletePicture(saved.id);
        saved = res.data.data;
      }

      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-lg">
        <h3 className="font-bold text-lg mb-4">{editData ? 'Edit Profile' : 'New Profile'}</h3>

        {error && (
          <div role="alert" className="alert alert-error text-sm mb-4">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Picture */}
        <div className="flex items-center gap-4 mb-5">
          <ProfileAvatar src={picPreview} name={form.name} size={16} />
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePicChange}
            />
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fileRef.current?.click()}
              >
                {picPreview ? 'Change Photo' : 'Upload Photo'}
              </button>
              {picPreview && (
                <button
                  type="button"
                  className="btn btn-outline btn-error btn-sm"
                  onClick={handleRemovePic}
                >
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>
            <p className="text-xs text-base-content/50 mt-1">Max 5 MB, image files only</p>
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="label pb-1"><span className="label-text font-medium">Name *</span></label>
          <input
            className="input input-bordered w-full"
            placeholder="Full name…"
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Nationality */}
        <div className="mb-4">
          <label className="label pb-1"><span className="label-text">Nationality (optional)</span></label>
          <CountrySelect
            value={form.nationality}
            onChange={(v) => setForm((f) => ({ ...f, nationality: v }))}
          />
        </div>

        {/* Expert Email */}
        <div className="mb-2">
          <label className="label pb-1"><span className="label-text">Expert Email (optional)</span></label>
          <input
            className="input input-bordered w-full"
            type="email"
            placeholder="expert@example.com"
            value={form.expertEmail}
            onChange={(e) => setForm((f) => ({ ...f, expertEmail: e.target.value }))}
          />
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm" /> : null}
            {editData ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────
function DeleteDialog({ open, profile, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { if (open) setError(''); }, [open]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProfile(profile.id);
      onDeleted(profile.id);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;
  return (
    <dialog className="modal modal-open">
      <div className="modal-box w-11/12 max-w-sm">
        <h3 className="font-bold text-lg mb-3">Delete Profile</h3>

        {error && (
          <div role="alert" className="alert alert-error text-sm mb-3">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <p className="text-sm text-base-content/80">
          Delete <strong>{profile?.name}</strong>? This cannot be undone. Issues assigned to this profile will lose their profile reference.
        </p>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>Cancel</button>
          <button className="btn btn-error" onClick={handleDelete} disabled={deleting}>
            {deleting ? <span className="loading loading-spinner loading-sm" /> : <Trash2 size={15} />}
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IssueProfiles() {
  const [profiles, setProfiles]  = useState([]);
  const [loading, setLoading]    = useState(true);
  const [error, setError]        = useState('');
  const [formOpen, setFormOpen]  = useState(false);
  const [editTarget, setEditTgt] = useState(null);
  const [delTarget, setDelTgt]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listProfiles();
      setProfiles(res.data.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved) => {
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleted = (id) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">

      {/* Header */}
      <div className="flex items-start gap-3 mb-4 flex-wrap">
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">Issue Profiles</h1>
          <p className="text-sm text-base-content/60">
            Profiles can be assigned to GitHub issues to track who is working on them.
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm mt-1"
          onClick={() => { setEditTgt(null); setFormOpen(true); }}
        >
          <Plus size={16} /> New Profile
        </button>
      </div>

      <div className="divider mt-0 mb-4" />

      {/* Error */}
      {error && (
        <div role="alert" className="alert alert-error text-sm mb-4">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-base-content/50">
          <User size={56} className="mx-auto mb-3" />
          <p className="mb-4">No profiles yet. Create one to get started.</p>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setEditTgt(null); setFormOpen(true); }}
          >
            <Plus size={15} /> Create Profile
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onEdit={(profile) => { setEditTgt(profile); setFormOpen(true); }}
              onDelete={(profile) => setDelTgt(profile)}
            />
          ))}
        </div>
      )}

      <ProfileDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        editData={editTarget}
      />

      <DeleteDialog
        open={Boolean(delTarget)}
        profile={delTarget}
        onClose={() => setDelTgt(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
