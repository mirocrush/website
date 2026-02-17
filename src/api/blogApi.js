import axios from 'axios';

const BASE = '/api/blogs';

// All API calls use POST only
const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data).then((res) => res.data);

export const listBlogs = () => post('/list');

export const getBlog = (id) => post('/get', { id });

export const createBlog = (payload) => post('/create', payload);

export const updateBlog = (payload) => post('/update', payload);

export const deleteBlog = (id) => post('/delete', { id });
