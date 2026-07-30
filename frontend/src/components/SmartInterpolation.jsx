import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Equal, Plus, Shuffle, Trash2, Wand2 } from 'lucide-react';
import { apiFetch } from '../api/client';

const EQUAL_SAMPLE = [
  { x: '1', y: '1' },
  { x: '2', y: '4' },
  { x: '3', y: '9' },
  { x: '4', y: '16' },
];

const UNEQUAL_SAMPLE = [
  { x: '1', y: '2' },
  { x: '2.5', y: '6' },
  { x: '4', y: '17' },
  { x: '7', y: '50' },
];

function parsePointValues(points) {
  return points.map((point) => ({
    x: parseFloat(point.x),
    y: parseFloat(point.y),
  }));
}

function detectSpacing(xValues) {
  if (xValues.length < 2) return 'equal';
  const diffs = [];
  for (let index = 0; index < xValues.length - 1; index += 1) {
    diffs.push(xValues[index + 1] - xValues[index]);
  }
  return Math.max(...diffs) - Math.min(...diffs) < 1e-9 ? 'equal' : 'unequal';
}

function getPreview(points, targetValue, intervalType, solveFor) {
  const parsed = parsePointValues(points);
  const xValues = parsed.map((point) => point.x);
  const target = parseFloat(targetValue);

  if (xValues.some(Number.isNaN) || Number.isNaN(target) || xValues.length < 2) {
    return null;
  }

  const detected = detectSpacing(xValues);
  const targetLabel = solveFor === 'x' ? 'Target y' : 'Target x';
  const resultLabel = solveFor === 'x' ? 'Interpolated x' : 'Interpolated y';

  if (intervalType === 'equal') {
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const midpoint = (minX + maxX) / 2;
    const nearStart = target <= midpoint;

    return {
      icon: nearStart ? ArrowRight : Shuffle,
      tone: nearStart ? 'blue' : 'purple',
      interval: 'Equal Interval',
      detected,
      method: nearStart ? "Newton's Forward Formula" : "Newton's Backward Formula",
      rule: nearStart
        ? `${targetLabel} is near the start of ${minX} to ${maxX}.`
        : `${targetLabel} is near the end of ${minX} to ${maxX}.`,
    };
  }

  return {
    icon: Equal,
    tone: 'green',
    interval: 'Unequal Interval',
    detected,
    method: 'Lagrange Interpolation',
    rule: 'Unequal interval selected, so Lagrange is used automatically.',
  };
}

