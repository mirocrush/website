import { useState } from 'react';
import { Rocket, Search, MapPin, Briefcase, Star, Users, Filter, ChevronRight, Globe } from 'lucide-react';

const MOCK_TALENTS = [
  { name: 'Ana Martínez',   role: 'Full-Stack Engineer',    location: 'São Paulo, BR',  skills: ['React','Node.js','PostgreSQL'], rate: '$65/hr', stars: 4.9, available: true  },
  { name: 'Carlos Rivera',  role: 'Backend Engineer',       location: 'Buenos Aires, AR', skills: ['Go','Kubernetes','AWS'],      rate: '$58/hr', stars: 4.8, available: true  },
  { name: 'Juliana Costa',  role: 'Frontend Engineer',      location: 'Bogotá, CO',     skills: ['Vue','TypeScript','Figma'],    rate: '$52/hr', stars: 4.9, available: false },
  { name: 'Diego López',    role: 'DevOps Engineer',        location: 'Mexico City, MX', skills: ['Terraform','Docker','CI/CD'], rate: '$60/hr', stars: 4.7, available: true  },
  { name: 'Sofia Herrera',  role: 'iOS Developer',          location: 'Santiago, CL',   skills: ['Swift','SwiftUI','Xcode'],    rate: '$55/hr', stars: 5.0, available: true  },
  { name: 'Rafael Souza',   role: 'Data Engineer',          location: 'Medellín, CO',   skills: ['Python','Spark','dbt'],       rate: '$62/hr', stars: 4.8, available: false },
];

const ROLES = ['All Roles', 'Full-Stack', 'Frontend', 'Backend', 'DevOps', 'Mobile', 'Data'];

const STATS = [
  { icon: <Users size={20} />,    label: 'Vetted Developers', value: '12,400+' },
  { icon: <Briefcase size={20} />, label: 'Companies Hiring',  value: '850+'   },
  { icon: <Globe size={20} />,    label: 'Countries',          value: '18'     },
  { icon: <Star size={20} />,     label: 'Avg Rating',         value: '4.87'   },
];

function Avatar({ name }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 13) % 60 + 130; // green range
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-extrabold text-white shrink-0 select-none"
      style={{ background: `linear-gradient(135deg, oklch(35% 0.14 ${hue}), oklch(58% 0.18 ${hue + 15}))` }}
    >
      {initials}
    </div>
  );
}

export default function Revelo() {
  const [search,  setSearch]  = useState('');
  const [role,    setRole]    = useState('All Roles');
  const [onlyAvail, setOnlyAvail] = useState(false);

  const filtered = MOCK_TALENTS.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.role.toLowerCase().includes(q) || t.skills.some(s => s.toLowerCase().includes(q));
    const matchRole   = role === 'All Roles' || t.role.toLowerCase().includes(role.toLowerCase());
    const matchAvail  = !onlyAvail || t.available;
    return matchSearch && matchRole && matchAvail;
  });

  return (
    <div className="min-h-screen page-bg">
      <div className="container mx-auto max-w-screen-lg px-4 py-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="p-3 rounded-2xl"
              style={{ background: 'rgba(74,222,128,0.15)', boxShadow: '0 0 20px rgba(74,222,128,0.2)' }}
            >
              <Rocket size={24} style={{ color: '#4ade80' }} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: '#bbf7d0' }}>
                Revelo
              </h1>
              <p className="text-sm" style={{ color: 'rgba(134,239,172,0.55)' }}>
                Discover top Latin American developer talent
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {STATS.map(({ icon, label, value }) => (
              <div
                key={label}
                className="glass-card rounded-2xl p-4 flex items-center gap-3 border"
              >
                <span style={{ color: '#4ade80', opacity: 0.8 }}>{icon}</span>
                <div>
                  <p className="font-extrabold text-lg leading-none" style={{ color: '#bbf7d0' }}>{value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.5)' }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div
          className="glass-card rounded-2xl p-4 mb-6 border flex flex-col sm:flex-row gap-3 items-start sm:items-center"
        >
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(74,222,128,0.5)' }} />
            <input
              className="input input-sm w-full pl-9"
              placeholder="Search by name, role or skill…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: 'rgba(3,18,9,0.6)', borderColor: 'rgba(74,222,128,0.2)', color: '#bbf7d0' }}
            />
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} style={{ color: 'rgba(74,222,128,0.5)' }} />
            {ROLES.map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="btn btn-xs rounded-full cursor-pointer transition-all"
                style={role === r ? {
                  background: 'rgba(74,222,128,0.25)',
                  border: '1px solid rgba(74,222,128,0.6)',
                  color: '#bbf7d0',
                } : {
                  background: 'rgba(74,222,128,0.06)',
                  border: '1px solid rgba(74,222,128,0.15)',
                  color: 'rgba(187,247,208,0.55)',
                }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Available toggle */}
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={onlyAvail}
              onChange={e => setOnlyAvail(e.target.checked)}
              style={{ '--tglbg': 'rgba(74,222,128,0.2)' }}
            />
            <span className="text-xs whitespace-nowrap" style={{ color: 'rgba(187,247,208,0.65)' }}>
              Available only
            </span>
          </label>
        </div>

        {/* ── Talent grid ── */}
        {filtered.length === 0 ? (
          <div className="glass-card rounded-2xl border p-16 flex flex-col items-center gap-4 text-center">
            <div className="p-5 rounded-full" style={{ background: 'rgba(74,222,128,0.08)' }}>
              <Users size={32} style={{ color: 'rgba(74,222,128,0.3)' }} />
            </div>
            <p className="font-semibold" style={{ color: 'rgba(187,247,208,0.5)' }}>No developers match your filters</p>
            <p className="text-sm" style={{ color: 'rgba(134,239,172,0.35)' }}>Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((dev) => (
              <div
                key={dev.name}
                className="glass-card rounded-2xl border p-5 flex flex-col gap-4 cursor-pointer group transition-all duration-200"
                style={{ borderColor: 'rgba(74,222,128,0.18)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)';
                  e.currentTarget.style.boxShadow = '0 0 24px rgba(74,222,128,0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(74,222,128,0.18)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {/* Top row */}
                <div className="flex items-start gap-3">
                  <Avatar name={dev.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm truncate" style={{ color: '#f0fdf4' }}>{dev.name}</p>
                      {dev.available && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                          style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
                        >
                          Available
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(134,239,172,0.6)' }}>{dev.role}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={11} style={{ color: 'rgba(134,239,172,0.4)' }} />
                      <p className="text-xs" style={{ color: 'rgba(134,239,172,0.4)' }}>{dev.location}</p>
                    </div>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5">
                  {dev.skills.map(s => (
                    <span
                      key={s}
                      className="text-xs px-2 py-0.5 rounded-lg"
                      style={{ background: 'rgba(74,222,128,0.09)', color: 'rgba(187,247,208,0.7)', border: '1px solid rgba(74,222,128,0.15)' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-1">
                    <Star size={13} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
                    <span className="text-xs font-bold" style={{ color: '#bbf7d0' }}>{dev.stars}</span>
                  </div>
                  <span className="text-sm font-extrabold" style={{ color: '#4ade80' }}>{dev.rate}</span>
                  <button
                    className="btn btn-xs gap-1 cursor-pointer"
                    style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#bbf7d0' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.28)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,222,128,0.15)'; }}
                  >
                    View <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
