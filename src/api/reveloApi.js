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
export const listJobs          = ()            => post('/jobs/list');
export const listJobsByAccount = (accountId)  => post('/jobs/list', { accountId });
export const setJobAccount     = (id, accountId) => post('/jobs/set-account', { id, accountId });
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
export const uploadTaskFiles = (files) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axios.post(`${BASE}/tasks/upload`, fd).then(r => r.data);
};

// Income Reports
export const listIncomeReports   = (data = {}) => post('/income-reports/list',   data);
export const createIncomeReport  = (data)      => post('/income-reports/create', data);
export const updateIncomeReport  = (data)      => post('/income-reports/update', data);
export const deleteIncomeReport  = (id)        => post('/income-reports/delete', { id });
export const uploadReportFiles   = (files) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axios.post(`${BASE}/income-reports/upload`, fd).then(r => r.data);
};

// Task Balance
export const addTaskBalanceEntry    = (data) => post('/task-balance/add',    data);
export const listTaskBalanceEntries = (data) => post('/task-balance/list',   data);
export const updateTaskBalanceEntry = (data) => post('/task-balance/update', data);
export const deleteTaskBalanceEntry = (id)   => post('/task-balance/delete', { id });

// Dashboard
export const getDashboardStats = () => post('/dashboard/stats');

// Forum
export const listForumMessages  = (data) => post('/forum/list',   data);
export const sendForumMessage   = (data) => post('/forum/send',   data);
export const reactForumMessage  = (data) => post('/forum/react',  data);
export const editForumMessage   = (data) => post('/forum/edit',   data);
export const deleteForumMessage = (data) => post('/forum/delete', data);
export const uploadForumFiles   = (files) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  return axios.post('/api/revelo/forum/upload', fd).then(r => r.data);
};
