import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ArrowRight, Brain, CheckCircle2, Download, Equal, FileText, GraduationCap, Shuffle } from 'lucide-react';
import { isTutorialSupported } from './InterpolationTutorial';
import SolutionChart from './SolutionChart';

export const InlineMath = ({ math }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      katex.render(math, containerRef.current, {
        throwOnError: false,
        displayMode: false,
      });
    }
  }, [math]);

  return <span ref={containerRef} />;
};

export const BlockMath = ({ math }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      katex.render(math, containerRef.current, {
        throwOnError: false,
        displayMode: true,
      });
    }
  }, [math]);

  return <div ref={containerRef} className="math-block" />;
};

export default function SolutionRenderer({ result, onExport, exporting, onTeach }) {
  if (!result) return null;

  const { steps = [] } = result;
  
  // Check if this is an inverse interpolation
  const isInverse = result.method?.includes('Inverse');

  const toLatex = (eqStr) => {
    if (!eqStr) return '';
    return eqStr
      .replace(/^dy\/dx\s*=\s*/i, '')
      .replace(/\*\*/g, '^')
      .replace(/\*/g, ' \\cdot ')
      .replace(/exp\((.*?)\)/g, 'e^{$1}')
      .replace(/sin\((.*?)\)/g, '\\sin($1)')
      .replace(/cos\((.*?)\)/g, '\\cos($1)')
      .replace(/tan\((.*?)\)/g, '\\tan($1)')
      .replace(/sqrt\((.*?)\)/g, '\\sqrt{$1}');
  };

  const formatVal = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? val.toString() : val.toFixed(6);
    }
    return val.toString();
  };

  const exportResult = (format) => {
    if (onExport) onExport(format, result);
  };

  const renderAutoSelection = () => {
    const selection = result.auto_selection;
    if (!selection) return null;

    const isForward = selection.selected_method?.includes('Forward');
    const isBackward = selection.selected_method?.includes('Backward');
    const Icon = isForward ? ArrowRight : isBackward ? Shuffle : Equal;

    return (
      <motion.div 
        className={`auto-card ${isForward ? 'tone-blue' : isBackward ? 'tone-purple' : 'tone-green'}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <span className="auto-icon">
          <Brain size={18} />
        </span>
        <div>
          <small>Fine Arc Auto-Selected</small>
          <strong>
            <Icon size={16} />
            {selection.selected_method}
          </strong>
          <p>{selection.reason}</p>
        </div>
      </motion.div>
    );
  };

  const renderSummary = () => (
    <motion.div 
      className="summary-grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <motion.div 
        className="summary-card"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <span>Method</span>
        <strong>{result.method}</strong>

        {result.equation && (
          <div className="summary-math">
            <small>Function</small>
            <InlineMath math={`f(x) = ${toLatex(result.equation)}`} />
          </div>
        )}

        {result.ode && (
          <div className="summary-math">
            <small>ODE</small>
            <InlineMath math={`\\frac{dy}{dx} = ${toLatex(result.ode)}`} />
          </div>
        )}
      </motion.div>

      <motion.div 
        className="summary-card result-card"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <span>Result</span>
        {result.root !== undefined && (
          <strong className="result-value">
            <InlineMath math={`x \\approx ${formatVal(result.root)}`} />
          </strong>
        )}
        {/* Handle both normal and inverse interpolation */}
        {result.interpolated_y !== undefined && !isInverse && (
          <strong className="result-value">
            <InlineMath math={`y(${formatVal(result.target_x)}) \\approx ${formatVal(result.interpolated_y)}`} />
          </strong>
        )}
        {result.interpolated_x !== undefined || (result.interpolated_y !== undefined && isInverse) && (
          <strong className="result-value">
            <InlineMath math={`x(${formatVal(result.target_x)}) \\approx ${formatVal(result.interpolated_x || result.interpolated_y)}`} />
          </strong>
        )}
        {result.integral !== undefined && (
          <strong className="result-value">
            <InlineMath math={`I \\approx ${formatVal(result.integral)}`} />
          </strong>
        )}
        {result.final_y !== undefined && (
          <strong className="result-value">
            <InlineMath math={`y(${formatVal(result.xn)}) \\approx ${formatVal(result.final_y)}`} />
          </strong>
        )}

        <div className="result-footer">
          <span>
            <CheckCircle2 size={16} />
            {result.iterations !== undefined ? `${result.iterations} iterations` : 'Calculation complete'}
          </span>
          <div className="export-actions">
            {isTutorialSupported(result.method) && (
              <motion.button
                type="button"
                onClick={onTeach}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <GraduationCap size={16} />
                Teach me this
              </motion.button>
            )}
            <motion.button 
              type="button" 
              onClick={() => exportResult('docx')} 
              disabled={exporting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FileText size={16} />
              Word
            </motion.button>
            <motion.button 
              type="button" 
              onClick={() => exportResult('pdf')} 
              disabled={exporting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download size={16} />
              PDF
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  const getStepColumns = (sampleStep) => {
    if ('iteration' in sampleStep) {
      if ('fa' in sampleStep) {
        return {
          headers: ['Iter', 'a', 'b', 'c', 'f(a)', 'f(b)', 'f(c)', 'Error'],
          keys: ['iteration', 'a', 'b', 'c', 'fa', 'fb', 'fc', 'error'],
        };
      }
      if ('df_xi' in sampleStep) {
        return {
          headers: ['Iter', 'xi', 'f(xi)', "f'(xi)", 'xi+1', 'Error'],
          keys: ['iteration', 'xi', 'f_xi', 'df_xi', 'xi_next', 'error'],
        };
      }
      return {
        headers: ['Iter', 'x prev', 'x curr', 'x next', 'f(x next)', 'Error'],
        keys: ['iteration', 'x_prev', 'x_curr', 'x_next', 'f_next', 'error'],
      };
    }

    if ('x_val' in sampleStep) {
      return {
        headers: ['i', 'x_i', 'y_i', 'Numerator', 'Denominator', 'L_i(x)', 'Contribution'],
        keys: ['index', 'x_val', 'y_val', 'formula_num', 'formula_den', 'term_value', 'contribution'],
      };
    }

    if ('delta_order' in sampleStep) {
      return {
        headers: ['Term', 'Difference', 'Value', 's product', 'k!', 'Contribution'],
        keys: ['term_index', 'delta_order', 'delta_value', 's_product', 'factorial', 'contribution'],
      };
    }

    if ('slope' in sampleStep) {
      return {
        headers: ['Step', 'x_i', 'y_i', 'Slope', 'dy', 'x next', 'y next'],
        keys: ['step', 'x', 'y', 'slope', 'dy', 'next_x', 'next_y'],
      };
    }

    if ('k1' in sampleStep) {
      return {
        headers: ['Step', 'x_i', 'y_i', 'k1', 'k2', 'k3', 'k4', 'y next'],
        keys: ['step', 'x', 'y', 'k1', 'k2', 'k3', 'k4', 'next_y'],
      };
    }

    if ('index' in sampleStep && 'x' in sampleStep) {
      return {
        headers: ['Index', 'x_i', 'y_i'],
        keys: ['index', 'x', 'y'],
      };
    }

    const keys = Object.keys(sampleStep);
    return {
      headers: keys.map((key) => key.replaceAll('_', ' ')),
      keys,
    };
  };

  const renderSteps = () => {
    if (!steps.length) return null;

    if (typeof steps[0] !== 'object') {
      return (
        <motion.div 
          className="detail-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <h3>Construction Steps</h3>
          <ol className="formula-list">
            {steps.map((step, idx) => (
              <motion.li 
                key={`${step}-${idx}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.05 }}
              >
                {step}
              </motion.li>
            ))}
          </ol>
        </motion.div>
      );
    }

    const { headers, keys } = getStepColumns(steps[0]);

    return (
      <motion.div 
        className="detail-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <h3>Iteration and Step Records</h3>
        <div className="solution-table-wrapper">
          <table className="solution-table">
            <thead>
              <tr>
                {headers.map((header, idx) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {steps.map((step, rowIdx) => (
                <motion.tr 
                  key={rowIdx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + rowIdx * 0.03 }}
                >
                  {keys.map((key) => (
                    <td key={key} title={typeof step[key] === 'string' ? step[key] : undefined}>
                      {formatVal(step[key])}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  const renderDividedDifferenceTable = () => {
    if (result.method !== "Newton's Divided Difference" || !result.table) return null;

    const n = result.table.length;
    const headers = ['x', 'y'];
    for (let index = 1; index < n; index += 1) {
      headers.push(`f[${Array(index + 1).fill('x').join(',')}]`);
    }

    return (
      <motion.div 
        className="detail-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <h3>Divided Difference Table</h3>
        <div className="solution-table-wrapper">
          <table className="solution-table">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.table.map((row, rowIdx) => (
                <motion.tr 
                  key={rowIdx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + rowIdx * 0.05 }}
                >
                  {row.map((value, colIdx) => (
                    <td key={`${rowIdx}-${colIdx}`}>{value === null ? '-' : formatVal(value)}</td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  const renderFormulas = () => {
    if (!result.derivative && !result.polynomial && !result.formula) return null;

    return (
      <motion.div 
        className="detail-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        <h3>Mathematical Formulation</h3>
        {result.derivative && (
          <motion.div 
            className="formula-box"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
          >
            <span>Symbolic Derivative</span>
            <BlockMath math={`f'(x) = ${toLatex(result.derivative)}`} />
          </motion.div>
        )}
        {result.polynomial && (
          <motion.div 
            className="formula-box"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
          >
            <span>Interpolation Polynomial</span>
            <BlockMath math={`P(x) = ${toLatex(result.polynomial)}`} />
          </motion.div>
        )}
        {result.formula && (
          <motion.div 
            className="formula-box"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span>Applied Formula</span>
            <p>{result.formula}</p>
          </motion.div>
        )}
      </motion.div>
    );
  };

  return (
  <div className="solution-view">
    {renderAutoSelection()}
    {renderSummary()}
    <SolutionChart result={result} />
    {renderFormulas()}
    {renderDividedDifferenceTable()}
    {renderSteps()}
  </div>
);
}