import axios from 'axios';

const BASE = '/api/revelo';
const post = (ep, data = {}) => axios.post(`${BASE}${ep}`, data).then(r => r.data);

// Assets
export const uploadAssets = (files) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axios.post(`${BASE}/assets/upload`, fd).then(r => r.data);
};

// Accounts
export const listAccounts   = ()       => post('/accounts/list');
export const createAccount  = (data)   => post('/accounts/create', data);
export const updateAccount  = (data)   => post('/accounts/update', data);
export const deleteAccount  = (id)     => post('/accounts/delete', { id });

// Jobs
export const listJobs         = ()       => post('/jobs/list');
export const createJob        = (data)   => post('/jobs/create', data);
export const updateJob        = (data)   => post('/jobs/update', data);
export const deleteJob        = (id)     => post('/jobs/delete', { id });
export const requestJobEdit   = (data)   => post('/jobs/request-edit', data);
export const handleEditRequest = (data)  => post('/jobs/handle-edit-request', data);

// Tasks
export const listTasks   = (data = {}) => post('/tasks/list', data);
export const createTask  = (data)      => post('/tasks/create', data);
export const updateTask  = (data)      => post('/tasks/update', data);
export const deleteTask  = (id)        => post('/tasks/delete', { id });

// Dashboard
export const getDashboardStats = () => post('/dashboard/stats');
