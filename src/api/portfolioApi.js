import axios from 'axios';

const BASE = '/api/portfolios';

const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data).then((res) => res.data);

export const listPortfolios     = ()        => post('/list');
export const createPortfolio    = (payload) => post('/create',       payload);
export const updatePortfolio    = (payload) => post('/update',       payload);
export const deletePortfolio    = (payload) => post('/delete',       payload);
export const getPortfolioBySlug = (slug)    => post('/get-by-slug',  { slug });
