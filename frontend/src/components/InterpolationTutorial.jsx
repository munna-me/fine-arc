import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Lightbulb, PartyPopper, XCircle } from 'lucide-react';

// ---------- small numeric/formatting helpers ----------

const SUBSCRIPT_DIGITS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
function sub(n) {
  return String(n).split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('');
}

function fmt(num, decimals = 4) {
  if (num === null || num === undefined || Number.isNaN(num)) return '';
  const rounded = Number(num.toFixed(decimals));
  return rounded.toString();
}

function tolerance(expected, floor = 0.02, relative = 0.02) {
  return Math.max(floor, Math.abs(expected) * relative);
}

// Root-finding methods can run for many iterations (bisection especially).
// Walking through every single one would make the tutorial unwieldy, so we
// interactively teach the first few and then summarize the rest.
const MAX_SHOWN_ITERATIONS = 4;

// Parses "2", "1/3", "x = 2", "≈ -5.33" etc. into a number.
function parseNumeric(raw) {
  if (!raw) return NaN;
  const cleaned = raw.trim().replace(/^[a-zA-Z()=≈\s]+/, '');
  if (cleaned.includes('/')) {
    const [a, b] = cleaned.split('/').map((v) => parseFloat(v.trim()));
    if (!Number.isNaN(a) && !Number.isNaN(b) && b !== 0) return a / b;
  }
  return parseFloat(cleaned);
}

function numberCheck(expected, tol) {
  return (raw) => {
    const value = parseNumeric(raw);
    return !Number.isNaN(value) && Math.abs(value - expected) <= tol;
  };
}

// ---------- step builders, one per supported method ----------

function buildLagrangeSteps(result) {
  const points = result.points || [];
  const n = points.length;
  const xVals = points.map((p) => p.x);
  const targetX = result.target_x;
  const terms = result.steps || [];

  const steps = [
    {
      title: 'Meet the data',
      explanation:
        `We're estimating y at x = ${fmt(targetX)} using these ${n} known points: ` +
        `${points.map((p) => `(${fmt(p.x)}, ${fmt(p.y)})`).join(', ')}. ` +
        "Because the x-values aren't evenly spaced, Lagrange Interpolation is the right tool here — " +
        "it works for any spacing, unlike Newton's Forward/Backward formulas, which need equal steps.",
      question: 'What x-value are we trying to estimate y for?',
      placeholder: `e.g. ${fmt(targetX)}`,
      check: numberCheck(targetX, 0.001),
      hint: "It's stated directly in the sentence above.",
      solution: `x = ${fmt(targetX)} is our target.`,
    },
  ];

  terms.forEach((term, i) => {
    const xi = term.x_val;
    const yi = term.y_val;
    const otherX = xVals.filter((_, j) => j !== i);
    const denom = otherX.reduce((acc, xj) => acc * (xi - xj), 1);
    const numer = otherX.reduce((acc, xj) => acc * (targetX - xj), 1);
    const li = term.term_value;
    const contribution = term.contribution;

    const denomExpr = otherX.map((xj) => `(${fmt(xi)} − ${fmt(xj)})`).join(' × ');
    const numerExpr = otherX.map((xj) => `(${fmt(targetX)} − ${fmt(xj)})`).join(' × ');

    steps.push({
      title: `L${sub(i)}(x) at the target`,
      explanation:
        `For point ${i} (x${sub(i)} = ${fmt(xi)}, y${sub(i)} = ${fmt(yi)}): L${sub(i)}(x) uses every OTHER ` +
        `x-value in the denominator, and the target x in the numerator.\n` +
        `Denominator: ${denomExpr} = ${fmt(denom)}\n` +
        `Numerator at x = ${fmt(targetX)}: ${numerExpr} = ${fmt(numer)}`,
      question: `What is L${sub(i)}(${fmt(targetX)}) = numerator ÷ denominator?`,
      placeholder: `e.g. ${fmt(li, 2)}`,
      check: numberCheck(li, tolerance(li)),
      hint: `Divide ${fmt(numer)} by ${fmt(denom)}.`,
      solution: `${fmt(numer)} ÷ ${fmt(denom)} = ${fmt(li)}.`,
    });

    steps.push({
      title: `Point ${i}'s contribution`,
      explanation: `Each basis term is weighted by its y-value: contribution = y${sub(i)} × L${sub(i)}(target).`,
      question: `What is y${sub(i)} × L${sub(i)}(${fmt(targetX)})? (y${sub(i)} = ${fmt(yi)}, L${sub(i)} ≈ ${fmt(li)})`,
      placeholder: `e.g. ${fmt(contribution, 2)}`,
      check: numberCheck(contribution, tolerance(contribution)),
      hint: `Multiply ${fmt(yi)} by ${fmt(li)}.`,
      solution: `${fmt(yi)} × ${fmt(li)} ≈ ${fmt(contribution)}.`,
    });
  });

  steps.push({
    title: 'Sum it all up',
    explanation:
      `Lagrange's final estimate is the sum of all ${n} contributions:\n` +
      terms.map((t, i) => `contribution${sub(i)} ≈ ${fmt(t.contribution)}`).join('\n'),
    question: `Add all the contributions together. What is P(${fmt(targetX)})?`,
    placeholder: `e.g. ${fmt(result.interpolated_y, 2)}`,
    check: numberCheck(result.interpolated_y, tolerance(result.interpolated_y)),
    hint: 'Add up every contribution value listed above.',
    solution: `The sum comes to ${fmt(result.interpolated_y)} — matching Fine Arc's computed answer.`,
  });

  return steps;
}

