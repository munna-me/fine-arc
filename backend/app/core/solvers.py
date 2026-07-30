import sympy as sp
import numpy as np
import math

def parse_equation(eq_str):
    """Parses a math equation string into a SymPy expression and standard symbol x."""
    x = sp.Symbol('x')
    clean_eq = eq_str.replace('^', '**')
    if '=' in clean_eq:
        lhs, rhs = clean_eq.split('=')
        expr = sp.simplify(f"({lhs}) - ({rhs})")
    else:
        expr = sp.simplify(clean_eq)
    return expr, x

def sample_function(f, x_min, x_max, n=200):
    """
    Samples a lambdified f(x) at n evenly-spaced points across [x_min, x_max].

    Used to give the frontend an actual f(x) curve to draw against — e.g. a
    tangent/secant line overlay for root-finding, or a shaded region for
    integration — without the frontend needing to evaluate arbitrary
    user-supplied equation strings itself.

    Points where f(x) isn't real/finite (domain errors, overflow, etc.) are
    dropped rather than crashing the whole solve — a valid root-finding or
    integration result shouldn't be discarded just because the curve has a
    gap somewhere in the padding region.
    """
    if x_max <= x_min:
        x_min, x_max = x_min - 1.0, x_max + 1.0

    xs = np.linspace(x_min, x_max, n)
    curve = []
    for xv in xs:
        try:
            yv = f(xv)
            yv = float(yv)
        except (TypeError, ValueError, ZeroDivisionError):
            continue
        if not math.isfinite(yv):
            continue
        curve.append({"x": float(xv), "y": yv})
    return curve


def padded_range(*values, margin_frac=0.2):
    """
    Smallest-to-largest span across all given values, padded by margin_frac
    on each side. Used to pick a sensible sampling window for methods (like
    Newton-Raphson/Secant) that don't have an explicit [a, b] bracket —
    padding around every x visited during iteration keeps the curve relevant
    to what the user actually saw instead of an arbitrary fixed window.
    """
    lo, hi = min(values), max(values)
    span = hi - lo
    margin = span * margin_frac if span > 0 else max(abs(lo), 1.0) * margin_frac
    return lo - margin, hi + margin


def parse_ode_equation(eq_str):
    """Parses an ODE equation dy/dx = f(x, y) into a SymPy expression and symbols x, y."""
    x, y = sp.symbols('x y')
    clean_eq = eq_str.replace('^', '**')
    if '=' in clean_eq:
        lhs, rhs = clean_eq.split('=')
        expr = sp.simplify(rhs)
    else:
        expr = sp.simplify(clean_eq)
    return expr, x, y

# ==========================================
# FINE ARC SMART INTERVAL DETECTION ENGINE
# ==========================================

def detect_interval_type(x_pts, tol=1e-9):
    """
    Detects whether the given x points form an equal-interval or unequal-interval dataset.
    Returns 'equal' or 'unequal'.
    """
    if len(x_pts) < 2:
        return 'equal'
    diffs = [x_pts[i+1] - x_pts[i] for i in range(len(x_pts) - 1)]
    if max(diffs) - min(diffs) < tol:
        return 'equal'
    return 'unequal'

def detect_query_position(x_pts, target_x):
    """
    Determines if a query point is in the first or second half of the data range.
    Returns 'forward' (near start) or 'backward' (near end).
    """
    x_min = min(x_pts)
    x_max = max(x_pts)
    midpoint = (x_min + x_max) / 2.0
    if target_x <= midpoint:
        return 'forward'
    return 'backward'

