import {
  MapPin, Mail, Phone, Globe, Github, Linkedin, Twitter,
  Youtube, Instagram, Link as LinkIcon, Circle,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_STYLE = {
  beginner:     { bg: 'bg-[#9e9e9e]/10', text: 'text-[#9e9e9e]',     border: 'border-[#9e9e9e]/30' },
  intermediate: { bg: 'bg-[#42a5f5]/10', text: 'text-[#42a5f5]',     border: 'border-[#42a5f5]/30' },
  advanced:     { bg: 'bg-[#26a69a]/10', text: 'text-[#26a69a]',     border: 'border-[#26a69a]/30' },
  expert:       { bg: 'bg-[#7e57c2]/10', text: 'text-[#7e57c2]',     border: 'border-[#7e57c2]/30' },
};

const CATEGORY_LABEL = {
  frontend: 'Frontend', backend: 'Backend',
  devops: 'DevOps', design: 'Design', other: 'Other',
};

const SECTION_LABEL = {
  skills: 'Skills', experience: 'Experience', projects: 'Projects',
  education: 'Education', certifications: 'Certifications',
};

function SocialIcon({ platform }) {
  const props = { size: 16 };
  switch (platform) {
    case 'github':    return <Github {...props} />;
    case 'linkedin':  return <Linkedin {...props} />;
    case 'twitter':   return <Twitter {...props} />;
    case 'youtube':   return <Youtube {...props} />;
    case 'instagram': return <Instagram {...props} />;
    default:          return <LinkIcon {...props} />;
  }
}

function formatDate(yyyyMM) {
  if (!yyyyMM) return 'Present';
  const [y, m] = yyyyMM.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const SectionHeading = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 mb-6">
    {children}
  </p>
);

// ── Section components ────────────────────────────────────────────────────────

function SkillsSection({ skills }) {
  if (!skills?.length) return null;
  const grouped = skills.reduce((acc, s) => {
    const cat = s.category || 'other';
    (acc[cat] = acc[cat] || []).push(s);
    return acc;
  }, {});
  return (
    <div className="flex flex-col gap-5">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            {CATEGORY_LABEL[cat]}
          </p>
          <div className="flex flex-wrap gap-2">
            {items.map((s) => {
              const style = LEVEL_STYLE[s.level] || LEVEL_STYLE.beginner;
              return (
                <span
                  key={s.id || s._id}
                  className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
                >
                  {s.name}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExperienceSection({ experience }) {
  if (!experience?.length) return null;
  return (
    <div className="flex flex-col gap-0">
      {experience.map((exp, i) => (
        <div key={exp.id || exp._id} className="flex gap-4">
          {/* Timeline */}
          <div className="flex flex-col items-center pt-1 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            {i < experience.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            )}
          </div>
          {/* Content */}
          <div className="pb-6 flex-1 min-w-0">
            <p className="font-bold text-base text-gray-900">{exp.role}</p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-sm font-semibold text-gray-600">{exp.company}</span>
              {exp.type && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{exp.type}</span>
              )}
              {exp.remote && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 rounded text-blue-600">Remote</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDate(exp.startDate)} – {formatDate(exp.endDate)}
              {exp.location && ` · ${exp.location}`}
            </p>
            {exp.description && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed">{exp.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectsSection({ projects }) {
  if (!projects?.length) return null;
  const sorted = [...projects].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sorted.map((p) => (
        <div
          key={p.id || p._id}
          className="border border-gray-200 rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow duration-150"
        >
          {p.imageUrl && (
            <img src={p.imageUrl} alt={p.title} className="w-full h-40 object-cover" />
          )}
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-sm flex-1">{p.title}</p>
              {p.featured && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">Featured</span>
              )}
            </div>
            <p className="text-xs text-gray-500 flex-1 leading-relaxed line-clamp-3 mb-3">{p.description}</p>
            {p.tech?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {p.tech.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">{t}</span>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              {p.demoUrl && (
                <a href={p.demoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-bold text-blue-600 hover:underline">
                  Live Demo →
                </a>
              )}
              {p.repoUrl && (
                <a href={p.repoUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:underline">
                  Source
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EducationSection({ education }) {
  if (!education?.length) return null;
  return (
    <div className="flex flex-col gap-5">
      {education.map((ed) => (
        <div key={ed.id || ed._id}>
          <p className="font-bold text-sm">{ed.degree}</p>
          <p className="text-sm text-gray-600">{ed.institution}</p>
          <p className="text-xs text-gray-400">{ed.startYear} – {ed.endYear || 'Present'}</p>
          {ed.description && (
            <p className="text-sm text-gray-500 mt-1">{ed.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function CertificationsSection({ certifications }) {
  if (!certifications?.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {certifications.map((c) => (
        <div key={c.id || c._id} className="flex items-start gap-3">
          <Circle size={7} className="mt-1.5 text-blue-500 fill-blue-500 shrink-0" />
          <div>
            <p className="font-bold text-sm">{c.title}</p>
            <p className="text-sm text-gray-500">
              {c.issuer}{c.date ? ` · ${formatDate(c.date)}` : ''}
            </p>
            {c.credentialUrl && (
              <a href={c.credentialUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline">
                View credential →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main theme component ──────────────────────────────────────────────────────

export default function MinimalTheme({ portfolio }) {
  const {
    name, title, tagline, bio, avatarUrl, location, availableForWork,
    contact, socials = [], skills = [], experience = [], education = [],
    projects = [], certifications = [], settings = {},
  } = portfolio;

  const sectionsOrder   = settings.sectionsOrder   || ['skills','experience','projects','education','certifications'];
  const sectionsVisible = settings.sectionsVisible || {};

  const sections = {
    skills:         <SkillsSection skills={skills} />,
    experience:     <ExperienceSection experience={experience} />,
    projects:       <ProjectsSection projects={projects} />,
    education:      <EducationSection education={education} />,
    certifications: <CertificationsSection certifications={certifications} />,
  };

  const visibleSections = sectionsOrder.filter(
    (key) => sectionsVisible[key] !== false && (portfolio[key]?.length > 0)
  );

  return (
    <div className="bg-white min-h-screen font-sans">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 sm:px-12 py-10 sm:py-14">
          <div className="flex gap-6 sm:gap-10 items-start flex-wrap">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt={name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shrink-0 shadow"
              />
            )}
            <div className="flex-1 min-w-[180px]">
              {availableForWork && (
                <span className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-3">
                  Open to opportunities
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight text-gray-900">
                {name}
              </h1>
              {title && (
                <p className="text-lg font-medium text-blue-600 mt-1">{title}</p>
              )}
              {tagline && (
                <p className="text-base text-gray-500 italic mt-1">{tagline}</p>
              )}

              {/* Meta */}
              {(location || contact?.email || contact?.website) && (
                <div className="flex flex-wrap gap-4 mt-3">
                  {location && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin size={12} /> {location}
                    </span>
                  )}
                  {contact?.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                      <Mail size={12} /> {contact.email}
                    </a>
                  )}
                  {contact?.website && (
                    <a href={contact.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors">
                      <Globe size={12} /> {contact.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              )}

              {/* Socials */}
              {socials.length > 0 && (
                <div className="flex gap-1 mt-3">
                  {socials.map((s) => (
                    <a
                      key={s.id || s._id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.label || s.platform}
                      className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <SocialIcon platform={s.platform} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {bio && (
            <p className="mt-6 text-base text-gray-600 leading-relaxed max-w-2xl whitespace-pre-wrap">
              {bio}
            </p>
          )}
        </div>
      </div>

      {/* ── Content sections ─────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-10">
        <div className="flex flex-col gap-10 divide-y divide-gray-100">
          {visibleSections.map((key) => (
            <div key={key} id={key} className="pt-10 first:pt-0">
              <SectionHeading>{SECTION_LABEL[key]}</SectionHeading>
              {sections[key]}
            </div>
          ))}

          {/* Contact */}
          {(contact?.phone || contact?.website || contact?.email) && (
            <div className="pt-10">
              <SectionHeading>Contact</SectionHeading>
              <div className="flex flex-col gap-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    <Mail size={15} className="text-gray-400 shrink-0" /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    <Phone size={15} className="text-gray-400 shrink-0" /> {contact.phone}
                  </a>
                )}
                {contact.website && (
                  <a href={contact.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                    <Globe size={15} className="text-gray-400 shrink-0" /> {contact.website}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="py-6 text-center border-t border-gray-100">
        <p className="text-xs text-gray-300">Built on TalentCodeHub</p>
      </div>
    </div>
  );
}