function buildNewtonDiffSteps(result, direction) {
  const isForward = direction === 'forward';
  const points = result.points || [];
  const targetX = result.target_x;
  const s = result.s;
  const h = result.h;
  const anchorX = isForward ? result.x0 : result.xn;
  const anchorLabel = isForward ? 'x₀' : 'xₙ';
  const anchorYLabel = isForward ? 'y₀' : 'yₙ';
  const anchorY = isForward ? points[0].y : points[points.length - 1].y;
  const deltaSymbol = isForward ? 'Δ' : '∇';
  const allTerms = result.steps || [];
  const workingTerms = allTerms.slice(1); // term_index 0 is just the anchor y, not a question

  const steps = [
    {
      title: 'Set up s',
      explanation:
        `Our points are evenly spaced with step size h = ${fmt(h)}. ${isForward ? "Newton's Forward" : "Newton's Backward"} ` +
        `formula uses s = (x − ${anchorLabel}) / h, where ${anchorLabel} = ${fmt(anchorX)} and we want x = ${fmt(targetX)}.`,
      question: `Compute s = (${fmt(targetX)} − ${fmt(anchorX)}) / ${fmt(h)}`,
      placeholder: `e.g. ${fmt(s, 2)}`,
      check: numberCheck(s, tolerance(s, 0.02)),
      hint: `First subtract: ${fmt(targetX)} − ${fmt(anchorX)} = ${fmt(targetX - anchorX)}. Then divide by ${fmt(h)}.`,
      solution: `(${fmt(targetX)} − ${fmt(anchorX)}) / ${fmt(h)} = ${fmt(s)}.`,
    },
  ];

  workingTerms.forEach((term) => {
    const k = term.term_index;
    const label = `${deltaSymbol}${k > 1 ? `^${k}` : ''}${isForward ? '₀' : 'ₙ'}`;
    const factorList = Array.from({ length: k }, (_, idx) =>
      isForward ? `(s − ${idx})` : `(s + ${idx})`
    ).join('');

    steps.push({
      title: `Term k = ${k}: the s-product`,
      explanation:
        `Each term multiplies in one more factor of s. For k = ${k}, the s-product is ${factorList} ≈ ${fmt(term.s_product)} ` +
        `(using s ≈ ${fmt(s)}).`,
      question: `What is the s-product for this term (k = ${k})? Round to 2 decimals.`,
      placeholder: `e.g. ${fmt(term.s_product, 2)}`,
      check: numberCheck(term.s_product, tolerance(term.s_product)),
      hint: `Multiply out ${factorList} using s ≈ ${fmt(s)}.`,
      solution: `The s-product ≈ ${fmt(term.s_product)}.`,
    });

    steps.push({
      title: `Term k = ${k}: contribution`,
      explanation:
        `This term's contribution is (s-product ÷ ${k}!) × ${label}, where ${label} = ${fmt(term.delta_value)} ` +
        `(read from the difference table) and ${k}! = ${term.factorial}.`,
      question: "What is this term's contribution to P(x)?",
      placeholder: `e.g. ${fmt(term.contribution, 2)}`,
      check: numberCheck(term.contribution, tolerance(term.contribution)),
      hint: `(${fmt(term.s_product)} ÷ ${term.factorial}) × ${fmt(term.delta_value)} = ?`,
      solution: `Contribution ≈ ${fmt(term.contribution)}.`,
    });
  });

  steps.push({
    title: 'Sum it all up',
    explanation:
      `P(x) = ${anchorYLabel} + the sum of every term's contribution above.\n` +
      `${anchorYLabel} = ${fmt(anchorY)}, and the contributions were: ${workingTerms.map((t) => fmt(t.contribution)).join(', ')}`,
    question: `Add ${anchorYLabel} plus every contribution. What is P(${fmt(targetX)})?`,
    placeholder: `e.g. ${fmt(result.interpolated_y, 2)}`,
    check: numberCheck(result.interpolated_y, tolerance(result.interpolated_y)),
    hint: `Start with ${fmt(anchorY)} and add each contribution in turn.`,
    solution: `The total comes to ${fmt(result.interpolated_y)} — matching Fine Arc's computed answer.`,
  });

  return steps;
}

