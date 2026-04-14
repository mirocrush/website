import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Camera, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  changePassword, changeUsername, changeDisplayName, deleteAccount,
  checkUsername, uploadAvatar, deleteAvatar,
} from '../api/authApi';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// ── Avatar Section ─────────────────────────────────────────────────────────

function AvatarSection() {
  const { user, setUser } = useAuth();
  const fileRef           = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [error, setError]         = useState('');

  const initials = user?.displayName
    ? user.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await uploadAvatar(fd);
      setUser(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

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
    <div>
      <h2 className="text-lg font-bold mb-1">Profile Picture</h2>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-5 mb-2">
        {user?.avatarUrl ? (
          <div className="avatar">
            <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
              <img src={user.avatarUrl} alt="avatar" />
            </div>
          </div>
        ) : (
          <div className="avatar placeholder">
            <div className="w-20 rounded-full bg-secondary text-secondary-content ring ring-primary ring-offset-base-100 ring-offset-2">
              <span className="text-2xl font-bold">{initials}</span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="btn btn-outline btn-sm cursor-pointer">
            {uploading
              ? <span className="loading loading-spinner loading-sm" />
              : <Camera size={15} />}
            {uploading ? 'Uploading…' : 'Upload Photo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading || deleting}
            />
          </label>

          {user?.avatarUrl && (
            <button
              className="btn btn-outline btn-error btn-sm"
              onClick={handleDelete}
              disabled={uploading || deleting}
            >
              {deleting
                ? <span className="loading loading-spinner loading-sm" />
                : <Trash2 size={15} />}
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-base-content/50">Max 5 MB · JPG, PNG, GIF, or WebP</p>
    </div>
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
    if (!trimmed) return setError('Display name cannot be empty');
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
      <h2 className="text-lg font-bold mb-1">Display Name</h2>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="alert" className="alert alert-success text-sm py-2 mb-3">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      <div className="mb-2">
        <input
          className="input input-bordered w-full max-w-sm"
          placeholder="New display name"
          required
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <p className="text-xs text-base-content/50 mt-1">Current: {user?.displayName || ''}</p>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={loading || !displayName.trim()}
      >
        {loading ? <span className="loading loading-spinner loading-sm" /> : null}
        {loading ? 'Saving…' : 'Save Display Name'}
      </button>
    </form>
  );
}

// ── Change Username ────────────────────────────────────────────────────────

function ChangeUsernameSection() {
  const { user, setUser }       = useAuth();
  const [username, setUsername] = useState('');
  const [status, setStatus]     = useState(null); // null | 'checking' | 'available' | 'taken' | 'invalid'
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
    if (status === 'available') return 'Available ✓';
    if (status === 'taken')     return 'Already taken';
    if (status === 'invalid')   return 'Letters, numbers, underscore only (3–20 chars)';
    return `Current: @${user?.username || ''}`;
  };

  const helperColor = () => {
    if (status === 'available') return 'text-success';
    if (status === 'taken' || status === 'invalid') return 'text-error';
    return 'text-base-content/50';
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
      <h2 className="text-lg font-bold mb-1">Change Username</h2>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="alert" className="alert alert-success text-sm py-2 mb-3">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      <div className="mb-2">
        <div className="relative max-w-sm">
          <input
            className={`input input-bordered w-full pr-10 ${status === 'taken' || status === 'invalid' ? 'input-error' : ''}`}
            placeholder="New username"
            required
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === 'checking' && <span className="loading loading-spinner loading-xs" />}
            {status === 'available' && <CheckCircle size={16} className="text-success" />}
            {(status === 'taken' || status === 'invalid') && <AlertCircle size={16} className="text-error" />}
          </span>
        </div>
        <p className={`text-xs mt-1 ${helperColor()}`}>{helperText()}</p>
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={loading || status === 'checking' || status === 'taken' || status === 'invalid' || !username.trim()}
      >
        {loading ? <span className="loading loading-spinner loading-sm" /> : null}
        {loading ? 'Saving…' : 'Save Username'}
      </button>
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

  const PasswordField = ({ label, name, showKey, placeholder }) => (
    <div className="relative mb-3">
      <input
        className="input input-bordered w-full max-w-sm pr-10"
        type={show[showKey] ? 'text' : 'password'}
        name={name}
        placeholder={label}
        required
        value={form[name]}
        onChange={handleChange}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
        onClick={() => toggleShow(showKey)}
        tabIndex={-1}
      >
        {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
      {placeholder && <p className="text-xs text-base-content/50 mt-1">{placeholder}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-lg font-bold mb-1">Change Password</h2>

      {error && (
        <div role="alert" className="alert alert-error text-sm py-2 mb-3">
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div role="alert" className="alert alert-success text-sm py-2 mb-3">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      <PasswordField label="Current password"     name="currentPassword" showKey="current" />
      <PasswordField label="New password"         name="newPassword"     showKey="newPw"   placeholder="Minimum 8 characters" />
      <PasswordField label="Confirm new password" name="confirmPassword" showKey="confirm" />

      <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
        {loading ? <span className="loading loading-spinner loading-sm" /> : null}
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
      <h2 className="text-lg font-bold mb-1">Delete Account</h2>
      <p className="text-sm text-base-content/60 mb-4">
        Permanently delete your account. This action cannot be undone.
      </p>
      <button className="btn btn-error btn-sm" onClick={() => setOpen(true)}>
        <Trash2 size={15} /> Delete Account
      </button>

      {open && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2">Confirm Account Deletion</h3>
            <p className="text-sm text-base-content/60 mb-4">
              Enter your password to permanently delete your account.
            </p>

            {error && (
              <div role="alert" className="alert alert-error text-sm py-2 mb-3">
                <AlertCircle size={16} /><span>{error}</span>
              </div>
            )}

            <div className="relative">
              <input
                className="input input-bordered w-full pr-10"
                type={showPw ? 'text' : 'password'}
                placeholder="Password"
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
                className="btn btn-error"
                onClick={handleDelete}
                disabled={loading || !password}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : null}
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

// ── Profile Page ──────────────────────────────────────────────────────────

export default function Profile() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 text-center">
        <p>Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Profile</h1>
      <p className="text-sm text-base-content/60 mb-4">
        {user.displayName} · @{user.username} · {user.email}
      </p>

      <div role="tablist" className="tabs tabs-bordered mb-6">
        <button role="tab" className="tab tab-active">My Account</button>
      </div>

      <AvatarSection />
      <div className="divider"></div>
      <ChangeDisplayNameSection />
      <div className="divider"></div>
      <ChangeUsernameSection />
      <div className="divider"></div>
      <ChangePasswordSection />
      <div className="divider"></div>
      <DeleteAccountSection />
    </div>
  );
}
