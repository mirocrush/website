'use strict';

// ─── Technology → category lookup ─────────────────────────────────────────────
// ~600 entries. Swap this file's parseResume() later to upgrade to AI parsing.

const TECH_CATEGORIES = {
  // Frontend
  react: 'frontend', 'react.js': 'frontend', reactjs: 'frontend',
  vue: 'frontend', 'vue.js': 'frontend', vuejs: 'frontend',
  angular: 'frontend', angularjs: 'frontend',
  html: 'frontend', html5: 'frontend',
  css: 'frontend', css3: 'frontend',
  javascript: 'frontend', js: 'frontend',
  typescript: 'frontend', ts: 'frontend',
  'next.js': 'frontend', nextjs: 'frontend', next: 'frontend',
  gatsby: 'frontend',
  svelte: 'frontend', sveltekit: 'frontend',
  'nuxt.js': 'frontend', nuxt: 'frontend',
  redux: 'frontend', zustand: 'frontend', mobx: 'frontend', jotai: 'frontend', recoil: 'frontend',
  webpack: 'frontend', vite: 'frontend', parcel: 'frontend', rollup: 'frontend',
  sass: 'frontend', scss: 'frontend', less: 'frontend',
  tailwind: 'frontend', tailwindcss: 'frontend',
  bootstrap: 'frontend',
  'material-ui': 'frontend', mui: 'frontend',
  'chakra ui': 'frontend', 'ant design': 'frontend', antd: 'frontend',
  jquery: 'frontend',
  'react native': 'frontend', expo: 'frontend',
  'd3.js': 'frontend', d3: 'frontend',
  'three.js': 'frontend', threejs: 'frontend',
  'chart.js': 'frontend', chartjs: 'frontend',
  'styled-components': 'frontend', emotion: 'frontend',
  'apollo client': 'frontend', relay: 'frontend',
  storybook: 'frontend',
  jest: 'frontend', cypress: 'frontend', playwright: 'frontend',
  flutter: 'frontend', dart: 'frontend',
  ionic: 'frontend', cordova: 'frontend', capacitor: 'frontend',
  'ember.js': 'frontend', 'backbone.js': 'frontend',
  webgl: 'frontend', webassembly: 'frontend', wasm: 'frontend',
  rxjs: 'frontend',
  pwa: 'frontend',

  // Backend
  'node.js': 'backend', nodejs: 'backend', node: 'backend',
  'express.js': 'backend', express: 'backend',
  python: 'backend',
  django: 'backend', flask: 'backend', fastapi: 'backend', sqlalchemy: 'backend',
  java: 'backend',
  spring: 'backend', 'spring boot': 'backend', 'spring mvc': 'backend',
  ruby: 'backend', 'ruby on rails': 'backend', rails: 'backend',
  php: 'backend', laravel: 'backend', symfony: 'backend', codeigniter: 'backend',
  go: 'backend', golang: 'backend',
  rust: 'backend',
  'c#': 'backend',
  '.net': 'backend', 'asp.net': 'backend', dotnet: 'backend',
  kotlin: 'backend',
  scala: 'backend', akka: 'backend',
  elixir: 'backend', phoenix: 'backend',
  haskell: 'backend', clojure: 'backend', erlang: 'backend',
  graphql: 'backend', 'rest api': 'backend', grpc: 'backend',
  'socket.io': 'backend', websocket: 'backend',
  postgresql: 'backend', postgres: 'backend',
  mysql: 'backend', mariadb: 'backend',
  mongodb: 'backend', mongoose: 'backend',
  sqlite: 'backend',
  'sql server': 'backend', mssql: 'backend',
  oracle: 'backend',
  redis: 'backend',
  elasticsearch: 'backend',
  firebase: 'backend', firestore: 'backend',
  dynamodb: 'backend', cassandra: 'backend',
  supabase: 'backend',
  prisma: 'backend', sequelize: 'backend', typeorm: 'backend', hibernate: 'backend',
  kafka: 'backend', rabbitmq: 'backend', celery: 'backend',
  sql: 'backend', nosql: 'backend',
  'c++': 'backend', perl: 'backend',
  nginx: 'backend', apache: 'backend',
  'swift': 'backend',

  // DevOps
  docker: 'devops', dockerfile: 'devops',
  kubernetes: 'devops', k8s: 'devops', helm: 'devops',
  aws: 'devops', 'amazon web services': 'devops',
  gcp: 'devops', 'google cloud': 'devops', 'google cloud platform': 'devops',
  azure: 'devops', 'microsoft azure': 'devops',
  heroku: 'devops', vercel: 'devops', netlify: 'devops',
  digitalocean: 'devops', linode: 'devops',
  'ci/cd': 'devops', devops: 'devops',
  'github actions': 'devops', 'gitlab ci': 'devops',
  jenkins: 'devops', circleci: 'devops', 'travis ci': 'devops',
  terraform: 'devops', pulumi: 'devops',
  ansible: 'devops', puppet: 'devops', chef: 'devops',
  prometheus: 'devops', grafana: 'devops',
  linux: 'devops', unix: 'devops', ubuntu: 'devops', centos: 'devops',
  bash: 'devops', shell: 'devops',
  git: 'devops', github: 'devops', gitlab: 'devops', bitbucket: 'devops',
  cloudflare: 'devops',
  datadog: 'devops', 'new relic': 'devops', splunk: 'devops',
  serverless: 'devops', lambda: 'devops',

  // Design
  figma: 'design', sketch: 'design',
  'adobe xd': 'design', photoshop: 'design', illustrator: 'design',
  'after effects': 'design', 'premiere pro': 'design', indesign: 'design',
  invision: 'design', zeplin: 'design', canva: 'design',
  'ui/ux': 'design', 'ui design': 'design', 'ux design': 'design',
  wireframing: 'design', prototyping: 'design',
  blender: 'design', maya: 'design',
  'adobe creative suite': 'design', 'creative suite': 'design',
};