function buildBisectionSteps(result) {
  const equation = result.equation;
  const allSteps = result.steps || [];
  if (!allSteps.length) return [];

  const shownCount = Math.min(allSteps.length, MAX_SHOWN_ITERATIONS);
  const first = allSteps[0];

  const steps = [
    {
      title: 'Confirm the bracket',
      explanation:
        `We're solving f(x) = ${equation} = 0 on the interval [${fmt(first.a)}, ${fmt(first.b)}]. ` +
        'Bisection only needs one thing to get started: f(a) and f(b) must have opposite signs. ' +
        "That's the Intermediate Value Theorem at work — if a continuous function is positive at one " +
        'end and negative at the other, it must cross zero somewhere in between.',
      question: `What is f(a) at a = ${fmt(first.a)}?`,
      placeholder: `e.g. ${fmt(first.fa, 2)}`,
      check: numberCheck(first.fa, tolerance(first.fa)),
      hint: `Substitute a = ${fmt(first.a)} into f(x) = ${equation}.`,
      solution: `f(${fmt(first.a)}) = ${fmt(first.fa)}.`,
    },
  ];

  for (let idx = 0; idx < shownCount; idx += 1) {
    const step = allSteps[idx];
    const next = allSteps[idx + 1];
    const iterNum = step.iteration;

    steps.push({
      title: `Iteration ${iterNum}: find the midpoint`,
      explanation:
        `With a = ${fmt(step.a)} and b = ${fmt(step.b)}, bisection always guesses the exact middle of the interval.`,
      question: 'What is c = (a + b) / 2?',
      placeholder: `e.g. ${fmt(step.c, 2)}`,
      check: numberCheck(step.c, tolerance(step.c)),
      hint: `(${fmt(step.a)} + ${fmt(step.b)}) / 2 = ?`,
      solution: `c = ${fmt(step.c)}.`,
    });

    const sameSignAsA = step.fa * step.fc > 0;
    const keptSide = sameSignAsA ? `[${fmt(step.c)}, ${fmt(step.b)}]` : `[${fmt(step.a)}, ${fmt(step.c)}]`;

    steps.push({
      title: `Iteration ${iterNum}: evaluate f(c)`,
      explanation:
        'Now check the sign of f at the midpoint — whichever half still changes sign is where the root hides. ' +
        `We already know f(a) = ${fmt(step.fa)} and f(b) = ${fmt(step.fb)}.`,
      question: `What is f(c) at c = ${fmt(step.c)}?`,
      placeholder: `e.g. ${fmt(step.fc, 2)}`,
      check: numberCheck(step.fc, tolerance(step.fc)),
      hint: `Substitute c = ${fmt(step.c)} into f(x) = ${equation}.`,
      solution:
        `f(${fmt(step.c)}) = ${fmt(step.fc)}. That's the ${sameSignAsA ? 'same' : 'opposite'} sign as f(a), ` +
        `so the root must be in ${keptSide} — that becomes our next bracket` +
        (next ? ` (a = ${fmt(next.a)}, b = ${fmt(next.b)}).` : '.'),
    });
  }

  const moreIterations = allSteps.length - shownCount;

  steps.push({
    title: 'Wrap-up: the converged root',
    explanation:
      moreIterations > 0
        ? `Bisection just keeps repeating this halving step. Fine Arc carried on for ${moreIterations} more ` +
          `iteration${moreIterations === 1 ? '' : 's'} the same way, until the bracket shrank below the tolerance.`
        : "That was every iteration Fine Arc needed — the bracket has shrunk right down to the root.",
    question: 'What is the final root, x?',
    placeholder: `e.g. ${fmt(result.root, 2)}`,
    check: numberCheck(result.root, tolerance(result.root)),
    hint: 'Look at how tight the bracket has become in the last iteration — c is essentially the root.',
    solution:
      `The root is x ≈ ${fmt(result.root)}` +
      (result.converged
        ? " — matching Fine Arc's computed answer."
        : ' (Fine Arc stopped at the iteration limit before fully converging).'),
  });

  return steps;
}

