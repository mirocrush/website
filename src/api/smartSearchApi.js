import axios from 'axios';

const BASE = '/api/smart-search';

export const searchRepos    = (data) => axios.post(`${BASE}/search-repos`, data);
export const validateUrl    = (data) => axios.post(`${BASE}/validate-url`, data);
export const searchIssues   = (data) => axios.post(`${BASE}/search-issues`, data);
export const importRepos    = (data) => axios.post(`${BASE}/import-repos`, data);
export const getSavedRepos  = ()     => axios.post(`${BASE}/saved-repos`, {});
export const deleteSavedRepo= (id)   => axios.post(`${BASE}/delete-repo`, { id });
export const importIssues   = (data) => axios.post(`${BASE}/import-issues`, data);
