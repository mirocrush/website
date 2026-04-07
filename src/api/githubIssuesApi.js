import axios from 'axios';

const BASE = '/api/github-issues';

export const listIssues = (params) =>
  axios.post(`${BASE}/list`, params);

export const getIssue = (id) =>
  axios.post(`${BASE}/get`, { id });

export const createIssue = (data) =>
  axios.post(`${BASE}/create`, data);

export const updateIssue = (id, data) =>
  axios.post(`${BASE}/update`, { id, ...data });

export const deleteIssue = (id) =>
  axios.post(`${BASE}/delete`, { id });

export const checkConflict = (params) =>
  axios.post(`${BASE}/check-conflict`, params);

export const searchUsers          = (query) => axios.post(`${BASE}/search-users`, { query });
export const transferIssue        = (data)  => axios.post(`${BASE}/transfer`, data);
export const transferMultiple     = (data)  => axios.post(`${BASE}/transfer-multiple`, data);
export const cancelTransfer       = (id)    => axios.post(`${BASE}/transfer-cancel`, { id });
export const acceptTransfer       = (id)    => axios.post(`${BASE}/transfer-accept`, { id });
export const rejectTransfer       = (id)    => axios.post(`${BASE}/transfer-reject`, { id });
export const getIncomingTransfers = ()      => axios.post(`${BASE}/incoming-transfers`, {});

export const scoreIssue    = (id)          => axios.post(`${BASE}/score`,           { id });
export const togglePin     = (id)          => axios.post(`${BASE}/toggle-pin`,      { id });
export const movePriority  = (id, delta)   => axios.post(`${BASE}/move-priority`,   { id, delta });
export const resetToOpen       = (id)                      => axios.post(`${BASE}/reset-to-open`,  { id });
export const bulkStatusChange  = (ids, takenStatus)        => axios.post(`${BASE}/bulk-status`,   { ids, takenStatus });
export const bulkDelete        = (ids)                     => axios.post(`${BASE}/bulk-delete`,   { ids });
export const bulkStar          = (ids, pinned)             => axios.post(`${BASE}/bulk-star`,     { ids, pinned });