function buildNewtonRaphsonSteps(result) {
  const equation = result.equation;
  const derivative = result.derivative;
  const allSteps = result.steps || [];
  if (!allSteps.length) return [];

  const shownCount = Math.min(allSteps.length, MAX_SHOWN_ITERATIONS);
  const first = allSteps[0];

  const steps = [
    {
      title: 'Meet the function and its derivative',
      explanation:
        `We're solving f(x) = ${equation} = 0, starting from x₀ = ${fmt(first.xi)}. Newton-Raphson uses calculus: ` +
        'at each guess, it follows the tangent line down to where it crosses the x-axis. Its derivative works ' +
        `out to f'(x) = ${derivative}.`,
      question: `What is f(x₀) at x₀ = ${fmt(first.xi)}?`,
      placeholder: `e.g. ${fmt(first.f_xi, 2)}`,
      check: numberCheck(first.f_xi, tolerance(first.f_xi)),
      hint: `Substitute x₀ = ${fmt(first.xi)} into f(x) = ${equation}.`,
      solution: `f(${fmt(first.xi)}) = ${fmt(first.f_xi)}.`,
    },
  ];

  for (let idx = 0; idx < shownCount; idx += 1) {
    const step = allSteps[idx];
    const iterNum = step.iteration;

    steps.push({
      title: `Iteration ${iterNum}: the derivative`,
      explanation: `At xᵢ = ${fmt(step.xi)}, we need the tangent line's slope: f'(xᵢ), using f'(x) = ${derivative}.`,
      question: `What is f'(xᵢ) at xᵢ = ${fmt(step.xi)}?`,
      placeholder: `e.g. ${fmt(step.df_xi, 2)}`,
      check: numberCheck(step.df_xi, tolerance(step.df_xi)),
      hint: `Substitute xᵢ = ${fmt(step.xi)} into f'(x) = ${derivative}.`,
      solution: `f'(${fmt(step.xi)}) = ${fmt(step.df_xi)}.`,
    });

    steps.push({
      title: `Iteration ${iterNum}: follow the tangent down`,
      explanation:
        'Newton-Raphson\'s update rule is xᵢ₊₁ = xᵢ − f(xᵢ) / f\'(xᵢ). Here ' +
        `f(xᵢ) = ${fmt(step.f_xi)} and f'(xᵢ) = ${fmt(step.df_xi)}.`,
      question: 'What is xᵢ₊₁?',
      placeholder: `e.g. ${fmt(step.xi_next, 2)}`,
      check: numberCheck(step.xi_next, tolerance(step.xi_next)),
      hint: `${fmt(step.xi)} − (${fmt(step.f_xi)} ÷ ${fmt(step.df_xi)}) = ?`,
      solution: `xᵢ₊₁ = ${fmt(step.xi_next)}.`,
    });
  }

  const moreIterations = allSteps.length - shownCount;

  steps.push({
    title: 'Wrap-up: the converged root',
    explanation:
      moreIterations > 0
        ? 'Newton-Raphson keeps following the tangent line the same way. Fine Arc carried on for ' +
          `${moreIterations} more iteration${moreIterations === 1 ? '' : 's'}, converging fast — that's ` +
          "Newton-Raphson's signature speed."
        : 'That was every iteration Fine Arc needed — Newton-Raphson typically converges in just a handful of steps.',
    question: 'What is the final root, x?',
    placeholder: `e.g. ${fmt(result.root, 2)}`,
    check: numberCheck(result.root, tolerance(result.root)),
    hint: 'Look at xᵢ₊₁ from the last iteration — it should already be very close to the root.',
    solution:
      `The root is x ≈ ${fmt(result.root)}` +
      (result.converged
        ? " — matching Fine Arc's computed answer."
        : ' (Fine Arc stopped at the iteration limit before fully converging).'),
  });

  return steps;
}