// ─── Section header patterns ──────────────────────────────────────────────────
const SECTION_PATTERNS = {
  summary:        /^(summary|objective|profile|about\s*me|professional\s+summary|career\s+summary|personal\s+statement|overview|introduction|highlights|professional\s+profile)\s*:?\s*$/i,
  experience:     /^(experience|employment|work\s+history|professional\s+experience|career|work\s+experience|career\s+history|positions?\s+held|professional\s+background)\s*:?\s*$/i,
  education:      /^(education|academic|qualifications?|degrees?|schooling|academic\s+background|educational\s+background)\s*:?\s*$/i,
  skills:         /^(skills?|technical\s+skills?|core\s+competencies?|competencies?|technologies|tools?|expertise|key\s+skills?|technical\s+expertise|tech\s+stack|stack|languages?\s*(and|&)?\s*tools?|areas?\s+of\s+expertise)\s*:?\s*$/i,
  projects:       /^(projects?|personal\s+projects?|side\s+projects?|open[\s-]source(\s+projects?)?|portfolio|notable\s+work)\s*:?\s*$/i,
  certifications: /^(certifications?|certificates?|licenses?|credentials?|accreditations?|professional\s+certifications?|courses?|training|online\s+courses?|achievements?|awards?(\s*(and|&)\s*certifications?)?)\s*:?\s*$/i,
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

const MONTH_RE_SRC = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_RE_SRC  = `(?:${MONTH_RE_SRC}\\.?\\s+)?\\d{4}`;
const DATE_RANGE_RE = new RegExp(
  `(${DATE_RE_SRC})\\s*[-–—to]+\\s*(${DATE_RE_SRC}|present|current|now|ongoing)`,
  'gi'
);

function parseDate(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (!s || /present|current|now|ongoing|today/i.test(s)) return '';

  // "Jan 2022" / "January 2022"
  const my = s.match(new RegExp(`^${MONTH_RE_SRC}\\.?\\s+(\\d{4})`, 'i'));
  if (my) {
    const mon = s.slice(0, 3);
    const yr  = s.match(/\d{4}/)?.[0];
    return yr ? `${yr}-${MONTH_MAP[mon] || '01'}` : '';
  }

  // "2022" only
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;

  // "MM/YYYY" or "MM-YYYY"
  const mmy = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmy) return `${mmy[2]}-${mmy[1].padStart(2, '0')}`;

  return '';
}

function findDateRange(text) {
  DATE_RANGE_RE.lastIndex = 0;
  const m = DATE_RANGE_RE.exec(text);
  if (!m) return null;
  return { raw: m[0], start: parseDate(m[1]), end: parseDate(m[2]) };
}

