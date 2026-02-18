import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import Navbar     from './components/Navbar';
import BlogList   from './pages/BlogList';
import BlogDetail from './pages/BlogDetail';
import CreateEdit from './pages/CreateEdit';
import Signup     from './pages/Signup';
import VerifyOtp  from './pages/VerifyOtp';
import Signin     from './pages/Signin';
import Profile    from './pages/Profile';

const theme = createTheme({
  palette: {
    primary:    { main: '#1976d2' },
    secondary:  { main: '#dc004e' },
    background: { default: '#f5f5f5' },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/"           element={<Navigate to="/blogs" replace />} />
            <Route path="/blogs"      element={<BlogList />} />
            <Route path="/blogs/:id"  element={<BlogDetail />} />
            <Route path="/create"     element={<CreateEdit />} />
            <Route path="/edit/:id"   element={<CreateEdit />} />
            <Route path="/signup"     element={<Signup />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/signin"     element={<Signin />} />
            <Route path="/profile"    element={<Profile />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