function buildSecantSteps(result) {
  const equation = result.equation;
  const allSteps = result.steps || [];
  if (!allSteps.length) return [];

  const shownCount = Math.min(allSteps.length, MAX_SHOWN_ITERATIONS);
  const first = allSteps[0];

  const steps = [
    {
      title: 'Meet your two starting guesses',
      explanation:
        `We're solving f(x) = ${equation} = 0. Unlike Newton-Raphson, Secant skips calculus entirely — instead ` +
        `it needs TWO starting guesses, x₀ = ${fmt(first.x_prev)} and x₁ = ${fmt(first.x_curr)}, and draws a ` +
        'straight line through those two points on the curve to estimate where it crosses zero.',
      question: 'What is our second starting guess, x₁?',
      placeholder: `e.g. ${fmt(first.x_curr, 2)}`,
      check: numberCheck(first.x_curr, tolerance(first.x_curr)),
      hint: "It's stated directly in the problem, right alongside x₀.",
      solution: `x₁ = ${fmt(first.x_curr)}.`,
    },
  ];

  for (let idx = 0; idx < shownCount; idx += 1) {
    const step = allSteps[idx];
    const iterNum = step.iteration;

    steps.push({
      title: `Iteration ${iterNum}: draw the secant line`,
      explanation:
        'Fine Arc draws a straight line through the two most recent points on the curve — at ' +
        `x = ${fmt(step.x_prev)} and x = ${fmt(step.x_curr)} — and follows it down to where it crosses zero. ` +
        `That gives the next estimate: x ≈ ${fmt(step.x_next)}. Let's check that guess is actually close to a root.`,
      question: `What is f(x) at this new estimate, x = ${fmt(step.x_next)}?`,
      placeholder: `e.g. ${fmt(step.f_next, 2)}`,
      check: numberCheck(step.f_next, tolerance(step.f_next)),
      hint: `Substitute x = ${fmt(step.x_next)} into f(x) = ${equation}.`,
      solution: `f(${fmt(step.x_next)}) = ${fmt(step.f_next)} — much closer to zero than before.`,
    });

    steps.push({
      title: `Iteration ${iterNum}: measure the progress`,
      explanation:
        `We track convergence with error = |x_next − x_curr|, using x_curr = ${fmt(step.x_curr)} and the new ` +
        `x_next = ${fmt(step.x_next)}.`,
      question: 'What is the error for this iteration?',
      placeholder: `e.g. ${fmt(step.error, 4)}`,
      check: numberCheck(step.error, tolerance(step.error, 0.001)),
      hint: `|${fmt(step.x_next)} − ${fmt(step.x_curr)}| = ?`,
      solution: `error = ${fmt(step.error)}.`,
    });
  }

  const moreIterations = allSteps.length - shownCount;

  steps.push({
    title: 'Wrap-up: the converged root',
    explanation:
      moreIterations > 0
        ? 'Secant keeps sliding a straight line through the last two points the same way. Fine Arc carried on ' +
          `for ${moreIterations} more iteration${moreIterations === 1 ? '' : 's'}, until the error dropped below ` +
          'the tolerance.'
        : 'That was every iteration Fine Arc needed to converge.',
    question: 'What is the final root, x?',
    placeholder: `e.g. ${fmt(result.root, 2)}`,
    check: numberCheck(result.root, tolerance(result.root)),
    hint: 'Look at the x_next from the last iteration — it should already be essentially the root.',
    solution:
      `The root is x ≈ ${fmt(result.root)}` +
      (result.converged
        ? " — matching Fine Arc's computed answer."
        : ' (Fine Arc stopped at the iteration limit before fully converging).'),
  });

  return steps;
}

export function isTutorialSupported(method) {
  return (
    method === 'Lagrange Interpolation' ||
    method === "Newton's Forward Difference Formula" ||
    method === "Newton's Backward Difference Formula" ||
    method === 'Bisection Method' ||
    method === 'Newton-Raphson Method' ||
    method === 'Secant Method'
  );
}

