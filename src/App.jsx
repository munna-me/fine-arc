import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatInterface from './components/ChatInterface';
import SolutionRenderer from './components/SolutionRenderer';
import SmartInterpolation from './components/SmartInterpolation';
import InterpolationTutorial from './components/InterpolationTutorial';
import ProfilePanel from './components/ProfilePanel';
import ArcReactor from './components/ArcReactor';
import AuthPage from './components/auth/AuthPage';
import { useAuth } from './context/AuthContext';
import { apiFetch } from './api/client';
import {
  AlertCircle,
  Brain,
  Calculator,
  Cpu,
  LogIn,
  LogOut,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  UserCircle,
} from 'lucide-react';

export default function App() {
  const { user, status, logout, exitGuest } = useAuth();
  const [activeTab, setActiveTab] = useState('smart');
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');

  const handleSolveText = async (text) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentPrompt(text);

    try {
      const parseRes = await apiFetch('/parse', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (!parseRes.ok) throw new Error('Failed to parse question parameters.');
      const parsed = await parseRes.json();

      if (!parsed.method) {
        throw new Error(
          'I could not identify the method or interpolation data. Try adding points, a target x value, or keywords like Bisection, Simpson, Euler, RK4, or Interpolation.'
        );
      }

      const solveRes = await apiFetch('/solve', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      const solvedData = await solveRes.json();
      if (!solveRes.ok) {
        throw new Error(solvedData.detail || 'Calculation failed. Check equation syntax and bounds.');
      }

      setResult(solvedData);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSolveFile = async (file) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setCurrentPrompt(`Uploaded: ${file.name}`);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await apiFetch('/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.detail || 'Failed to extract text from file.');

      if (!uploadData.parsed.method) {
        throw new Error('I could not identify a numerical method in the file.');
      }

      const solveRes = await apiFetch('/solve', {
        method: 'POST',
        body: JSON.stringify(uploadData.parsed),
      });
      const solvedData = await solveRes.json();
      if (!solveRes.ok) throw new Error(solvedData.detail || 'Calculation failed.');
      setResult(solvedData);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSmartResult = (data) => {
    setCurrentPrompt(`Smart Interpolation → ${data.method}`);
    setResult(data);
    setError(null);
  };

  const handleExport = async (format, data) => {
    setExporting(true);
    try {
      const res = await apiFetch(`/export/${format}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Failed to generate ${format.toUpperCase()} export.`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `finearc_${data.method?.toLowerCase().replace(/[^a-z0-9]/g, '_') ?? 'solution'}.${format}`
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const resetAll = () => {
    setResult(null);
    setError(null);
    setCurrentPrompt('');
    setShowTutorial(false);
  };

  const tabs = [
    {
      id: 'smart',
      label: 'Smart Interpolation',
      detail: 'Choose Equal or Unequal interval and let the system pick the formula.',
      Icon: Brain,
    },
    {
      id: 'chat',
      label: 'General Solver',
      detail: 'Ask in plain English, upload a question, or solve roots, integration, and ODEs.',
      Icon: Calculator,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.6, ease: "easeOut" } 
    },
    exit: { 
      opacity: 0, 
      y: -20, 
      transition: { duration: 0.4, ease: "easeIn" } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  };

  if (status === 'loading') {
    return (
      <div className={`app-shell theme-${theme} auth-loading`}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        >
          <Cpu size={32} />
        </motion.div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <AuthPage theme={theme} />;
  }

  return (
    <motion.main 
      className={`app-shell theme-${theme}`}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.section 
        className="hero-section"
        variants={containerVariants}
      >
        <motion.div className="top-bar" custom={0} variants={itemVariants}>
          <div className="brand-chip">
            <img 
              src="/newlogo.png" 
              alt="Fine Arc Logo" 
              style={{ 
                width: 'auto', 
                height: '32px',
                objectFit: 'contain'
              }}
            />
            <span>Numerical Methods Studio</span>
          </div>

          <div className="top-bar-actions">
            <div className="theme-switch" aria-label="Theme selector">
              <motion.button
                type="button"
                className={theme === 'dark' ? 'active' : ''}
                onClick={() => setTheme('dark')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={theme === 'dark' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Moon size={24} />
              </motion.button>
              <motion.button
                type="button"
                className={theme === 'light' ? 'active' : ''}
                onClick={() => setTheme('light')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={theme === 'light' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Sun size={24} />
              </motion.button>
            </div>

            {user && (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="user-chip"
                  onClick={() => setShowUserMenu((v) => !v)}
                >
                  <UserCircle size={16} />
                  Profile
                </button>

                {showUserMenu && (
                  <>
                    <div
                      onClick={() => setShowUserMenu(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    />
                    <ProfilePanel
                      onLogout={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {!user && status === 'guest' && (
              <div className="guest-chip">
                <span>Browsing as guest</span>
                <button type="button" onClick={exitGuest}>
                  <LogIn size={14} />
                  Log in
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <div className="hero-grid">
          <motion.div className="hero-copy" custom={1} variants={itemVariants}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img 
                src="/newlogo.png" 
                alt="Fine Arc Logo" 
                style={{ 
                  width: 'auto', 
                  height: '72px',
                  objectFit: 'contain'
                }}
              />
              <motion.h1
                animate={{ 
                  textShadow: [
                    "0 0 20px rgba(37, 99, 235, 0.5)",
                    "0 0 40px rgba(5, 137, 90, 0.3)",
                    "0 0 20px rgba(37, 99, 235, 0.5)"
                  ]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                Fine Arc
              </motion.h1>
            </div>
            <p className="hero-lede">
              A cleaner solver experience for interpolation, root finding, integration, and ODE work.
              Start with the interval type, then Fine Arc selects the right interpolation formula for you.
            </p>
            <div className="hero-actions">
              <motion.button 
                type="button" 
                className="btn-primary" 
                onClick={() => setActiveTab('smart')}
                whileHover={{ scale: 1.05, boxShadow: "0 10px 30px rgba(37, 99, 235, 0.4)" }}
                whileTap={{ scale: 0.95 }}
              >
                Start Smart Interpolation
              </motion.button>
              <motion.button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setActiveTab('chat')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Ask a Full Problem
              </motion.button>
            </div>
          </motion.div>

          <motion.aside 
            className="selection-map" 
            aria-label="Automatic interpolation rules"
            custom={2} 
            variants={itemVariants}
          >
            {[
              { index: "01", title: "Equal Interval", desc: "Newton Forward is used near the start, Backward near the end." },
              { index: "02", title: "Unequal Interval", desc: "Lagrange Interpolation is selected because it works for uneven spacing." },
              { index: "03", title: "No Technique Named", desc: "Point data still routes through smart interpolation." }
            ].map((item, i) => (
              <motion.div 
                key={item.index}
                className="map-row"
                whileHover={{ x: 10 }}
                transition={{ duration: 0.2 }}
                custom={i}
                variants={itemVariants}
              >
                <motion.span 
                  className="map-index"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  {item.index}
                </motion.span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.aside>
        </div>
      </motion.section>

      <motion.section 
        className="workspace-section"
        custom={3} 
        variants={itemVariants}
      >
        <div className="workspace-heading">
          <div>
            <p className="section-kicker">Choose and interact</p>
            <h2>Pick a solving path</h2>
          </div>
          {result && (
            <motion.button 
              type="button" 
              className="btn-quiet" 
              onClick={resetAll}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RotateCcw size={16} />
              Solve another
            </motion.button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!result && !loading && (
            <motion.div 
              key="mode-grid"
              className="mode-grid"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
            >
              {tabs.map(({ id, label, detail, Icon }, i) => (
                <motion.button
                  type="button"
                  key={id}
                  className={`mode-card ${activeTab === id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(id);
                    setError(null);
                  }}
                  whileHover={{ scale: 1.03, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  custom={i}
                  variants={itemVariants}
                  animate={activeTab === id ? { 
                    boxShadow: ["0 10px 30px rgba(37, 99, 235, 0.3)", "0 10px 30px rgba(5, 137, 90, 0.2)", "0 10px 30px rgba(37, 99, 235, 0.3)" ]
                  } : {}}
                  transition={{ duration: 2, repeat: activeTab === id ? Infinity : 0 }}
                >
                  <span className="mode-icon">
                    <Icon size={22} />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                </motion.button>
              ))}
            </motion.div>
          )}

          {error && (
            <motion.div 
              key="error"
              className="error-banner"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.4 }}
            >
              <AlertCircle size={20} />
              <div>
                <strong>Needs attention</strong>
                <p>{error}</p>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div 
              key="loading"
              className="loading-panel"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Cpu size={38} />
              </motion.div>
              <strong>Fine Arc is computing</strong>
              <span>Building the formula, table, and final answer.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!result && !loading && activeTab === 'smart' && (
            <motion.div
              key="smart-interpolation"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <SmartInterpolation onResult={handleSmartResult} />
            </motion.div>
          )}

          {!result && !loading && activeTab === 'chat' && (
            <motion.div
              key="chat-interface"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              <ChatInterface
                onSubmit={handleSolveText}
                onFileUpload={handleSolveFile}
                loading={loading}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {result && (
            <motion.div 
              key="results"
              className="result-stack"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.6 }}
            >
              <motion.div 
                className="solved-strip"
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <div>
                  <span>Solved</span>
                  <strong>{currentPrompt}</strong>
                </div>
                <motion.button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={resetAll}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw size={16} />
                  New problem
                </motion.button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                {showTutorial ? (
                  <InterpolationTutorial result={result} onExit={() => setShowTutorial(false)} />
                ) : (
                  <SolutionRenderer
                    result={result}
                    onExport={handleExport}
                    exporting={exporting}
                    onTeach={() => setShowTutorial(true)}
                  />
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      <motion.footer 
        className="app-footer"
        custom={4} 
        variants={itemVariants}
      >
        <span>Fine Arc</span>
        <span>Intelligent Numerical Methods Platform</span>
      </motion.footer>
    </motion.main>
  );
}