def smart_interpolation_selector(x_pts, y_pts, target_x, interval_type=None):
    """
    Fine Arc Smart Interpolation Engine:
    - Uses the selected interval type when provided.
    - Otherwise checks interval type (equal / unequal).
    - For equal intervals: Newton Forward near the start or Newton Backward near the end.
    - For unequal intervals: Lagrange Interpolation.
    
    Returns the result dict with an extra 'auto_selection' key explaining the choice.
    """
    if len(x_pts) != len(y_pts):
        raise ValueError("x and y points list must have the same length.")
    if len(x_pts) < 2:
        raise ValueError("At least two data points are required for interpolation.")

    requested_interval = (interval_type or "auto").strip().lower()
    if requested_interval not in {"auto", "equal", "unequal"}:
        raise ValueError("interval_type must be 'auto', 'equal', or 'unequal'.")

    detected_interval = detect_interval_type(x_pts)
    interval_type = detected_interval if requested_interval == "auto" else requested_interval
    selection_source = "detected" if requested_interval == "auto" else "selected"

    if interval_type == 'equal':
        position = detect_query_position(x_pts, target_x)
        if position == 'forward':
            result = solve_newton_forward(x_pts, y_pts, target_x)
            result['auto_selection'] = {
                'interval_type': 'equal',
                'detected_interval_type': detected_interval,
                'selection_source': selection_source,
                'selected_method': "Newton's Forward Difference Formula",
                'reason': f"Equal interval spacing was selected or detected. Query point x={target_x} is near the start of the data range [{min(x_pts)}, {max(x_pts)}], so Newton's Forward Formula was chosen automatically."
            }
        else:
            result = solve_newton_backward(x_pts, y_pts, target_x)
            result['auto_selection'] = {
                'interval_type': 'equal',
                'detected_interval_type': detected_interval,
                'selection_source': selection_source,
                'selected_method': "Newton's Backward Difference Formula",
                'reason': f"Equal interval spacing was selected or detected. Query point x={target_x} is near the end of the data range [{min(x_pts)}, {max(x_pts)}], so Newton's Backward Formula was chosen automatically."
            }
    else:
        result = solve_lagrange(x_pts, y_pts, target_x)
        result['auto_selection'] = {
            'interval_type': 'unequal',
            'detected_interval_type': detected_interval,
            'selection_source': selection_source,
            'selected_method': 'Lagrange Interpolation',
            'reason': 'Unequal interval spacing was selected or detected. Newton Forward and Backward require equal intervals, so Lagrange Interpolation was chosen automatically.'
        }

    return result


# ==========================================
# 1. ROOT FINDING SOLVERS
# ==========================================

def solve_bisection(eq_str, a, b, tol=1e-6, max_iter=100):
    expr, x = parse_equation(eq_str)
    f = sp.lambdify(x, expr, 'numpy')

    orig_a, orig_b = a, b  # a/b narrow during the loop; keep the original bracket for the chart range
    fa = float(f(a))
    fb = float(f(b))

    if fa * fb > 0:
        raise ValueError(f"Root is not bracketed: f(a) = {fa:.6f}, f(b) = {fb:.6f}. They must have opposite signs.")

    steps = []
    root = None
    converged = False

    for i in range(1, max_iter + 1):
        c = (a + b) / 2.0
        fc = float(f(c))
        error = abs(b - a) / 2.0

        steps.append({
            "iteration": i,
            "a": float(a), "b": float(b), "c": float(c),
            "fa": float(fa), "fb": float(fb), "fc": float(fc),
            "error": float(error)
        })

        if abs(fc) < tol or error < tol:
            root = c
            converged = True
            break

        if fa * fc < 0:
            b = c; fb = fc
        else:
            a = c; fa = fc

    if not converged:
        root = c

    x_lo, x_hi = padded_range(orig_a, orig_b)
    curve = sample_function(f, x_lo, x_hi)

    return {
        "method": "Bisection Method",
        "equation": str(expr),
        "root": float(root),
        "iterations": len(steps),
        "converged": converged,
        "curve": curve,
        "steps": steps
    }

