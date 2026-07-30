import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, HelpCircle, MessageSquare, Send, Upload, X } from 'lucide-react';

const SUGGESTIONS = [
  'Find y at x = 2.5 for points (1, 1), (2, 4), (3, 9)',
  'Use unequal interval points (1, 2), (2.5, 6), (4, 17), (7, 50) and estimate at x = 2',
  'Solve x^3 - x - 2 = 0 using Bisection Method in interval [1, 2] with tolerance 1e-5',
  'Integrate function sin(x) from 0 to 3.1416 using Simpson 1/3 rule with 6 intervals',
  'Solve ODE dy/dx = x + y with y(0) = 1 up to x = 0.4 using RK4 with h = 0.1',
];

export default function ChatInterface({ onSubmit, onFileUpload, loading }) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    if (file) {
      onFileUpload(file);
      setFile(null);
      return;
    }

    onSubmit(input);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div 
      className="solver-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="card-heading">
        <span className="card-icon">
          <MessageSquare size={22} />
        </span>
        <div>
          <h3>Ask the Solver</h3>
          <p>Type a full question. If it contains interpolation points, Fine Arc can choose the technique automatically.</p>
        </div>
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <motion.textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Example: Find y at x = 2.5 for points (1, 1), (2, 4), (3, 9)"
          disabled={loading}
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.2 }}
        />

        {file && (
          <motion.div 
            className="file-pill"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <FileText size={18} />
            <span>{file.name}</span>
            <small>{(file.size / 1024).toFixed(1)} KB</small>
            <motion.button 
              type="button" 
              onClick={removeFile} 
              aria-label="Remove uploaded file"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X size={16} />
            </motion.button>
          </motion.div>
        )}

        <div className="form-actions">
          <input
            type="file"
            id="file-upload"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.docx,.pdf"
            hidden
          />
          <motion.label 
            className="btn-secondary" 
            htmlFor="file-upload"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Upload size={16} />
            Upload Question
          </motion.label>

          <motion.button 
            type="submit" 
            className="btn-primary" 
            disabled={loading || (!input.trim() && !file)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Processing' : 'Solve'}
            <Send size={16} />
          </motion.button>
        </div>
      </form>

      <div className="suggestion-block">
        <motion.button
          type="button"
          className="suggestion-toggle"
          onClick={() => setShowSuggestions((value) => !value)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <HelpCircle size={16} />
          {showSuggestions ? 'Hide Examples' : 'Show Examples'}
        </motion.button>

        <AnimatePresence>
          {showSuggestions && (
            <motion.div 
              className="suggestion-grid"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {SUGGESTIONS.map((suggestion, idx) => (
                <motion.button
                  type="button"
                  key={suggestion}
                  className="suggestion-card"
                  onClick={() => setInput(suggestion)}
                  whileHover={{ scale: 1.02, x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  {suggestion}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
