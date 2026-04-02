import axios from 'axios';

const BASE = '/api/blogs';

const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data);

export const listBlogs = () => post('/list');

export const getBlog = (id) => post('/get', { id });

export const createBlog = (payload) => post('/create', payload);

export const updateBlog = (payload) => post('/update', payload);

export const deleteBlog = (id) => post('/delete', { id });

export const commentIssue = (payload) => post('/comment', payload);

export const likeIssue = (payload) => post('/like', payload);

export const solveIssue = (payload) => post('/solve', payload);

// Upload a single file to Supabase via the server
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${process.env.UPLOAD_ADMIN_TOKEN}`,
    },
  });
};

export const getPdfSignedUrl = (path) =>
  axios.post('/api/files/pdf', { path });

export const deleteFile = ({ bucket, path }) =>
  axios.post('/api/files/delete', { bucket, path }, {
    headers: { Authorization: `Bearer ${process.env.UPLOAD_ADMIN_TOKEN}` },
  });