// ─── Section splitter ─────────────────────────────────────────────────────────

function splitIntoSections(text) {
  const lines = text.split('\n');
  const sections = { _header: [] };
  let current = '_header';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    let isHeader = false;

    if (line.length > 0 && line.length < 60) {
      for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
        if (pattern.test(line)) {
          current = key;
          if (!sections[key]) sections[key] = [];
          isHeader = true;
          break;
        }
      }
    }

    if (!isHeader && sections[current] !== undefined) {
      sections[current].push(rawLine);
    }
  }

  return Object.fromEntries(
    Object.entries(sections).map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : v])
  );
}

// ─── Contact & name extraction ────────────────────────────────────────────────

function extractContactInfo(headerText, fullText) {
  // Email
  const emailM = fullText.match(/[\w.+'-]+@[\w-]+\.[\w.]{2,}/);
  const email  = emailM ? emailM[0].toLowerCase() : '';

  // Phone
  const phoneM = fullText.match(
    /(?:\+?\d{1,3}[\s.\-])?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}|\+\d{10,13}/
  );
  const phone = phoneM ? phoneM[0].trim() : '';

  // LinkedIn
  const liM     = fullText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([\w-]+)/i);
  const linkedin = liM ? `https://linkedin.com/in/${liM[1]}` : '';

  // GitHub
  const ghM    = fullText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]+)/i);
  const github = ghM ? `https://github.com/${ghM[1]}` : '';

  // Other website
  const urlRe = /https?:\/\/[\w.\-/]+/gi;
  const urls  = fullText.match(urlRe) || [];
  const website = urls.find(u => !u.includes('linkedin') && !u.includes('github')) || '';

  // Name: first short alphabetic line
  const hLines = (headerText || fullText).split('\n').map(l => l.trim()).filter(Boolean);
  let name = '';
  for (const line of hLines.slice(0, 8)) {
    if (line.match(/@|http|www\.|linkedin|github|©|\d{4,}/)) continue;
    if (line.length < 3 || line.length > 55) continue;
    if (/^[A-Za-z][A-Za-z\s'.\-]{1,50}$/.test(line)) { name = line; break; }
  }

  // Title: first line after name that looks like a job title
  let title = '';
  const nameIdx = hLines.indexOf(name);
  if (nameIdx >= 0) {
    for (let i = nameIdx + 1; i < Math.min(nameIdx + 5, hLines.length); i++) {
      const l = hLines[i];
      if (l.match(/@|http|\d{5,}/)) continue;
      if (l.length < 65 && /developer|engineer|designer|manager|analyst|scientist|architect|consultant|director|lead|specialist|coordinator|executive|officer|developer|programmer/i.test(l)) {
        title = l;
        break;
      }
    }
  }

  // Location: "City, ST" or "City, Country"
  const locM = fullText.match(/\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Za-z]{3,}))\b/);
  const location = locM ? locM[1].trim() : '';

  const socials = [];
  if (linkedin) socials.push({ platform: 'linkedin', url: linkedin, label: 'LinkedIn' });
  if (github)   socials.push({ platform: 'github',   url: github,   label: 'GitHub'   });
  if (website)  socials.push({ platform: 'other',    url: website,  label: 'Website'  });

  return { name, title, location, contact: { email, phone, website }, socials };
}

// ─── Skills extraction ────────────────────────────────────────────────────────

