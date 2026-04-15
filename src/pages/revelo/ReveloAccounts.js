import { useEffect, useState } from 'react';
import {
  listAccounts, createAccount, updateAccount, deleteAccount,
} from '../../api/reveloApi';
import {
  Plus, Edit2, Trash2, X, Globe, Shield, Loader, AlertCircle,
} from 'lucide-react';

const EMPTY_FORM = {
  name: '', nationality: '', createdDate: '',
  proxyHost: '', proxyPort: '', proxyUsername: '', proxyPassword: '', proxyProtocol: 'http',
};

function AccountModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: form.name,
        nationality: form.nationality,
        createdDate: form.createdDate || undefined,
        proxyDetail: {
          host: form.proxyHost,
          port: form.proxyPort,
          username: form.proxyUsername,
          password: form.proxyPassword,
          protocol: form.proxyProtocol,
        },
      };
      if (initial?.id) payload.id = initial.id;
      await onSave(payload);
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'rgba(3,18,9,0.6)',
    borderColor: 'rgba(74,222,128,0.2)',
    color: '#bbf7d0',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="glass-card rounded-2xl border w-full max-w-lg p-6 mx-4"
        style={{ borderColor: 'rgba(74,222,128,0.2)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: '#bbf7d0' }}>
            {initial?.id ? 'Edit Account' : 'New Account'}
          </h2>
          <button onClick={onClose} style={{ color: 'rgba(134,239,172,0.5)' }}
            className="hover:text-green-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {err && (
          <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            <AlertCircle size={14} /> {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Name *</label>
              <input className="input input-sm w-full" style={inputStyle}
                value={form.name} onChange={e => set('name', e.target.value)} placeholder="Account name" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Nationality</label>
              <input className="input input-sm w-full" style={inputStyle}
                value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. US" />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.6)' }}>Created Date</label>
            <input type="date" className="input input-sm w-full" style={inputStyle}
              value={form.createdDate} onChange={e => set('createdDate', e.target.value)} />
          </div>

          <div className="pt-2" style={{ borderTop: '1px solid rgba(74,222,128,0.1)' }}>
            <div className="text-xs font-medium mb-2 flex items-center gap-1.5"
              style={{ color: 'rgba(134,239,172,0.6)' }}>
              <Shield size={12} /> Proxy Details
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>Host</label>
                <input className="input input-sm w-full" style={inputStyle}
                  value={form.proxyHost} onChange={e => set('proxyHost', e.target.value)} placeholder="proxy.host.com" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>Port</label>
                <input className="input input-sm w-full" style={inputStyle}
                  value={form.proxyPort} onChange={e => set('proxyPort', e.target.value)} placeholder="8080" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>Username</label>
                <input className="input input-sm w-full" style={inputStyle}
                  value={form.proxyUsername} onChange={e => set('proxyUsername', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>Password</label>
                <input type="password" className="input input-sm w-full" style={inputStyle}
                  value={form.proxyPassword} onChange={e => set('proxyPassword', e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs mb-1" style={{ color: 'rgba(134,239,172,0.5)' }}>Protocol</label>
              <select className="input input-sm w-full" style={inputStyle}
                value={form.proxyProtocol} onChange={e => set('proxyProtocol', e.target.value)}>
                <option value="http">HTTP</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(74,222,128,0.15)', color: 'rgba(134,239,172,0.6)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}>
              {saving ? <Loader size={14} className="animate-spin" /> : null}
              {saving ? 'Saving…' : (initial?.id ? 'Save Changes' : 'Create Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReveloAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [modal, setModal]   = useState(null); // null | 'new' | account object
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await listAccounts();
      if (d.success) setAccounts(d.accounts);
      else setError(d.message);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (payload) => {
    if (payload.id) {
      const d = await updateAccount(payload);
      if (d.success) setAccounts(a => a.map(x => x.id === payload.id ? d.account : x));
    } else {
      const d = await createAccount(payload);
      if (d.success) setAccounts(a => [d.account, ...a]);
    }
  };

  const handleDelete = async (id) => {
    await deleteAccount(id);
    setAccounts(a => a.filter(x => x.id !== id));
    setConfirmDelete(null);
  };

  const toForm = (acc) => ({
    id: acc.id,
    name: acc.name,
    nationality: acc.nationality || '',
    createdDate: acc.createdDate ? acc.createdDate.slice(0, 10) : '',
    proxyHost: acc.proxyDetail?.host || '',
    proxyPort: acc.proxyDetail?.port || '',
    proxyUsername: acc.proxyDetail?.username || '',
    proxyPassword: acc.proxyDetail?.password || '',
    proxyProtocol: acc.proxyDetail?.protocol || 'http',
  });

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#bbf7d0' }}>Accounts</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>
            Manage your Revelo accounts
          </p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}
        >
          <Plus size={15} /> New Account
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm mb-4 p-3 rounded-xl"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader size={28} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="glass-card rounded-2xl border p-12 text-center"
          style={{ borderColor: 'rgba(74,222,128,0.15)' }}>
          <Globe size={40} className="mx-auto mb-3" style={{ color: 'rgba(74,222,128,0.3)' }} />
          <div className="text-sm" style={{ color: 'rgba(134,239,172,0.5)' }}>
            No accounts yet. Create your first account to get started.
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(74,222,128,0.2)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'rgba(74,222,128,0.05)', borderBottom: '1px solid rgba(74,222,128,0.1)' }}>
                {['Name', 'Nationality', 'Created', 'Proxy', 'Jobs', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-medium"
                    style={{ color: 'rgba(134,239,172,0.5)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(acc => (
                <tr key={acc.id} style={{ borderBottom: '1px solid rgba(74,222,128,0.05)' }}
                  className="hover:bg-green-950/10 transition-colors">
                  <td className="py-3 px-4 font-medium" style={{ color: '#bbf7d0' }}>{acc.name}</td>
                  <td className="py-3 px-4" style={{ color: 'rgba(134,239,172,0.7)' }}>
                    {acc.nationality || '—'}
                  </td>
                  <td className="py-3 px-4" style={{ color: 'rgba(134,239,172,0.6)' }}>
                    {acc.createdDate ? new Date(acc.createdDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4" style={{ color: 'rgba(134,239,172,0.6)' }}>
                    {acc.proxyDetail?.host
                      ? `${acc.proxyDetail.host}:${acc.proxyDetail.port}`
                      : <span style={{ color: 'rgba(134,239,172,0.3)' }}>None</span>}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                      {acc.attachedJobs?.length || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModal(toForm(acc))}
                        className="p-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
                        title="Edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      {confirmDelete === acc.id ? (
                        <button
                          onClick={() => handleDelete(acc.id)}
                          className="px-2 py-1 rounded-lg text-xs font-medium transition-all"
                          style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#fca5a5' }}
                        >
                          Confirm?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(acc.id)}
                          className="p-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(modal === 'new' || (modal && typeof modal === 'object')) && (
        <AccountModal
          initial={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
