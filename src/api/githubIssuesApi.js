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

export const transferIssue = (data) =>
  axios.post(`${BASE}/transfer`, data);

export const searchUsers = (query) =>
  axios.post(`${BASE}/search-users`, { query });