def solve_false_position(eq_str, a, b, tol=1e-6, max_iter=100):
    expr, x = parse_equation(eq_str)
    f = sp.lambdify(x, expr, 'numpy')

    orig_a, orig_b = a, b  # a/b narrow during the loop; keep the original bracket for the chart range
    fa = float(f(a))
    fb = float(f(b))

    if fa * fb > 0:
        raise ValueError(f"Root is not bracketed: f(a) = {fa:.6f}, f(b) = {fb:.6f}. They must have opposite signs.")

    steps = []
    root = None
    converged = False
    prev_c = a

    for i in range(1, max_iter + 1):
        c = (a * fb - b * fa) / (fb - fa)
        fc = float(f(c))
        error = abs(c - prev_c) if i > 1 else abs(b - a)

        steps.append({
            "iteration": i,
            "a": float(a), "b": float(b), "c": float(c),
            "fa": float(fa), "fb": float(fb), "fc": float(fc),
            "error": float(error)
        })

        if abs(fc) < tol or (i > 1 and error < tol):
            root = c
            converged = True
            break

        if fa * fc < 0:
            b = c; fb = fc
        else:
            a = c; fa = fc

        prev_c = c

    if not converged:
        root = c

    x_lo, x_hi = padded_range(orig_a, orig_b)
    curve = sample_function(f, x_lo, x_hi)

    return {
        "method": "False Position Method",
        "equation": str(expr),
        "root": float(root),
        "iterations": len(steps),
        "converged": converged,
        "curve": curve,
        "steps": steps
    }

def solve_newton_raphson(eq_str, x0, tol=1e-6, max_iter=100):
    expr, x = parse_equation(eq_str)
    dexpr = sp.diff(expr, x)
    f = sp.lambdify(x, expr, 'numpy')
    df = sp.lambdify(x, dexpr, 'numpy')

    steps = []
    xi = x0
    converged = False
    root = None

    for i in range(1, max_iter + 1):
        fval = float(f(xi))
        dfval = float(df(xi))

        if abs(dfval) < 1e-12:
            raise ValueError(f"Derivative too small at x = {xi:.6f}")

        xi_next = xi - fval / dfval
        error = abs(xi_next - xi)

        steps.append({
            "iteration": i,
            "xi": float(xi), "f_xi": float(fval),
            "df_xi": float(dfval), "xi_next": float(xi_next),
            "error": float(error)
        })

        if error < tol or abs(fval) < tol:
            root = xi_next
            converged = True
            break

        xi = xi_next

    if not converged:
        root = xi

    # No a/b bracket here, so pad around every x visited during iteration
    # (x0 plus every xi_next) — keeps the curve centered on the path Newton
    # actually took rather than an arbitrary fixed window.
    visited_x = [x0] + [s["xi_next"] for s in steps]
    x_lo, x_hi = padded_range(*visited_x)
    curve = sample_function(f, x_lo, x_hi)

    return {
        "method": "Newton-Raphson Method",
        "equation": str(expr),
        "derivative": str(dexpr),
        "root": float(root),
        "iterations": len(steps),
        "converged": converged,
        "curve": curve,
        "steps": steps
    }

def solve_secant(eq_str, x0, x1, tol=1e-6, max_iter=100):
    expr, x = parse_equation(eq_str)
    f = sp.lambdify(x, expr, 'numpy')

    orig_x0, orig_x1 = x0, x1  # x0/x1 slide forward during the loop; keep the originals for the chart range
    steps = []
    converged = False
    root = None
    f0 = float(f(x0))
    f1 = float(f(x1))

    for i in range(1, max_iter + 1):
        if abs(f1 - f0) < 1e-12:
            raise ValueError(f"Division by zero in Secant method.")

        x_next = x1 - f1 * (x1 - x0) / (f1 - f0)
        f_next = float(f(x_next))
        error = abs(x_next - x1)

        steps.append({
            "iteration": i,
            "x_prev": float(x0), "x_curr": float(x1),
            "f_prev": float(f0), "f_curr": float(f1),
            "x_next": float(x_next), "f_next": float(f_next),
            "error": float(error)
        })

        if error < tol or abs(f_next) < tol:
            root = x_next
            converged = True
            break

        x0, x1 = x1, x_next
        f0, f1 = f1, f_next

    if not converged:
        root = x1

    # No a/b bracket here either — pad around the two starting guesses plus
    # every x_next visited, same reasoning as Newton-Raphson above.
    visited_x = [orig_x0, orig_x1] + [s["x_next"] for s in steps]
    x_lo, x_hi = padded_range(*visited_x)
    curve = sample_function(f, x_lo, x_hi)

    return {
        "method": "Secant Method",
        "equation": str(expr),
        "root": float(root),
        "iterations": len(steps),
        "converged": converged,
        "curve": curve,
        "steps": steps
    }


