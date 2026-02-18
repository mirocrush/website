import React from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import App from './App';

// Send the httpOnly JWT cookie with every axios request
axios.defaults.withCredentials = true;

const root = createRoot(document.getElementById('root'));
root.render(<App />);