export default function SmartInterpolation({ onResult }) {
  const [intervalType, setIntervalType] = useState('equal');
  const [points, setPoints] = useState(EQUAL_SAMPLE);
  const [targetValue, setTargetValue] = useState('2.5');
  const [solveFor, setSolveFor] = useState('y'); // 'y' for y at x, 'x' for x at y
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const preview = getPreview(points, targetValue, intervalType, solveFor);

  const setSample = (type) => {
    setIntervalType(type);
    if (type === 'equal') {
      setPoints(EQUAL_SAMPLE);
      setTargetValue('2.5');
    } else {
      setPoints(UNEQUAL_SAMPLE);
      setTargetValue('2');
    }
    setError(null);
  };

  const addPoint = () => setPoints([...points, { x: '', y: '' }]);

  const removePoint = (idx) => {
    if (points.length <= 2) return;
    setPoints(points.filter((_, index) => index !== idx));
  };

  const updatePoint = (idx, field, value) => {
    const nextPoints = [...points];
    nextPoints[idx] = { ...nextPoints[idx], [field]: value };
    setPoints(nextPoints);
  };

  const handleSolve = async () => {
    setError(null);
    const parsed = parsePointValues(points);
    const x_pts = parsed.map((point) => point.x);
    const y_pts = parsed.map((point) => point.y);
    const target = parseFloat(targetValue);

    if (x_pts.some(Number.isNaN) || y_pts.some(Number.isNaN)) {
      setError('Every x and y value must be a valid number.');
      return;
    }
    if (points.length < 2) {
      setError('At least two points are required.');
      return;
    }
    if (Number.isNaN(target)) {
      setError('Target value must be a valid number.');
      return;
    }

    setLoading(true);
    try {
      // For inverse interpolation, we can swap x and y and use the same endpoint
      let requestData;
      if (solveFor === 'x') {
        // Inverse interpolation: find x given y
        requestData = {
          x_pts: y_pts, // Swap x and y
          y_pts: x_pts,
          target_x: target, // Target is the y value
          interval_type: intervalType
        };
      } else {
        // Normal interpolation: find y given x
        requestData = {
          x_pts,
          y_pts,
          target_x: target,
          interval_type: intervalType
        };
      }

      const res = await apiFetch('/smart-interpolate', {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
      let data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Interpolation failed.');

      // If we did inverse interpolation, swap back the results for display
      if (solveFor === 'x') {
        data = {
          ...data,
          method: `Inverse ${data.method}`,
          target_x: target,
          interpolated_y: data.interpolated_y,
          interpolated_x: data.interpolated_y, // We're finding x
          points: points,
          // Swap x and y in points for display
          points_display: points.map(p => ({ x: p.y, y: p.x }))
        };
        // Also update result to show we found x instead of y
        if (data.auto_selection) {
          data.auto_selection = {
            ...data.auto_selection,
            selected_method: `Inverse ${data.auto_selection.selected_method}`
          };
        }
      }

      onResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const PreviewIcon = preview?.icon ?? Brain;

  return (
    <motion.div 
      className="solver-card smart-card"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="card-heading">
        <span className="mode-icon">
          <Brain size={22} />
        </span>
        <div>
          <h3>Smart Interpolation</h3>
          <p>Choose the interval type. Fine Arc selects the right formula automatically.</p>
        </div>
      </div>

      <div className="interval-grid" aria-label="Interval type">
        <motion.button
          type="button"
          className={`interval-option ${intervalType === 'equal' ? 'active' : ''}`}
          onClick={() => setIntervalType('equal')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Equal size={22} />
          <strong>Equal Interval</strong>
          <span>Chooses Newton Forward near the start or Backward near the end.</span>
        </motion.button>
        <motion.button
          type="button"
          className={`interval-option ${intervalType === 'unequal' ? 'active' : ''}`}
          onClick={() => setIntervalType('unequal')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Shuffle size={22} />
          <strong>Unequal Interval</strong>
          <span>Uses Lagrange because Forward and Backward require equal spacing.</span>
        </motion.button>
      </div>

      {/* New: Solve For selector */}
      <div className="interval-grid" style={{ marginTop: '16px' }} aria-label="Solve for">
        <motion.button
          type="button"
          className={`interval-option ${solveFor === 'y' ? 'active' : ''}`}
          onClick={() => setSolveFor('y')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <strong>Find y for given x</strong>
          <span>Standard interpolation: Compute y at a specific x value.</span>
        </motion.button>
        <motion.button
          type="button"
          className={`interval-option ${solveFor === 'x' ? 'active' : ''}`}
          onClick={() => setSolveFor('x')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <strong>Find x for given y</strong>
          <span>Inverse interpolation: Compute x at a specific y value.</span>
        </motion.button>
      </div>

      <div className="sample-actions">
        <motion.button 
          type="button" 
          className="btn-quiet" 
          onClick={() => setSample('equal')}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Fill Equal Sample
        </motion.button>
        <motion.button 
          type="button" 
          className="btn-quiet" 
          onClick={() => setSample('unequal')}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Fill Unequal Sample
        </motion.button>
      </div>

      <motion.div 
        className={`preview-panel tone-${preview?.tone ?? 'neutral'}`}
        key={preview?.method}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {preview && <PreviewIcon size={22} />}
        <div>
          <span>{preview ? preview.interval : 'Waiting for valid point data'}</span>
          <strong>{preview ? preview.method : 'Enter points and a target value'}</strong>
          {preview && <p>{preview.rule} Detected spacing: {preview.detected}.</p>}
        </div>
      </motion.div>

      <div className="data-table-card">
        <div className="table-toolbar">
          <span>Data Points</span>
          <motion.button 
            type="button" 
            className="btn-quiet" 
            onClick={addPoint}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus size={16} />
            Add Row
          </motion.button>
        </div>

        <div className="editable-table-wrapper">
          <table className="editable-table">
            <thead>
              <tr>
                <th>#</th>
                <th>x value</th>
                <th>y = f(x)</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, idx) => (
                <motion.tr 
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <td>{idx + 1}</td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={point.x}
                      onChange={(event) => updatePoint(idx, 'x', event.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      value={point.y}
                      onChange={(event) => updatePoint(idx, 'y', event.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <motion.button
                      type="button"
                      className="icon-button danger"
                      onClick={() => removePoint(idx)}
                      disabled={points.length <= 2}
                      aria-label={`Remove point ${idx + 1}`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <label className="field-block">
        <span>Find {solveFor === 'y' ? 'y' : 'x'} at {solveFor === 'y' ? 'x' : 'y'} =</span>
        <input
          type="number"
          step="any"
          value={targetValue}
          onChange={(event) => setTargetValue(event.target.value)}
          placeholder={`Enter target ${solveFor === 'y' ? 'x' : 'y'}`}
        />
      </label>

      {error && <div className="inline-error">{error}</div>}

      <motion.button 
        type="button" 
        className="btn-primary full-width" 
        onClick={handleSolve} 
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Wand2 size={18} />
        {loading ? 'Running Selection...' : 'Run Smart Interpolation'}
      </motion.button>
    </motion.div>
  );
}