# ==========================================
# 2. INTERPOLATION SOLVERS
# ==========================================

def solve_lagrange(x_pts, y_pts, target_x):
    n = len(x_pts)
    if n != len(y_pts):
        raise ValueError("x and y points list must have the same length.")

    x = sp.Symbol('x')
    polynomial_expr = 0
    l_terms = []

    for i in range(n):
        num = 1
        den = 1
        num_str_list = []
        den_str_list = []
        for j in range(n):
            if i != j:
                num *= (x - x_pts[j])
                den *= (x_pts[i] - x_pts[j])
                num_str_list.append(f"(x - {x_pts[j]})")
                den_str_list.append(f"({x_pts[i]} - {x_pts[j]})")

        term_expr = num / den
        polynomial_expr += y_pts[i] * term_expr
        term_val_at_target = float(term_expr.subs(x, target_x))
        y_contrib = y_pts[i] * term_val_at_target

        l_terms.append({
            "index": i,
            "x_val": float(x_pts[i]),
            "y_val": float(y_pts[i]),
            "formula_num": " * ".join(num_str_list),
            "formula_den": " * ".join(den_str_list),
            "term_value": float(term_val_at_target),
            "contribution": float(y_contrib)
        })

    polynomial_expr = sp.simplify(polynomial_expr)
    interpolated_val = float(polynomial_expr.subs(x, target_x))

    return {
        "method": "Lagrange Interpolation",
        "polynomial": str(polynomial_expr),
        "target_x": float(target_x),
        "interpolated_y": float(interpolated_val),
        "points": [{"x": float(px), "y": float(py)} for px, py in zip(x_pts, y_pts)],
        "steps": l_terms
    }

def solve_newton_divided_difference(x_pts, y_pts, target_x):
    n = len(x_pts)
    if n != len(y_pts):
        raise ValueError("x and y points list must have the same length.")

    table = np.zeros((n, n))
    table[:, 0] = y_pts

    for j in range(1, n):
        for i in range(n - j):
            table[i, j] = (table[i+1, j-1] - table[i, j-1]) / (x_pts[i+j] - x_pts[i])

    coefs = table[0, :]
    x = sp.Symbol('x')
    poly = coefs[0]
    term = 1
    terms_list = [f"{coefs[0]:.6f}"]

    for i in range(1, n):
        term *= (x - x_pts[i-1])
        poly += coefs[i] * term
        term_strs = [f"(x - {x_pts[k]})" for k in range(i)]
        terms_list.append(f"{coefs[i]:+.6f} * " + " * ".join(term_strs))

    poly = sp.simplify(poly)
    interpolated_val = float(poly.subs(x, target_x))

    formatted_table = []
    for i in range(n):
        row = [float(x_pts[i]), float(y_pts[i])]
        for j in range(1, n - i):
            row.append(float(table[i, j]))
        while len(row) < n + 1:
            row.append(None)
        formatted_table.append(row)

    return {
        "method": "Newton's Divided Difference",
        "polynomial": str(poly),
        "coefficients": [float(c) for c in coefs],
        "target_x": float(target_x),
        "interpolated_y": float(interpolated_val),
        "points": [{"x": float(px), "y": float(py)} for px, py in zip(x_pts, y_pts)],
        "table": formatted_table,
        "steps": terms_list
    }


