import React, { useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const INTERPOLATION_METHODS = [
  'Lagrange Interpolation',
  "Newton's Forward Difference Formula",
  "Newton's Backward Difference Formula",
  "Newton's Divided Difference",
];
const TRAJECTORY_METHODS = ["Euler's Method (ODE)", 'Runge-Kutta 4th Order (RK4)'];
const CONVERGENCE_METHODS = ['Bisection Method', 'False Position Method', 'Newton-Raphson Method', 'Secant Method'];
const OPEN_METHODS = ['Newton-Raphson Method', 'Secant Method']; // steps carry xi/x_prev, no bracket
const INTEGRATION_PREFIX = 'Numerical Integration';

// The interpolating polynomial through a fixed set of points is
// mathematically unique regardless of which formula built it — so this one
// Lagrange evaluator gives an accurate curve whether the backend actually
// used Lagrange, Newton Forward, Newton Backward, or Divided Difference.
function lagrangeInterpolate(xPts, yPts, x) {
  const n = xPts.length;
  let total = 0;
  for (let i = 0; i < n; i += 1) {
    let term = yPts[i];
    for (let j = 0; j < n; j += 1) {
      if (j !== i) {
        term *= (x - xPts[j]) / (xPts[i] - xPts[j]);
      }
    }
    total += term;
  }
  return total;
}

function buildInterpolationCurve(points, sampleCount = 80) {
  const xVals = points.map((p) => p.x);
  const yVals = points.map((p) => p.y);
  const minX = Math.min(...xVals);
  const maxX = Math.max(...xVals);
  const margin = (maxX - minX) * 0.15 || 1;
  const start = minX - margin;
  const end = maxX + margin;
  const step = (end - start) / (sampleCount - 1);

  const curve = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const x = start + i * step;
    curve.push({ x, y: lagrangeInterpolate(xVals, yVals, x) });
  }
  return curve;
}

function buildTrajectory(result) {
  const steps = result.steps || [];
  const points = [{ x: result.x0, y: result.y0 }];
  steps.forEach((s) => points.push({ x: s.next_x, y: s.next_y }));
  return points;
}

function buildConvergenceSeries(result) {
  const steps = result.steps || [];
  if (!steps.length) return [];
  if ('c' in steps[0]) {
    return steps.map((s) => ({ iteration: s.iteration, estimate: s.c }));
  }
  if ('xi_next' in steps[0]) {
    return steps.map((s) => ({ iteration: s.iteration, estimate: s.xi_next }));
  }
  if ('x_next' in steps[0]) {
    return steps.map((s) => ({ iteration: s.iteration, estimate: s.x_next }));
  }
  return [];
}

// Tangent line at a single Newton-Raphson iteration: y = f_xi + df_xi*(x - xi).
// Drawn only across a short span around xi so it reads as a local tangent
// rather than a line across the whole chart.
function buildTangentSegment(step, curveDomain) {
  const span = (curveDomain[1] - curveDomain[0]) * 0.18 || 1;
  const x1 = step.xi - span / 2;
  const x2 = step.xi + span / 2;
  return [
    { x: x1, y: step.f_xi + step.df_xi * (x1 - step.xi) },
    { x: x2, y: step.f_xi + step.df_xi * (x2 - step.xi) },
  ];
}

// Secant line through the two points a given iteration drew its guess from:
// (x_prev, f_prev) and (x_curr, f_curr).
function buildSecantSegment(step) {
  return [
    { x: step.x_prev, y: step.f_prev },
    { x: step.x_curr, y: step.f_curr },
  ];
}

export function isChartSupported(result) {
  if (!result || !result.method) return false;

  if (INTERPOLATION_METHODS.includes(result.method)) {
    return (
      !result.method.includes('Inverse') &&
      result.interpolated_y !== undefined &&
      Array.isArray(result.points) &&
      result.points.length >= 2
    );
  }
  if (TRAJECTORY_METHODS.includes(result.method)) {
    return Array.isArray(result.steps) && result.steps.length > 0;
  }
  if (CONVERGENCE_METHODS.includes(result.method)) {
    return Array.isArray(result.steps) && result.steps.length > 0;
  }
  if (result.method.startsWith(INTEGRATION_PREFIX)) {
    return Array.isArray(result.curve) && result.curve.length >= 2;
  }
  return false;
}

// Curve/tangent charts need the backend-sampled f(x) — only render them when
// it's actually present, so results from an older cached response (or a
// backend that hasn't been redeployed yet) fall back to the convergence
// chart alone instead of rendering a broken empty chart. Also requires at
// least 2 points: a domain-restricted equation (e.g. log(x) padded into
// negative x) can legitimately sample down to an empty or single-point
// curve, and FunctionTangentChart needs two points to read a domain from.
function hasFunctionCurve(result) {
  return Array.isArray(result.curve) && result.curve.length >= 2;
}

const axisTick = { fill: 'var(--muted)', fontSize: 12 };
const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  fontSize: 12,
};

