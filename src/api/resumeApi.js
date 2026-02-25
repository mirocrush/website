import axios from 'axios';

// Upload a resume file (PDF or DOCX) and get back structured portfolio data.
// Returns: { success: true, data: { name, title, bio, skills, experience, ... } }
export const parseResume = (file) => {
  const formData = new FormData();
  formData.append('resume', file);
  return axios
    .post('/api/resume/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((res) => res.data);
};
