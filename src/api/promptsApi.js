import axios from 'axios';

const BASE = '/api/prompts';

export const listPrompts    = (params)     => axios.post(`${BASE}/list`, params);
export const getPrompt      = (id)         => axios.post(`${BASE}/get`, { id });
export const createPrompt   = (data)       => axios.post(`${BASE}/create`, data);
export const updatePrompt   = (id, data)   => axios.post(`${BASE}/update`, { id, ...data });
export const setMainPrompt  = (id)         => axios.post(`${BASE}/set-main`, { id });
export const useAsMainPrompt = (id)        => axios.post(`${BASE}/use-as-main`, { id });
export const clonePrompt    = (id)         => axios.post(`${BASE}/clone`, { id });
export const deletePrompt   = (id)         => axios.post(`${BASE}/delete`, { id });
