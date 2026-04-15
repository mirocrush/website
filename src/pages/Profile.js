import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff, Camera, Trash2, CheckCircle, AlertCircle, UserCog, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  changePassword, changeUsername, changeDisplayName, deleteAccount,
  checkUsername, uploadAvatar, deleteAvatar,
} from '../api/authApi';
import CropAvatarModal from '../components/CropAvatarModal';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// ── Avatar Section ─────────────────────────────────────────────────────────

function AvatarSection() {
  const { user, setUser } = useAuth();
  const fileRef                     = useRef(null);
  const [uploading,  setUploading]  = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState('');
  const [cropSrc,    setCropSrc]    = useState(null); // data-URL while crop modal is open

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  /* File chosen → read as data URL → open crop modal */
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
  }, []);

  /* Crop modal confirmed → upload the cropped File */
  const handleCropped = useCallback(async (croppedFile) => {
    setCropSrc(null);
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', croppedFile, 'avatar.jpg');
      const res = await uploadAvatar(fd);
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [setUser]);

  const handleDelete = async () => {
    setError('');
    setDeleting(true);
    try {
      const res = await deleteAvatar();
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Crop modal (rendered at root level so it overlays everything) */}
      {cropSrc && (
        <CropAvatarModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onCropped={handleCropped}
        />
      )}

      <div>
        <h2 className="font-bold text-base mb-4">Profile Picture</h2>

        {error && (
          <div role="alert" className="alert alert-error text-sm py-2 mb-4">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-5">
          {/* Avatar preview */}
          {user?.avatarUrl ? (
            <div className="avatar">
              <div className="w-20 rounded-full ring-2 ring-primary ring-offset-base-100 ring-offset-2">
                <img src={user.avatarUrl} alt="avatar" />
              </div>
            </div>
          ) : (
            <div className="avatar placeholder">
              <div className="w-20 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-content ring-2 ring-primary ring-offset-base-100 ring-offset-2">
                <span className="text-2xl font-bold">{initials}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="btn btn-outline btn-sm gap-2 cursor-pointer">
              {uploading
                ? <span className="loading loading-spinner loading-xs" />
                : <Camera size={14} />}
              {uploading ? 'Uploading…' : 'Upload Photo'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading || deleting}
              />
            </label>

            {user?.avatarUrl && (
              <button
                className="btn btn-outline btn-error btn-sm gap-2"
                onClick={handleDelete}
                disabled={uploading || deleting}
              >
                {deleting
                  ? <span className="loading loading-spinner loading-xs" />
                  : <Trash2 size={14} />}
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            )}
            <p className="text-xs text-base-content/40">Max 5 MB · JPG, PNG, GIF, WebP</p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Change Display Name ────────────────────────────────────────────────────

function ChangeDisplayNameSection() {
  const { user, setUser }             = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [loading, setLoading]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    setError('');
    setSuccess('');
    if (!trimmed)           return setError('Display name cannot be empty');
    if (trimmed.length > 50) return setError('Display name must be 50 characters or fewer');

    setLoading(true);
    try {
      const res = await changeDisplayName({ displayName: trimmed });
      setUser(res.data);
      setSuccess('Display name updated successfully');
      setDisplayName('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update display name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-bold text-base mb-4">Display Name</h2>

      {error   && <div role="alert" className="alert alert-error text-sm py-2 mb-4"><AlertCircle size={16} /><span>{error}</span></div>}
      {success && <div role="alert" className="alert alert-success text-sm py-2 mb-4"><CheckCircle size={16} /><span>{success}</span></div>}

      <div className="flex flex-col gap-2 max-w-sm">
        <div className="flex flex-col gap-1">
          <input
            className="input w-full"
            placeholder="New display name"
            required
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-base-content/40">Current: {user?.displayName || ''}</p>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm self-start gap-2"
          disabled={loading || !displayName.trim()}
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
          {loading ? 'Saving…' : 'Save Display Name'}
        </button>
      </div>
    </form>
  );
}

// ── Change Username ────────────────────────────────────────────────────────

function ChangeUsernameSection() {
  const { user, setUser }       = useAuth();
  const [username, setUsername] = useState('');
  const [status, setStatus]     = useState(null);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);
  const debounceRef             = useRef(null);

  useEffect(() => {
    const val = username.trim();
    if (!val || val === user?.username) { setStatus(null); return; }
    if (!USERNAME_RE.test(val)) { setStatus('invalid'); return; }

    setStatus('checking');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkUsername({ username: val });
        setStatus(res.available ? 'available' : 'taken');
      } catch {
        setStatus(null);
      }
    }, 500);
  }, [username, user?.username]);

  const helperText = () => {
    if (status === 'available') return 'Username is available ✓';
    if (status === 'taken')     return 'Already taken';
    if (status === 'invalid')   return 'Letters, numbers, underscore only · 3–20 chars';
    return `Current: @${user?.username || ''}`;
  };

  const helperColor = () => {
    if (status === 'available') return 'text-success';
    if (status === 'taken' || status === 'invalid') return 'text-error';
    return 'text-base-content/40';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!USERNAME_RE.test(username)) return setError('Invalid username format');
    if (status === 'taken') return setError('Username is already taken');

    setLoading(true);
    try {
      const res = await changeUsername({ username });
      setUser(res.data);
      setSuccess('Username updated successfully');
      setUsername('');
      setStatus(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-bold text-base mb-4">Change Username</h2>

      {error   && <div role="alert" className="alert alert-error text-sm py-2 mb-4"><AlertCircle size={16} /><span>{error}</span></div>}
      {success && <div role="alert" className="alert alert-success text-sm py-2 mb-4"><CheckCircle size={16} /><span>{success}</span></div>}

      <div className="flex flex-col gap-2 max-w-sm">
        <div className="flex flex-col gap-1">
          <div className="relative">
            <input
              className={`input w-full pr-10 ${status === 'taken' || status === 'invalid' ? 'input-error' : status === 'available' ? 'input-success' : ''}`}
              placeholder="New username"
              required
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {status === 'checking'  && <Loader2 size={16} className="text-base-content/40 animate-spin" />}
              {status === 'available' && <CheckCircle size={16} className="text-success" />}
              {(status === 'taken' || status === 'invalid') && <AlertCircle size={16} className="text-error" />}
            </span>
          </div>
          <p className={`text-xs ${helperColor()}`}>{helperText()}</p>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-sm self-start gap-2"
          disabled={loading || status === 'checking' || status === 'taken' || status === 'invalid' || !username.trim()}
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
          {loading ? 'Saving…' : 'Save Username'}
        </button>
      </div>
    </form>
  );
}

// ── Change Password ────────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow]       = useState({ current: false, newPw: false, confirm: false });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const toggleShow   = (field) => setShow((s) => ({ ...s, [field]: !s[field] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword.length < 8) return setError('New password must be at least 8 characters');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match');

    setLoading(true);
    try {
      await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess('Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const PasswordField = ({ label, name, showKey, hint }) => (
    <div className="flex flex-col gap-1">
      <label className="block"><span className="text-sm font-medium text-sm">{label}</span></label>
      <div className="relative max-w-sm">
        <input
          className="input w-full pr-10"
          type={show[showKey] ? 'text' : 'password'}
          name={name}
          placeholder="••••••••"
          required
          value={form[name]}
          onChange={handleChange}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
          onClick={() => toggleShow(showKey)}
          tabIndex={-1}
        >
          {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint && <p className="text-xs text-base-content/40">{hint}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <h2 className="font-bold text-base mb-1">Change Password</h2>

      {error   && <div role="alert" className="alert alert-error text-sm py-2"><AlertCircle size={16} /><span>{error}</span></div>}
      {success && <div role="alert" className="alert alert-success text-sm py-2"><CheckCircle size={16} /><span>{success}</span></div>}

      <PasswordField label="Current password"     name="currentPassword" showKey="current" />
      <PasswordField label="New password"         name="newPassword"     showKey="newPw"   hint="Minimum 8 characters" />
      <PasswordField label="Confirm new password" name="confirmPassword" showKey="confirm" />

      <button type="submit" className="btn btn-primary btn-sm self-start gap-2 mt-1" disabled={loading}>
        {loading ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle size={14} />}
        {loading ? 'Saving…' : 'Change Password'}
      </button>
    </form>
  );
}

// ── Delete Account ─────────────────────────────────────────────────────────

function DeleteAccountSection() {
  const { signout }             = useAuth();
  const navigate                = useNavigate();
  const [open, setOpen]         = useState(false);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleDelete = async () => {
    setError('');
    setLoading(true);
    try {
      await deleteAccount({ password });
      await signout();
      navigate('/signin');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleClose = () => { setOpen(false); setPassword(''); setError(''); setShowPw(false); };

  return (
    <>
      <div>
        <h2 className="font-bold text-base mb-1 text-error">Danger Zone</h2>
        <p className="text-sm text-base-content/60 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button className="btn btn-error btn-outline btn-sm gap-2" onClick={() => setOpen(true)}>
          <Trash2 size={14} /> Delete Account
        </button>
      </div>

      {open && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-error/10 rounded-full">
                <Trash2 size={18} className="text-error" />
              </div>
              <h3 className="font-bold text-lg">Delete Account</h3>
            </div>
            <p className="text-sm text-base-content/60 mb-5">
              This will permanently remove your account, profile, and all your data.
              Enter your password to confirm.
            </p>

            {error && (
              <div role="alert" className="alert alert-error text-sm py-2 mb-4">
                <AlertCircle size={16} /><span>{error}</span>
              </div>
            )}

            <div className="relative">
              <input
                className="input w-full pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="Your password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                onClick={() => setShowPw((v) => !v)}
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={handleClose} disabled={loading}>Cancel</button>
              <button
                className="btn btn-error gap-2"
                onClick={handleDelete}
                disabled={loading || !password}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : <Trash2 size={14} />}
                {loading ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={handleClose} />
        </dialog>
      )}
    </>
  );
}

// ── Profile Page ───────────────────────────────────────────────────────────

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto page-bg max-w-2xl px-4 py-16 text-center">
        <p className="text-base-content/50">Please sign in to view your profile.</p>
      </div>
    );
  }

  const initials = user.displayName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const Section = ({ children, danger = false }) => (
    <div className={`bg-base-100 border rounded-2xl p-6 shadow-sm ${danger ? 'border-error/30' : 'border-base-200'}`}>
      {children}
    </div>
  );

  return (
    <div className="container mx-auto page-bg max-w-2xl px-4 py-8">

      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-primary/10 rounded-xl">
          <UserCog size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Account</h1>
          <p className="text-sm text-base-content/50">
            {user.displayName} · @{user.username}
          </p>
        </div>
        {/* Current user avatar */}
        {user.avatarUrl ? (
          <div className="avatar ml-auto">
            <div className="w-11 rounded-full ring-2 ring-primary/30">
              <img src={user.avatarUrl} alt={initials} />
            </div>
          </div>
        ) : (
          <div className="avatar placeholder ml-auto">
            <div className="w-11 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-content text-sm font-bold">
              <span>{initials}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Section><AvatarSection /></Section>
        <Section><ChangeDisplayNameSection /></Section>
        <Section><ChangeUsernameSection /></Section>
        <Section><ChangePasswordSection /></Section>
        <Section danger><DeleteAccountSection /></Section>
      </div>
    </div>
  );
}
