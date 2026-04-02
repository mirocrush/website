import axios from 'axios';

const BASE = '/api/notifications';
const post = (endpoint, data = {}) => axios.post(`${BASE}${endpoint}`, data).then((r) => r.data);

export const listNotifications = (params) => post('/list', params);
export const getUnreadCount    = ()         => post('/unread-count');
export const markRead          = (ids)      => post('/mark-read', { ids });
export const markAllRead       = ()         => post('/mark-all-read');