function InterpolationChart({ result }) {
  const curve = buildInterpolationCurve(result.points);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tick={axisTick} />
        <YAxis type="number" dataKey="y" tick={axisTick} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(4)} />
        <Line
          data={curve}
          type="monotone"
          dataKey="y"
          stroke="var(--blue)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="Interpolating curve"
        />
        <Scatter data={result.points} dataKey="y" fill="var(--text)" name="Known points" />
        <Scatter
          data={[{ x: result.target_x, y: result.interpolated_y }]}
          dataKey="y"
          fill="var(--danger)"
          shape="star"
          name="Target"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TrajectoryChart({ result }) {
  const trajectory = buildTrajectory(result);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={trajectory} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={axisTick} />
        <YAxis tick={axisTick} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(4)} />
        <Line
          type="monotone"
          dataKey="y"
          stroke="var(--green)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
          name="y(x)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ConvergenceChart({ result }) {
  const series = buildConvergenceSeries(result);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={series} margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis
          dataKey="iteration"
          tick={axisTick}
          label={{ value: 'Iteration', position: 'insideBottom', offset: -5, fill: 'var(--muted)', fontSize: 12 }}
        />
        <YAxis tick={axisTick} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(6)} />
        {result.root !== undefined && (
          <ReferenceLine
            y={result.root}
            stroke="var(--danger)"
            strokeDasharray="4 4"
            label={{
              value: `root ≈ ${result.root.toFixed(4)}`,
              fill: 'var(--danger)',
              fontSize: 11,
              position: 'insideTopRight',
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="estimate"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
          name="Estimate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FunctionTangentChart({ result }) {
  const steps = result.steps || [];
  const isOpenMethod = OPEN_METHODS.includes(result.method);
  const [iterIdx, setIterIdx] = useState(steps.length - 1);
  const step = steps[iterIdx];

  if (!step) return null;

  const curveXDomain = [result.curve[0].x, result.curve[result.curve.length - 1].x];
  const segment = isOpenMethod
    ? result.method === 'Newton-Raphson Method'
      ? buildTangentSegment(step, curveXDomain)
      : buildSecantSegment(step)
    : null;

  // Bracket methods (Bisection/False Position) don't have a tangent/secant
  // line — instead mark a/b/c on the curve for that iteration.
  const bracketMarkers = !isOpenMethod
    ? [
        { x: step.a, y: step.fa, label: 'a' },
        { x: step.b, y: step.fb, label: 'b' },
        { x: step.c, y: step.fc, label: 'c' },
      ]
    : null;

  const guessX = isOpenMethod ? (step.xi_next ?? step.x_next) : step.c;
  const guessY = isOpenMethod ? 0 : step.fc;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tick={axisTick} />
          <YAxis type="number" dataKey="y" tick={axisTick} />
          <ReferenceLine y={0} stroke="var(--line)" />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(4)} />
          <Line
            data={result.curve}
            type="monotone"
            dataKey="y"
            stroke="var(--blue)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            name="f(x)"
          />
          {segment && (
            <Line
              data={segment}
              type="linear"
              dataKey="y"
              stroke="var(--primary)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              name={result.method === 'Newton-Raphson Method' ? 'Tangent line' : 'Secant line'}
            />
          )}
          {bracketMarkers && (
            <Scatter data={bracketMarkers} dataKey="y" fill="var(--muted)" name="Bracket (a, b, c)" />
          )}
          <Scatter
            data={[{ x: guessX, y: guessY }]}
            dataKey="y"
            fill="var(--danger)"
            shape="star"
            name={`Guess after iteration ${step.iteration}`}
          />
        </ComposedChart>
      </ResponsiveContainer>
      {steps.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input
            type="range"
            min={0}
            max={steps.length - 1}
            value={iterIdx}
            onChange={(e) => setIterIdx(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 90, textAlign: 'right' }}>
            Iteration {step.iteration} / {steps.length}
          </span>
        </div>
      )}
    </div>
  );
}

function IntegrationChart({ result }) {
  // Shade the region under the true curve between a and b, restricted to
  // [a, b] even though `curve` is sampled slightly wider for context.
  const shaded = result.curve.filter((p) => p.x >= result.a && p.x <= result.b);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart margin={{ top: 10, right: 24, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis type="number" dataKey="x" domain={['dataMin', 'dataMax']} tick={axisTick} />
        <YAxis type="number" dataKey="y" tick={axisTick} />
        <ReferenceLine y={0} stroke="var(--line)" />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => Number(v).toFixed(4)} />
        <Area
          data={shaded}
          type="monotone"
          dataKey="y"
          stroke="none"
          fill="var(--primary)"
          fillOpacity={0.25}
          isAnimationActive={false}
          name={`Approximated area (${result.a} to ${result.b})`}
        />
        <Line
          data={result.curve}
          type="monotone"
          dataKey="y"
          stroke="var(--blue)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          name="f(x)"
        />
        <Scatter data={result.steps} dataKey="y" fill="var(--text)" name="Panel points" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default function SolutionChart({ result }) {
  if (!isChartSupported(result)) return null;

  if (INTERPOLATION_METHODS.includes(result.method)) {
    return (
      <div className="detail-card">
        <h3>Visualization</h3>
        <InterpolationChart result={result} />
      </div>
    );
  }

  if (TRAJECTORY_METHODS.includes(result.method)) {
    return (
      <div className="detail-card">
        <h3>Visualization</h3>
        <TrajectoryChart result={result} />
      </div>
    );
  }

  if (CONVERGENCE_METHODS.includes(result.method)) {
    const showFunctionView = hasFunctionCurve(result);
    return (
      <div className="detail-card">
        <h3>Visualization</h3>
        {showFunctionView && <FunctionTangentChart result={result} />}
        <div style={{ marginTop: showFunctionView ? 20 : 0 }}>
          <ConvergenceChart result={result} />
        </div>
      </div>
    );
  }

  if (result.method.startsWith(INTEGRATION_PREFIX)) {
    return (
      <div className="detail-card">
        <h3>Visualization</h3>
        <IntegrationChart result={result} />
      </div>
    );
  }

  return null;
}