import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container, Box, Typography, Button, TextField, IconButton,
  Avatar, CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Card, CardContent, CardActions,
  Tooltip, Autocomplete, Chip, Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Public as NationalityIcon,
  DeleteForever as DeletePicIcon,
} from '@mui/icons-material';
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

// ── Profile card ──────────────────────────────────────────────────────────────
function ProfileCard({ profile, onEdit, onDelete }) {
  return (
    <Card variant="outlined" sx={{ display: 'flex', alignItems: 'stretch', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, flexShrink: 0 }}>
        <Avatar
          src={profile.pictureUrl || undefined}
          sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontSize: 22 }}
        >
          {!profile.pictureUrl && profile.name?.[0]?.toUpperCase()}
        </Avatar>
      </Box>
      <CardContent sx={{ flex: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {profile.name}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', display: 'block', mb: 0.5 }}>
          ID: {profile.id}
        </Typography>
        {profile.nationality && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <NationalityIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{profile.nationality}</Typography>
          </Box>
        )}
        {profile.expertEmail && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <EmailIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{profile.expertEmail}</Typography>
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ flexDirection: 'column', justifyContent: 'center', pr: 1, gap: 0.5 }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => onEdit(profile)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => onDelete(profile)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

// ── Profile form dialog ───────────────────────────────────────────────────────
const EMPTY_FORM = { name: '', nationality: null, expertEmail: '' };

function ProfileDialog({ open, onClose, onSaved, editData }) {
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [picFile, setPicFile]   = useState(null);
  const [picPreview, setPicPrev]= useState(null);
  const [deletePic, setDelPic]  = useState(false);
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editData ? 'Edit Profile' : 'New Profile'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Picture */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar src={picPreview || undefined} sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 28 }}>
            {!picPreview && (form.name?.[0]?.toUpperCase() || <PersonIcon />)}
          </Avatar>
          <Box>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePicChange} />
            <Button size="small" variant="outlined" startIcon={<CameraIcon />} onClick={() => fileRef.current?.click()}>
              {picPreview ? 'Change' : 'Upload'}
            </Button>
            {picPreview && (
              <Button size="small" color="error" startIcon={<DeletePicIcon />} onClick={handleRemovePic} sx={{ ml: 1 }}>
                Remove
              </Button>
            )}
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
              Max 5 MB, image files only
            </Typography>
          </Box>
        </Box>

        <TextField
          label="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          fullWidth required autoFocus
          sx={{ mb: 2 }}
        />

        <Autocomplete
          options={COUNTRIES}
          value={form.nationality}
          onChange={(_, v) => setForm(f => ({ ...f, nationality: v }))}
          renderInput={(params) => (
            <TextField {...params} label="Nationality (optional)" placeholder="Search country…" />
          )}
          sx={{ mb: 2 }}
          clearOnEscape
          openOnFocus={false}
        />

        <TextField
          label="Expert Email (optional)"
          value={form.expertEmail}
          onChange={e => setForm(f => ({ ...f, expertEmail: e.target.value }))}
          fullWidth type="email"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={18} /> : (editData ? 'Save' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Profile</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        <Typography>
          Delete <strong>{profile?.name}</strong>? This cannot be undone. Issues assigned to this profile will lose their profile reference.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
          {deleting ? <CircularProgress size={18} /> : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function IssueProfiles() {
  const [profiles, setProfiles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [formOpen, setFormOpen]   = useState(false);
  const [editTarget, setEditTgt]  = useState(null);
  const [delTarget, setDelTgt]    = useState(null);

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
    setProfiles(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleDeleted = (id) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700}>Issue Profiles</Typography>
          <Typography variant="body2" color="text.secondary">
            Profiles can be assigned to GitHub issues to track who is working on them.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditTgt(null); setFormOpen(true); }}>
          New Profile
        </Button>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : profiles.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No profiles yet. Create one to get started.</Typography>
          <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }} onClick={() => { setEditTgt(null); setFormOpen(true); }}>
            Create Profile
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {profiles.map(p => (
            <ProfileCard
              key={p.id}
              profile={p}
              onEdit={(profile) => { setEditTgt(profile); setFormOpen(true); }}
              onDelete={(profile) => setDelTgt(profile)}
            />
          ))}
        </Box>
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
    </Container>
  );
}