function buildStepsFromResult(result) {
  if (!result) return [];
  if (result.method === 'Lagrange Interpolation') return buildLagrangeSteps(result);
  if (result.method === "Newton's Forward Difference Formula") return buildNewtonDiffSteps(result, 'forward');
  if (result.method === "Newton's Backward Difference Formula") return buildNewtonDiffSteps(result, 'backward');
  if (result.method === 'Bisection Method') return buildBisectionSteps(result);
  if (result.method === 'Newton-Raphson Method') return buildNewtonRaphsonSteps(result);
  if (result.method === 'Secant Method') return buildSecantSteps(result);
  return [];
}

// ---------- the interactive component ----------

export default function InterpolationTutorial({ result, onExit }) {
  const STEPS = useMemo(() => buildStepsFromResult(result), [result]);

  const [stepIndex, setStepIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [completed, setCompleted] = useState(false);

  if (!STEPS.length) {
    return (
      <div className="solver-card tutorial-card">
        <p className="tutorial-explanation">
          A step-by-step tutorial isn't available for this method yet.
        </p>
        <button type="button" className="btn-secondary" onClick={onExit}>
          <ArrowLeft size={16} />
          Back to solution
        </button>
      </div>
    );
  }

  const totalSteps = STEPS.length;
  const step = STEPS[stepIndex];
  const progressPct = completed ? 100 : Math.round((stepIndex / totalSteps) * 100);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!answer.trim()) return;

    if (step.check(answer)) {
      setFeedback({ correct: true, message: 'Correct!' });
    } else {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setFeedback({
        correct: false,
        message: nextAttempts >= 2 ? step.solution : step.hint,
        isFullSolution: nextAttempts >= 2,
      });
    }
  };

  const goToNextStep = () => {
    if (stepIndex + 1 >= totalSteps) {
      setCompleted(true);
    } else {
      setStepIndex((i) => i + 1);
    }
    setAnswer('');
    setAttempts(0);
    setFeedback(null);
  };

  if (completed) {
    const finalAnswer = result.root !== undefined ? result.root : result.interpolated_y;

    return (
      <div className="solver-card tutorial-card">
        <motion.div
          className="tutorial-complete"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <PartyPopper size={40} />
          <h2>Nice work!</h2>
          <p>
            You just walked through {result.method} by hand for your own problem, arriving at the same
            answer Fine Arc computed: {fmt(finalAnswer)}.
          </p>
          <button type="button" className="btn-secondary" onClick={onExit}>
            <ArrowLeft size={16} />
            Back to solution
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="solver-card tutorial-card">
      <div className="card-heading">
        <span>
          <strong>Let's break this down</strong>
          <small>{result.method}, step by step</small>
        </span>
      </div>

      <div className="tutorial-progress">
        <div className="tutorial-progress-bar">
          <motion.div
            className="tutorial-progress-fill"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="tutorial-progress-label">
          Step {stepIndex + 1} of {totalSteps}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
        >
          <h3 className="tutorial-step-title">{step.title}</h3>
          <p className="tutorial-explanation">{step.explanation}</p>

          <form onSubmit={handleSubmit}>
            <label className="field-block auth-field">
              <span>{step.question}</span>
              <input
                type="text"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={step.placeholder}
                autoFocus
                disabled={feedback?.correct}
              />
            </label>

            <AnimatePresence mode="wait">
              {feedback && (
                <motion.div
                  key={feedback.correct ? 'correct' : `wrong-${attempts}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={feedback.correct ? 'tutorial-feedback correct' : 'tutorial-feedback incorrect'}
                >
                  {feedback.correct ? (
                    <CheckCircle2 size={18} />
                  ) : feedback.isFullSolution ? (
                    <Lightbulb size={18} />
                  ) : (
                    <XCircle size={18} />
                  )}
                  <span>{feedback.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {feedback?.correct ? (
              <motion.button
                type="button"
                className="btn-primary full-width auth-submit"
                onClick={goToNextStep}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {stepIndex + 1 >= totalSteps ? 'Finish' : 'Continue'}
              </motion.button>
            ) : (
              <motion.button
                type="submit"
                className="btn-primary full-width auth-submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Submit
              </motion.button>
            )}
          </form>
        </motion.div>
      </AnimatePresence>

      <button type="button" className="btn-secondary tutorial-exit" onClick={onExit}>
        <ArrowLeft size={16} />
        Back to solution
      </button>
    </div>
  );
}