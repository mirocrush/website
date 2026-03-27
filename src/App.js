import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute  from './components/ProtectedRoute';
import Navbar          from './components/Navbar';
import BlogList        from './pages/BlogList';
import BlogDetail      from './pages/BlogDetail';
import CreateEdit      from './pages/CreateEdit';
import Signup          from './pages/Signup';
import VerifyOtp       from './pages/VerifyOtp';
import Signin          from './pages/Signin';
import Profile         from './pages/Profile';
import Portfolios      from './pages/Portfolios';
import PortfolioForm   from './pages/PortfolioForm';
import PortfolioView   from './pages/PortfolioView';
import Friends         from './pages/Friends';
import UserProfile     from './pages/UserProfile';
import Messenger       from './pages/Messenger';
import ServerInvite    from './pages/ServerInvite';
import GithubIssues   from './pages/GithubIssues';
import Prompts        from './pages/Prompts';

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

const Guard = ({ children }) => <ProtectedRoute>{children}</ProtectedRoute>;

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            {/* ── Public routes ── */}
            <Route path="/"           element={<Navigate to="/signin" replace />} />
            <Route path="/signup"     element={<Signup />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/signin"     element={<Signin />} />

            {/* ── Auth-required routes ── */}
            <Route path="/blogs"      element={<Guard><BlogList /></Guard>} />
            <Route path="/blogs/:id"  element={<Guard><BlogDetail /></Guard>} />
            <Route path="/create"     element={<Guard><CreateEdit /></Guard>} />
            <Route path="/edit/:id"   element={<Guard><CreateEdit /></Guard>} />
            <Route path="/profile"    element={<Guard><Profile /></Guard>} />

            <Route path="/portfolios"               element={<Guard><Portfolios /></Guard>} />
            <Route path="/portfolios/add"           element={<Guard><PortfolioForm /></Guard>} />
            <Route path="/portfolios/:portfolioKey" element={<Guard><PortfolioForm /></Guard>} />

            <Route path="/github-issues"        element={<Guard><GithubIssues /></Guard>} />
            <Route path="/prompts"              element={<Guard><Prompts /></Guard>} />
            <Route path="/friends"              element={<Guard><Friends /></Guard>} />
            <Route path="/profiles/:username"   element={<Guard><UserProfile /></Guard>} />

            <Route path="/messenger/servers/invite/:inviteKey" element={<Guard><ServerInvite /></Guard>} />
            <Route path="/messenger/*"          element={<Guard><Messenger /></Guard>} />

            {/* ── Public portfolio viewer — single-segment catch-all, must be last ── */}
            <Route path="/:slug" element={<PortfolioView />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