function extractSkills(text) {
  if (!text) return [];

  const cleaned = text.replace(/^[•·▪◦▸►▷\-\*]\s*/gm, '');
  const tokens  = cleaned
    .split(/[,;|•·▪▸►▷\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 45);

  const seen   = new Set();
  const skills = [];

  for (const token of tokens) {
    if (token.split(' ').length > 5) continue; // skip sentences
    if (/^\d+$/.test(token)) continue;
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    skills.push({
      name:              token,
      level:             'intermediate', // default — user reviews
      category:          TECH_CATEGORIES[key] || 'other',
      yearsOfExperience: '',
    });
  }

  return skills;
}

// ─── Experience extraction ────────────────────────────────────────────────────

function inferExpType(text) {
  const t = text.toLowerCase();
  if (/freelance|self.employed|independent|own\s+business/i.test(t)) return 'freelance';
  if (/\bcontract(or|ing)?\b/i.test(t))                              return 'contract';
  if (/\bintern(ship)?\b/i.test(t))                                  return 'internship';
  if (/part.time/i.test(t))                                          return 'part-time';
  return 'full-time';
}

function extractExperience(text) {
  if (!text) return [];

  const lines = text.split('\n').map(l => l.trim());

  // Find every line that contains a date range
  const datePosns = [];
  for (let i = 0; i < lines.length; i++) {
    const r = findDateRange(lines[i]);
    if (r) datePosns.push({ idx: i, range: r });
  }
  if (!datePosns.length) return [];

  const entries = [];

  for (let d = 0; d < datePosns.length; d++) {
    const { idx: dateIdx, range: dateRange } = datePosns[d];
    const nextDateIdx = d + 1 < datePosns.length ? datePosns[d + 1].idx : lines.length;

    const dateLine = lines[dateIdx];

    // Role: text on the date line (stripped of the date) or line above
    let role = dateLine
      .replace(dateRange.raw, '')
      .replace(/\s*[|·\-–—,]\s*$/,'').replace(/^\s*[|·\-–—,]\s*/,'')
      .trim();

    if (!role && dateIdx > 0 && lines[dateIdx - 1]) {
      role = lines[dateIdx - 1];
    }

    // The lines that come right after the date line
    let company = '';
    const descLines = [];
    let passedCompany = false;

    for (let i = dateIdx + 1; i < nextDateIdx; i++) {
      const l = lines[i];
      if (!l) continue;
      if (findDateRange(l)) break;

      const isBullet = /^[•·▪◦▸►▷\-\*]/.test(l);

      if (!passedCompany && !isBullet && l.length < 80) {
        // First short non-bullet line → company (+ maybe location)
        const parts = l.split(/[,|·•]\s*/);
        company = parts[0].trim();
        passedCompany = true;
      } else {
        const clean = l.replace(/^[•·▪◦▸►▷\-\*]\s*/, '');
        if (clean) descLines.push(clean);
        passedCompany = true;
      }
    }

    if (!role && !company) continue;

    const descStr = descLines.join('\n');
    entries.push({
      role:        role || '',
      company:     company || '',
      location:    '',
      startDate:   dateRange.start,
      endDate:     dateRange.end,
      type:        inferExpType(`${role} ${company} ${descStr}`),
      remote:      /remote|wfh|work.from.home/i.test(descStr),
      description: descStr,
    });
  }

  return entries;
}

// ─── Education extraction ─────────────────────────────────────────────────────

const DEGREE_RE = /\b(b\.?s\.?c?\.?|b\.?a\.?|b\.?e(?:ng)?\.?|m\.?s\.?c?\.?|m\.?a\.?|m\.?e(?:ng)?\.?|m\.?b\.?a\.?|ph\.?d\.?|bachelor'?s?|master'?s?|associate'?s?|doctorate|diploma|b\.?tech|m\.?tech)\b/i;

function extractEducation(text) {
  if (!text) return [];

  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
  const entries = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const hasInstitution = lines.some(l => /university|college|institute|school|academy|polytechnic/i.test(l));
    const degreeIdx      = lines.findIndex(l => DEGREE_RE.test(l));
    if (degreeIdx === -1 && !hasInstitution) continue;

    const degree = degreeIdx >= 0 ? lines[degreeIdx] : '';

    // Institution: line before or after degree, or any line with institution keywords
    let institution = '';
    if (degreeIdx > 0) institution = lines[degreeIdx - 1];
    else if (degreeIdx + 1 < lines.length) institution = lines[degreeIdx + 1];
    if (!institution || DEGREE_RE.test(institution)) {
      institution = lines.find(l => /university|college|institute|school|academy/i.test(l)) || '';
    }

    // Years
    let startYear = '', endYear = '';
    const rangeM = block.match(/(\d{4})\s*[-–—to]\s*(\d{4}|present|current|now)/i);
    if (rangeM) {
      startYear = parseInt(rangeM[1]);
      endYear   = /present|current|now/i.test(rangeM[2]) ? '' : parseInt(rangeM[2]);
    } else {
      const ym = block.match(/\b(19|20)\d{2}\b/);
      if (ym) startYear = parseInt(ym[0]);
    }

    const used   = new Set([degree, institution].filter(Boolean));
    const description = lines
      .filter(l => !used.has(l) && !/\b(19|20)\d{2}/.test(l) && l.length > 8)
      .join('\n');

    if (degree || institution) {
      entries.push({ degree, institution, startYear, endYear, description });
    }
  }

  return entries;
}

// ─── Certifications extraction ────────────────────────────────────────────────

const CERT_ISSUER_RE = /google|aws|amazon|microsoft|azure|cisco|comptia|pmi|oracle|salesforce|adobe|meta|linkedin|coursera|udemy|udacity|edx|harvard|mit|stanford|ibm|red\s*hat|scrum|agile|pmp|itil|ceh|cissp|ec-council|isaca/i;

function extractCertifications(text) {
  if (!text) return [];

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[•·▪◦▸►▷\-\*]\s*/, '').trim();
    if (!line || line.length < 5) continue;

    // Skip lines that are just a year or a header
    if (/^\d{4}$/.test(line)) continue;

    const dateM   = line.match(/\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?\d{4}\b/i);
    const date    = dateM ? parseDate(dateM[0]) : '';
    const issuerM = line.match(CERT_ISSUER_RE);
    const issuer  = issuerM ? issuerM[0].trim() : '';

    // Title: line minus date and issuer
    let title = line
      .replace(/\s*[-–—|]\s*\d{4}.*$/, '')
      .replace(CERT_ISSUER_RE, '')
      .replace(/\s*[-–—|·,]\s*$/, '')
      .trim();

    if (title.length > 5) {
      entries.push({ title, issuer, date, credentialUrl: '' });
    }
  }

  return entries;
}