# ==========================================
# 3. NEWTON FORWARD DIFFERENCE FORMULA
#    For EQUAL intervals, query near START
# ==========================================

def solve_newton_forward(x_pts, y_pts, target_x):
    """
    Newton's Forward Difference Interpolation Formula.
    Best used when query point is near the START of the data table.
    Formula: P(x) = y0 + s*Δy0 + s(s-1)/2!*Δ²y0 + ...
    where s = (x - x0) / h
    """
    n = len(x_pts)
    if n != len(y_pts):
        raise ValueError("x and y points list must have the same length.")

    x_arr = [float(v) for v in x_pts]
    y_arr = [float(v) for v in y_pts]

    # Step size (using first difference; works for both equal and start-biased unequal)
    h = x_arr[1] - x_arr[0]

    # Build forward difference table
    # diff_table[i][j] = j-th forward difference starting at x_i
    diff_table = [list(y_arr)]  # diff_table[0] = y values (0th differences)
    for j in range(1, n):
        prev = diff_table[j - 1]
        curr = [prev[i + 1] - prev[i] for i in range(len(prev) - 1)]
        diff_table.append(curr)

    # s = (x - x0) / h
    x0 = x_arr[0]
    s = (target_x - x0) / h

    # Compute interpolated value using Newton Forward formula
    interpolated_val = y_arr[0]
    s_term = 1.0
    factorial = 1

    steps = []
    steps.append({
        "term_index": 0,
        "delta_order": "y₀",
        "delta_value": float(y_arr[0]),
        "s_product": 1.0,
        "factorial": 1,
        "contribution": float(y_arr[0])
    })

    for k in range(1, n):
        if k > len(diff_table) - 1 or len(diff_table[k]) == 0:
            break
        s_term *= (s - (k - 1))
        factorial *= k
        delta_k = diff_table[k][0]
        contribution = (s_term / factorial) * delta_k
        interpolated_val += contribution

        steps.append({
            "term_index": k,
            "delta_order": f"Δ{'^' + str(k) if k > 1 else ''}y₀",
            "delta_value": float(delta_k),
            "s_product": float(s_term),
            "factorial": int(factorial),
            "contribution": float(contribution)
        })

    # Format difference table for display
    # Rows: x_i, y_i, Δy, Δ²y, ...
    display_table = []
    for i in range(n):
        row = {"x": float(x_arr[i]), "y": float(y_arr[i])}
        for j in range(1, n):
            if i < len(diff_table[j]):
                row[f"delta_{j}"] = float(diff_table[j][i])
            else:
                row[f"delta_{j}"] = None
        display_table.append(row)

    return {
        "method": "Newton's Forward Difference Formula",
        "x0": float(x0),
        "h": float(h),
        "s": float(s),
        "target_x": float(target_x),
        "interpolated_y": float(interpolated_val),
        "points": [{"x": float(px), "y": float(py)} for px, py in zip(x_pts, y_pts)],
        "difference_table": display_table,
        "steps": steps
    }


# ==========================================
# 4. NEWTON BACKWARD DIFFERENCE FORMULA
#    For EQUAL intervals, query near END
# ==========================================

