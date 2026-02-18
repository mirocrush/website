import axios from 'axios';

const BASE = '/api/blogs';

// All blog API calls use POST only
const post = (endpoint, data = {}) =>
  axios.post(`${BASE}${endpoint}`, data).then((res) => res.data);

export const listBlogs = () => post('/list');

export const getBlog = (id) => post('/get', { id });

export const createBlog = (payload) => post('/create', payload);

export const updateBlog = (payload) => post('/update', payload);

export const deleteBlog = (id) => post('/delete', { id });

// Upload a single file to Supabase via the server
// Returns { bucket, path, url, mimeType }
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axios
    .post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${process.env.UPLOAD_ADMIN_TOKEN}`,
      },
    })
    .then((res) => res.data);
};

// Get a short-lived signed URL for a private PDF
export const getPdfSignedUrl = (path) =>
  axios.post('/api/files/pdf', { path }).then((res) => res.data);

// Permanently delete a file from Supabase Storage
export const deleteFile = ({ bucket, path }) =>
  axios
    .post('/api/files/delete', { bucket, path }, {
      headers: { Authorization: `Bearer ${process.env.UPLOAD_ADMIN_TOKEN}` },
    })
    .then((res) => res.data);