// ─── Projects extraction ──────────────────────────────────────────────────────

function extractProjects(text) {
  if (!text) return [];

  const blocks = text.split(/\n\s*\n/).filter(b => b.trim());
  const entries = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    // First non-bullet line = title
    const titleLine = lines.find(l => !/^[•·▪◦▸►▷\-\*]/.test(l)) || lines[0];
    const title     = titleLine.replace(/^[•·▪◦▸►▷\-\*]\s*/, '').trim();
    if (!title || title.length < 3) continue;

    const descLines = lines
      .filter(l => l !== titleLine)
      .map(l => l.replace(/^[•·▪◦▸►▷\-\*]\s*/, ''));

    // Detect tech from the whole block using the lookup table
    const blockLower = block.toLowerCase();
    const tech = Object.keys(TECH_CATEGORIES)
      .filter(t => {
        const re = new RegExp(`\\b${t.replace(/[.+]/g, c => `\\${c}`)}\\b`, 'i');
        return re.test(blockLower);
      })
      .slice(0, 10);

    // URLs
    const urls    = block.match(/https?:\/\/[\w.\-/?=#&]+/g) || [];
    const repoUrl = urls.find(u => /github|gitlab|bitbucket/i.test(u)) || '';
    const demoUrl = urls.find(u => u !== repoUrl) || '';

    entries.push({
      title,
      description: descLines.join('\n'),
      tech,
      demoUrl,
      repoUrl,
      imageUrl: '',
      featured: false,
    });
  }

  return entries;
}

// ─── Main parse function (swap this to upgrade to AI later) ──────────────────

function parseResume(text) {
  const sections  = splitIntoSections(text);
  const headerTxt = sections._header || '';
  const contact   = extractContactInfo(headerTxt, text);
  const bio       = (sections.summary || '').trim().slice(0, 600);

  return {
    // Profile
    name:             contact.name,
    title:            contact.title,
    bio,
    location:         contact.location,
    contact:          contact.contact,
    socials:          contact.socials,
    availableForWork: false,

    // Sections
    skills:           extractSkills(sections.skills),
    experience:       extractExperience(sections.experience),
    education:        extractEducation(sections.education),
    certifications:   extractCertifications(sections.certifications),
    projects:         extractProjects(sections.projects),

    // Debug meta
    _sectionsFound: Object.keys(sections).filter(k => k !== '_header' && (sections[k] || '').trim()),
    _charCount:     text.length,
  };
}

// ─── Text extraction from file buffer ────────────────────────────────────────
// Swap extractText to support new formats (e.g., images via OCR) later.

async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    // Use lib path to avoid pdf-parse's dev-mode test file side-effect
    const pdfParse = require('pdf-parse/lib/pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    const mammoth = require('mammoth');
    const result  = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
}

module.exports = { parseResume, extractText };
