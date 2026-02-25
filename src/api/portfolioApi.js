import axios from 'axios';

const BASE = '/api/portfolios';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then((r) => r.data);

// ── Portfolio CRUD ────────────────────────────────────────────────────────────
export const listPortfolios  = ()        => post('/list');
export const createPortfolio = (payload) => post('/create',      payload);
export const getPortfolio    = (payload) => post('/get',         payload); // { id }
export const updateHero      = (payload) => post('/update-hero', payload);
export const deletePortfolio = (payload) => post('/delete',      payload);
export const getPortfolioBySlug = (slug) => post('/get-by-slug', { slug });

// ── Section item CRUD ─────────────────────────────────────────────────────────
// payload: { id, section, item }
export const addSectionItem    = (payload) => post('/section/add',    payload);
// payload: { id, section, itemId, item }
export const updateSectionItem = (payload) => post('/section/update', payload);
// payload: { id, section, itemId }
export const deleteSectionItem = (payload) => post('/section/delete', payload);

// ── Display settings ──────────────────────────────────────────────────────────
// payload: { id, sectionsOrder?, sectionsVisible?, seoTitle?, seoDescription? }
export const updateSettings = (payload) => post('/settings/update', payload);