def solve_newton_backward(x_pts, y_pts, target_x):
    """
    Newton's Backward Difference Interpolation Formula.
    Best used when query point is near the END of the data table.
    Formula: P(x) = yn + s*∇yn + s(s+1)/2!*∇²yn + ...
    where s = (x - xn) / h
    """
    n = len(x_pts)
    if n != len(y_pts):
        raise ValueError("x and y points list must have the same length.")

    x_arr = [float(v) for v in x_pts]
    y_arr = [float(v) for v in y_pts]

    # Step size (from last interval)
    h = x_arr[-1] - x_arr[-2]

    # Build backward difference table
    # diff_table[0] = y values, diff_table[j] = j-th backward differences
    diff_table = [list(y_arr)]
    for j in range(1, n):
        prev = diff_table[j - 1]
        curr = [prev[i + 1] - prev[i] for i in range(len(prev) - 1)]
        diff_table.append(curr)

    # s = (x - xn) / h  (s is negative when x < xn)
    xn = x_arr[-1]
    s = (target_x - xn) / h

    # Compute interpolated value using Newton Backward formula
    # P(x) = yn + s*∇yn + s(s+1)/2! * ∇²yn + s(s+1)(s+2)/3! * ∇³yn + ...
    yn = y_arr[-1]
    interpolated_val = yn
    s_term = 1.0
    factorial = 1

    steps = []
    steps.append({
        "term_index": 0,
        "delta_order": "yₙ",
        "delta_value": float(yn),
        "s_product": 1.0,
        "factorial": 1,
        "contribution": float(yn)
    })

    for k in range(1, n):
        if k > len(diff_table) - 1 or len(diff_table[k]) == 0:
            break
        s_term *= (s + (k - 1))
        factorial *= k
        # The k-th backward difference at the last point is diff_table[k][-1]
        nabla_k = diff_table[k][-1]
        contribution = (s_term / factorial) * nabla_k
        interpolated_val += contribution

        steps.append({
            "term_index": k,
            "delta_order": f"∇{'^' + str(k) if k > 1 else ''}yₙ",
            "delta_value": float(nabla_k),
            "s_product": float(s_term),
            "factorial": int(factorial),
            "contribution": float(contribution)
        })

    # Format difference table for display
    display_table = []
    for i in range(n):
        row = {"x": float(x_arr[i]), "y": float(y_arr[i])}
        for j in range(1, n):
            if i < len(diff_table[j]):
                row[f"nabla_{j}"] = float(diff_table[j][i])
            else:
                row[f"nabla_{j}"] = None
        display_table.append(row)

    return {
        "method": "Newton's Backward Difference Formula",
        "xn": float(xn),
        "h": float(h),
        "s": float(s),
        "target_x": float(target_x),
        "interpolated_y": float(interpolated_val),
        "points": [{"x": float(px), "y": float(py)} for px, py in zip(x_pts, y_pts)],
        "difference_table": display_table,
        "steps": steps
    }


# ==========================================
# 5. NUMERICAL INTEGRATION SOLVERS
# ==========================================

