import React from 'react';
import {
  Box, Typography, Avatar, Chip, Stack, Divider,
  IconButton, Tooltip, Link,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Language as WebIcon,
  GitHub as GitHubIcon,
  LinkedIn as LinkedInIcon,
  Twitter as TwitterIcon,
  YouTube as YouTubeIcon,
  Instagram as InstagramIcon,
  Link as LinkIcon,
  Circle as DotIcon,
} from '@mui/icons-material';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_COLOR = {
  beginner:     '#9e9e9e',
  intermediate: '#42a5f5',
  advanced:     '#26a69a',
  expert:       '#7e57c2',
};

const CATEGORY_LABEL = {
  frontend: 'Frontend', backend: 'Backend',
  devops: 'DevOps', design: 'Design', other: 'Other',
};

function SocialIcon({ platform }) {
  switch (platform) {
    case 'github':    return <GitHubIcon fontSize="small" />;
    case 'linkedin':  return <LinkedInIcon fontSize="small" />;
    case 'twitter':   return <TwitterIcon fontSize="small" />;
    case 'youtube':   return <YouTubeIcon fontSize="small" />;
    case 'instagram': return <InstagramIcon fontSize="small" />;
    default:          return <LinkIcon fontSize="small" />;
  }
}

function formatDate(yyyyMM) {
  if (!yyyyMM) return 'Present';
  const [y, m] = yyyyMM.split('-');
  const date = new Date(Number(y), Number(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const SectionHeading = ({ children }) => (
  <Typography variant="overline" fontWeight={700} color="text.disabled"
    sx={{ letterSpacing: 2, mb: 3, display: 'block' }}>
    {children}
  </Typography>
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
    <Stack spacing={2.5}>
      {Object.entries(grouped).map(([cat, items]) => (
        <Box key={cat}>
          <Typography variant="caption" color="text.disabled" fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>
            {CATEGORY_LABEL[cat]}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {items.map((s) => (
              <Chip
                key={s.id || s._id}
                label={s.name}
                size="small"
                sx={{
                  borderRadius: 1,
                  bgcolor: `${LEVEL_COLOR[s.level]}18`,
                  color: LEVEL_COLOR[s.level],
                  fontWeight: 600,
                  border: `1px solid ${LEVEL_COLOR[s.level]}40`,
                }}
              />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function ExperienceSection({ experience }) {
  if (!experience?.length) return null;
  return (
    <Stack spacing={3}>
      {experience.map((exp) => (
        <Box key={exp.id || exp._id} sx={{ display: 'flex', gap: 2 }}>
          {/* Timeline dot */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
            <Box sx={{ flex: 1, width: 1, bgcolor: 'divider', mt: 0.5 }} />
          </Box>
          <Box sx={{ pb: 3, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{exp.role}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 0.3 }}>
              <Typography variant="body2" fontWeight={600} color="text.secondary">{exp.company}</Typography>
              {exp.type && (
                <Chip label={exp.type} size="small" sx={{ fontSize: 10, height: 18 }} />
              )}
              {exp.remote && (
                <Chip label="Remote" size="small" color="info" sx={{ fontSize: 10, height: 18 }} />
              )}
            </Box>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
              {formatDate(exp.startDate)} – {formatDate(exp.endDate)}
              {exp.location && ` · ${exp.location}`}
            </Typography>
            {exp.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {exp.description}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function ProjectsSection({ projects }) {
  if (!projects?.length) return null;
  const sorted = [...projects].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
      {sorted.map((p) => (
        <Box key={p.id || p._id} sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 2,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {p.imageUrl && (
            <Box component="img" src={p.imageUrl} alt={p.title}
              sx={{ width: '100%', height: 160, objectFit: 'cover' }} />
          )}
          <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ flexGrow: 1 }}>{p.title}</Typography>
              {p.featured && (
                <Chip label="Featured" size="small" color="primary" sx={{ fontSize: 10, height: 18 }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{
              flex: 1, display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 1.5,
            }}>
              {p.description}
            </Typography>
            {p.tech?.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                {p.tech.map((t) => (
                  <Chip key={t} label={t} size="small" sx={{ fontSize: 10, height: 18, borderRadius: 0.5 }} />
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {p.demoUrl && (
                <Link href={p.demoUrl} target="_blank" rel="noopener" variant="caption" fontWeight={700}>
                  Live Demo →
                </Link>
              )}
              {p.repoUrl && (
                <Link href={p.repoUrl} target="_blank" rel="noopener" variant="caption" color="text.secondary">
                  Source
                </Link>
              )}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function EducationSection({ education }) {
  if (!education?.length) return null;
  return (
    <Stack spacing={2}>
      {education.map((ed) => (
        <Box key={ed.id || ed._id}>
          <Typography variant="subtitle2" fontWeight={700}>{ed.degree}</Typography>
          <Typography variant="body2" color="text.secondary">{ed.institution}</Typography>
          <Typography variant="caption" color="text.disabled">
            {ed.startYear} – {ed.endYear || 'Present'}
          </Typography>
          {ed.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{ed.description}</Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function CertificationsSection({ certifications }) {
  if (!certifications?.length) return null;
  return (
    <Stack spacing={2}>
      {certifications.map((c) => (
        <Box key={c.id || c._id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <DotIcon sx={{ fontSize: 8, mt: 0.8, color: 'primary.main', flexShrink: 0 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>{c.title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {c.issuer}{c.date ? ` · ${formatDate(c.date)}` : ''}
            </Typography>
            {c.credentialUrl && (
              <Link href={c.credentialUrl} target="_blank" rel="noopener" variant="caption">
                View credential →
              </Link>
            )}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

// ── Main theme component ──────────────────────────────────────────────────────

const SECTION_LABEL = {
  skills: 'Skills', experience: 'Experience', projects: 'Projects',
  education: 'Education', certifications: 'Certifications',
};

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
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', fontFamily: 'Roboto, sans-serif' }}>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#fafafa', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 3, sm: 6 }, py: { xs: 6, sm: 8 } }}>
          <Box sx={{ display: 'flex', gap: { xs: 3, sm: 5 }, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {avatarUrl && (
              <Avatar src={avatarUrl} sx={{ width: { xs: 80, sm: 110 }, height: { xs: 80, sm: 110 } }} />
            )}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              {availableForWork && (
                <Chip label="Open to opportunities" size="small" color="success"
                  sx={{ mb: 1.5, fontWeight: 600 }} />
              )}
              <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1.1, fontSize: { xs: '1.8rem', sm: '2.5rem' } }}>
                {name}
              </Typography>
              <Typography variant="h6" color="primary.main" fontWeight={500} sx={{ mt: 0.5 }}>
                {title}
              </Typography>
              {tagline && (
                <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                  {tagline}
                </Typography>
              )}
              {(location || contact?.email) && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5 }}>
                  {location && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <LocationIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.disabled">{location}</Typography>
                    </Box>
                  )}
                  {contact?.email && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Link href={`mailto:${contact.email}`} variant="caption" color="text.disabled">
                        {contact.email}
                      </Link>
                    </Box>
                  )}
                  {contact?.website && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <WebIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                      <Link href={contact.website} target="_blank" rel="noopener" variant="caption" color="text.disabled">
                        {contact.website.replace(/^https?:\/\//, '')}
                      </Link>
                    </Box>
                  )}
                </Box>
              )}
              {socials.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5 }}>
                  {socials.map((s) => (
                    <Tooltip key={s.id || s._id} title={s.label || s.platform} arrow>
                      <IconButton size="small" href={s.url} target="_blank" rel="noopener"
                        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                        <SocialIcon platform={s.platform} />
                      </IconButton>
                    </Tooltip>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {bio && (
            <Typography variant="body1" color="text.secondary"
              sx={{ mt: 3, lineHeight: 1.8, maxWidth: 640, whiteSpace: 'pre-wrap' }}>
              {bio}
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Content sections ──────────────────────────────────────────────── */}
      <Box sx={{ maxWidth: 860, mx: 'auto', px: { xs: 3, sm: 6 }, py: 6 }}>
        <Stack spacing={6} divider={<Divider />}>
          {visibleSections.map((key) => (
            <Box key={key} id={key}>
              <SectionHeading>{SECTION_LABEL[key]}</SectionHeading>
              {sections[key]}
            </Box>
          ))}

          {/* Contact section — always at bottom if contact info exists */}
          {(contact?.phone || contact?.website || contact?.email) && (
            <Box>
              <SectionHeading>Contact</SectionHeading>
              <Stack spacing={1}>
                {contact.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    <Link href={`mailto:${contact.email}`}>{contact.email}</Link>
                  </Box>
                )}
                {contact.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    <Link href={`tel:${contact.phone}`}>{contact.phone}</Link>
                  </Box>
                )}
                {contact.website && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WebIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    <Link href={contact.website} target="_blank" rel="noopener">{contact.website}</Link>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <Box sx={{ py: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.disabled">
          Built on TalentCodeHub
        </Typography>
      </Box>
    </Box>
  );
}