def solve_integration(eq_str, a, b, n, rule="trapezoidal"):
    expr, x = parse_equation(eq_str)
    f = sp.lambdify(x, expr, 'numpy')

    rule = rule.lower()
    if rule == "simpson13" and n % 2 != 0:
        raise ValueError("Simpson's 1/3 rule requires an even number of intervals.")
    if rule == "simpson38" and n % 3 != 0:
        raise ValueError("Simpson's 3/8 rule requires intervals to be a multiple of 3.")

    h = (b - a) / n
    x_vals = [a + i*h for i in range(n + 1)]
    y_vals = [float(f(xv)) for xv in x_vals]

    steps = [{"index": idx, "x": float(xv), "y": float(yv)} for idx, (xv, yv) in enumerate(zip(x_vals, y_vals))]

    integral = 0.0
    formula_desc = ""

    if rule == "trapezoidal":
        sum_middle = sum(y_vals[1:-1])
        integral = (h / 2.0) * (y_vals[0] + 2.0 * sum_middle + y_vals[-1])
        formula_desc = f"Trapezoidal Rule: Integral ≈ h/2 * [y_0 + 2*(y_1+...+y_{n-1}) + y_n]"
    elif rule == "simpson13":
        sum_odd = sum(y_vals[i] for i in range(1, n, 2))
        sum_even = sum(y_vals[i] for i in range(2, n, 2))
        integral = (h / 3.0) * (y_vals[0] + 4.0 * sum_odd + 2.0 * sum_even + y_vals[-1])
        formula_desc = "Simpson's 1/3 Rule: Integral ≈ h/3 * [y_0 + 4*(y_odd) + 2*(y_even) + y_n]"
    elif rule == "simpson38":
        sum_mult_3 = sum(y_vals[i] for i in range(3, n, 3))
        sum_others = sum(y_vals[i] for i in range(1, n) if i % 3 != 0)
        integral = (3.0 * h / 8.0) * (y_vals[0] + 3.0 * sum_others + 2.0 * sum_mult_3 + y_vals[-1])
        formula_desc = "Simpson's 3/8 Rule: Integral ≈ 3h/8 * [y_0 + 3*(y_non_mult3) + 2*(y_mult3) + y_n]"
    else:
        raise ValueError(f"Unknown integration rule: {rule}")

    # `steps` is the coarse n-subinterval sample the rule itself sums over —
    # useful for drawing the trapezoid/Simpson panels exactly as computed.
    # `curve` is a finer, separate sample of the true f(x), so the panels can
    # be shaded against the real curve and the approximation error is
    # visible rather than the panels silently matching a straight-line f.
    x_lo, x_hi = padded_range(a, b, margin_frac=0.05)
    curve = sample_function(f, x_lo, x_hi)

    return {
        "method": f"Numerical Integration ({rule.capitalize()})",
        "equation": str(expr),
        "a": float(a), "b": float(b), "n": int(n), "h": float(h),
        "formula": formula_desc,
        "integral": float(integral),
        "curve": curve,
        "steps": steps
    }


# ==========================================
# 6. ODE SOLVERS
# ==========================================

def solve_euler(eq_str, x0, y0, xn, h):
    expr, x, y = parse_ode_equation(eq_str)
    f = sp.lambdify((x, y), expr, 'numpy')

    n_steps = int(round((xn - x0) / h))
    steps = []
    curr_x, curr_y = x0, y0

    for i in range(n_steps):
        slope = float(f(curr_x, curr_y))
        dy = h * slope
        next_y = curr_y + dy
        next_x = curr_x + h

        steps.append({
            "step": i + 1,
            "x": float(curr_x), "y": float(curr_y),
            "slope": float(slope), "dy": float(dy),
            "next_x": float(next_x), "next_y": float(next_y)
        })

        curr_x, curr_y = next_x, next_y

    return {
        "method": "Euler's Method (ODE)",
        "ode": f"dy/dx = {expr}",
        "x0": float(x0), "y0": float(y0), "xn": float(xn), "h": float(h),
        "final_y": float(curr_y),
        "steps": steps
    }

def solve_rk4(eq_str, x0, y0, xn, h):
    expr, x, y = parse_ode_equation(eq_str)
    f = sp.lambdify((x, y), expr, 'numpy')

    n_steps = int(round((xn - x0) / h))
    steps = []
    curr_x, curr_y = x0, y0

    for i in range(n_steps):
        k1 = float(f(curr_x, curr_y))
        k2 = float(f(curr_x + h/2.0, curr_y + h*k1/2.0))
        k3 = float(f(curr_x + h/2.0, curr_y + h*k2/2.0))
        k4 = float(f(curr_x + h, curr_y + h*k3))
        next_y = curr_y + (h / 6.0) * (k1 + 2*k2 + 2*k3 + k4)
        next_x = curr_x + h

        steps.append({
            "step": i + 1,
            "x": float(curr_x), "y": float(curr_y),
            "k1": float(k1), "k2": float(k2), "k3": float(k3), "k4": float(k4),
            "next_x": float(next_x), "next_y": float(next_y)
        })

        curr_x, curr_y = next_x, next_y

    return {
        "method": "Runge-Kutta 4th Order (RK4)",
        "ode": f"dy/dx = {expr}",
        "x0": float(x0), "y0": float(y0), "xn": float(xn), "h": float(h),
        "final_y": float(curr_y),
        "steps": steps
    }