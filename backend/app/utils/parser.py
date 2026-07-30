import re

X_LABELS = ['year', 'years', 'time', 'day', 'days', 'month', 'months', 'week', 'weeks']
Y_LABELS = ['population', 'sales', 'value', 'values', 'temperature', 'pressure', 'height', 'demand', 'production']


def extract_numbers_after_label(text, label_patterns):
    """
    Finds every occurrence of any given label word (e.g. "Year", "Population"),
    reads the run of numbers immediately following each one, and returns the
    LONGEST such run (>= 2 numbers).

    Taking the longest run (rather than the first match) matters: a word
    problem often mentions the label once in passing as part of the question
    ("...estimate the population for the year 1895...", a single number) and
    once as the actual data table header ("Year: 1891, 1901, 1911, ...", many
    numbers). Without this, the parser can latch onto the passing mention
    instead of the real table.
    """
    combined_label = '|'.join(label_patterns)
    label_re = re.compile(rf'\b(?:{combined_label})\b\s*[:\-]?\s*', re.IGNORECASE)
    run_re = re.compile(r'^(?:\s*[0-9]+\.?[0-9]*\s*[,;]?\s*)+')

    best = None
    for m in label_re.finditer(text):
        run_match = run_re.match(text[m.end():])
        if not run_match:
            continue
        numbers = [float(n) for n in re.findall(r'[0-9]+\.?[0-9]*', run_match.group(0))]
        if len(numbers) >= 2 and (best is None or len(numbers) > len(best)):
            best = numbers
    return best


def find_target_x(text_lower, known_x_pts=None):
    """Broader target-x detection covering common word-problem phrasings."""
    patterns = [
        r'(?:at\s*x\s*=|y\(|value\s*at|estimate\s*at|for\s*x\s*=)\s*([0-9\.\-]+)',
        r'for\s+(?:the\s+)?year\s+([0-9]+(?:\.[0-9]+)?)',
        r'(?:estimate|find|predict|calculate)[^0-9]{0,50}?([0-9]+(?:\.[0-9]+)?)',
    ]
    for pat in patterns:
        m = re.search(pat, text_lower)
        if m:
            val = float(m.group(1))
            if not known_x_pts or val not in known_x_pts:
                return val
    return None


def clean_equation(expr_str):
    """Clean math equations for parsing."""
    # Replace standard notation with python standard syntax
    expr_str = expr_str.replace('^', '**')
    expr_str = re.sub(r'(\d)([a-zA-Z])', r'\1*\2', expr_str)  # 3x -> 3*x
    # Remove spacing
    expr_str = expr_str.strip()
    return expr_str

def clean_extracted_equation(eq_str):
    if not eq_str:
        return ""
    # Strip common english words that might be captured
    stop_words = ["with", "at", "from", "using", "in", "to", "having", "subject", "where", "starts", "starting", "and", "for", "step", "tolerance", "tol"]
    
    # Split by stop words
    for word in stop_words:
        # Match word with word boundaries
        eq_str = re.split(rf'\b{word}\b', eq_str, flags=re.IGNORECASE)[0]
        
    # Remove leading words like "solve", "the", "equation", "function", "expression", "of", "find", "a", "root" recursively
    # We include \s and word characters, ending in optional spaces or '='
    eq_str = re.sub(r'^(?:solve|the|equation|function|expression|of|find|a|root|dy/dx|y\'|f\(x\)|f\(x,y\)|y|\s)+', '', eq_str, flags=re.IGNORECASE).strip()
    
    # Remove trailing = 0 or =0
    eq_str = re.sub(r'=\s*0$', '', eq_str).strip()
    
    # Clean up double equals if any
    eq_str = re.sub(r'^=\s*', '', eq_str).strip()
    return clean_equation(eq_str)

def parse_question_text(text):
    """
    Parses natural language questions for numerical methods.
    Returns:
        dict: {
            "method": "bisection" | "newton_raphson" | "secant" | "false_position" | "lagrange" | "divided_difference" | "trapezoidal" | "simpson13" | "simpson38" | "euler" | "rk4",
            "params": { ... }
        }
    """
    text_lower = text.lower()
    
    # 1. DETECT THE METHOD
    method = None
    if "bisection" in text_lower:
        method = "bisection"
    elif "newton-raphson" in text_lower or "newton raphson" in text_lower or "newton's method" in text_lower or "newton method" in text_lower:
        method = "newton_raphson"
    elif "secant" in text_lower:
        method = "secant"
    elif "false position" in text_lower or "regula falsi" in text_lower:
        method = "false_position"
    elif "lagrange" in text_lower:
        method = "lagrange"
    elif "divided difference" in text_lower or "newton's divided" in text_lower or "newton divided" in text_lower:
        method = "divided_difference"
    elif "interpolation" in text_lower or "interpolate" in text_lower or "data points" in text_lower:
        method = "smart_interpolation"
    elif "trapezoidal" in text_lower:
        method = "trapezoidal"
    elif "simpson" in text_lower:
        if "1/3" in text_lower or "one third" in text_lower or "one-third" in text_lower:
            method = "simpson13"
        elif "3/8" in text_lower or "three eighth" in text_lower or "three-eighth" in text_lower:
            method = "simpson38"
        else:
            method = "simpson13"
    elif "runge-kutta" in text_lower or "rk4" in text_lower or "runge kutta" in text_lower:
        method = "rk4"
    elif "euler" in text_lower:
        method = "euler"
    elif (
        "points" in text_lower
        or "data table" in text_lower
        or re.search(r'\bx\s*=\s*\[', text_lower)
    ) and (
        "value" in text_lower
        or "estimate" in text_lower
        or "at x" in text_lower
        or "y(" in text_lower
    ):
        method = "smart_interpolation"
    elif (
        extract_numbers_after_label(text, X_LABELS) is not None
        and extract_numbers_after_label(text, Y_LABELS) is not None
    ):
        # Catches word problems phrased as a labeled table (e.g. "Year: 1891,
        # 1901, ... Population: 46, 66, ...") with no interpolation keyword
        # at all — very common for textbook-style questions.
        method = "smart_interpolation"
        
    # 2. EXTRACT PARAMETERS
    params = {}
    
    # Try to find tolerances with word boundaries
    tol_match = re.search(r'\b(?:tolerance|tol|error|accuracy)\b\s*(?:=|is|<|of)?\s*([0-9e\.\-]+)', text_lower)
    if tol_match:
        try:
            params["tol"] = float(tol_match.group(1))
        except ValueError:
            pass
    else:
        params["tol"] = 1e-6

    if "unequal interval" in text_lower or "unequal spacing" in text_lower:
        params["interval_type"] = "unequal"
    elif "equal interval" in text_lower or "equal spacing" in text_lower:
        params["interval_type"] = "equal"
        
    # Try to find max iterations with word boundaries
    iter_match = re.search(r'\b(?:iterations|steps|max iter|n)\b\s*(?:=|is)?\s*(\d+)', text_lower)
    if iter_match:
        try:
            params["max_iter"] = int(iter_match.group(1))
            params["n"] = int(iter_match.group(1)) # For integration/ODEs
        except ValueError:
            pass
            
    # Solve based on detected method type
    if method in ["bisection", "false_position", "newton_raphson", "secant"]:
        # Find equation. Try split by '=0' first
        eq = None
        eq_match = re.search(r'([^,\n\.\?]+)\s*=\s*0', text)
        if eq_match:
            eq = eq_match.group(1).strip()
        else:
            # Look for f(x) = ...
            f_match = re.search(r'f\(x\)\s*=\s*([^,\n\.\?]+)', text, re.IGNORECASE)
            if f_match:
                eq = f_match.group(1).strip()
            else:
                # Look for "root of <expr>", capturing non-greedily up to a
                # clear boundary keyword. This handles natural phrasings like
                # "...to find the root of x^3 - x - 2 between a=1 and b=2"
                # or "...the root of x^3 - x - 2 starting at x0=1.5" without
                # falling through to the whole-text fallback below, which
                # would otherwise get mangled by the stop-word splitter in
                # clean_extracted_equation (ordinary connective words like
                # "to"/"at" appear before the real equation ever does).
                boundary = r'(?:\s+(?:between|starting|using|with|at|for|and)\b|[,\.\?]|$)'
                root_match = re.search(rf'root\s+of\s+(.+?){boundary}', text, re.IGNORECASE)
                if root_match:
                    eq = root_match.group(1).strip()
                else:
                    # Look for word solve followed by something containing x,
                    # tightened to stop at the same boundary keywords rather
                    # than swallowing the rest of the sentence.
                    solve_match = re.search(rf'solve\s+(.+?){boundary}', text, re.IGNORECASE)
                    if solve_match:
                        eq = solve_match.group(1).strip()
                    else:
                        eq = text
                    
        params["equation"] = clean_extracted_equation(eq)
            
        # Try to find intervals like [a, b] or "between a and b"
        interval_match = re.search(r'(?:interval|bracket|bounds|limits|between)\s*(?:\[|\()?([0-9\.\-]+)\s*(?:,|and|to)\s*([0-9\.\-]+)(?:\]|\))?', text_lower)
        if interval_match:
            try:
                params["a"] = float(interval_match.group(1))
                params["b"] = float(interval_match.group(2))
            except ValueError:
                pass
        else:
            # Try to find x0 and x1
            x0_match = re.search(r'x_?0\s*=\s*([0-9\.\-]+)', text_lower)
            x1_match = re.search(r'x_?1\s*=\s*([0-9\.\-]+)', text_lower)
            if x0_match:
                try:
                    params["x0"] = float(x0_match.group(1))
                except ValueError:
                    pass
            if x1_match:
                try:
                    params["x1"] = float(x1_match.group(1))
                except ValueError:
                    pass

            if not ("x0" in params and "x1" in params):
                # Direct "a=X" / "b=Y" phrasing not caught by interval_match
                # above (e.g. "between a=1 and b=2").
                a_eq_match = re.search(r'\ba\s*=\s*([0-9\.\-]+)', text_lower)
                b_eq_match = re.search(r'\bb\s*=\s*([0-9\.\-]+)', text_lower)
                if a_eq_match and b_eq_match:
                    try:
                        params["a"] = float(a_eq_match.group(1))
                        params["b"] = float(b_eq_match.group(1))
                    except ValueError:
                        pass

            if "x0" in params and "x1" in params:
                params["a"] = params["x0"]
                params["b"] = params["x1"]
            elif "a" in params and "b" in params:
                params["x0"] = params["a"]
                params["x1"] = params["b"]
            elif "x0" in params and method in ["bisection", "false_position"]:
                params["a"] = params["x0"]
                params["b"] = params["x0"] + 2.0
            elif "a" in params and method == "newton_raphson":
                params["x0"] = params["a"]
                
    elif method in ["lagrange", "divided_difference", "smart_interpolation"]:
        x_pts = []
        y_pts = []

        # Try labeled data table FIRST (e.g. "Year: 1891, 1901, ... Population:
        # 46, 66, ..."), since it's the most common textbook word-problem
        # phrasing. Trying this first also avoids a real bug in the generic
        # coordinate-pair regex below: on labeled tables it can silently pair
        # numbers across the label boundary (e.g. treating the last "Year"
        # value and the first "Population" value as a bogus (x, y) pair)
        # instead of failing cleanly, corrupting the data instead of erroring.
        labeled_x = extract_numbers_after_label(text, X_LABELS + ['x'])
        labeled_y = extract_numbers_after_label(text, Y_LABELS + ['y'])
        if labeled_x and labeled_y and len(labeled_x) == len(labeled_y):
            x_pts, y_pts = labeled_x, labeled_y

        if not (x_pts and y_pts and len(x_pts) == len(y_pts)):
            # Find points coordinates, e.g. "(1, 2), (2, 4), (3, 8)"
            coord_matches = re.findall(r'(?:\[|\()?([0-9\.\-]+)\s*,\s*([0-9\.\-]+)(?:\]|\))?', text)
            coord_x, coord_y = [], []
            for m in coord_matches:
                try:
                    coord_x.append(float(m[0]))
                    coord_y.append(float(m[1]))
                except ValueError:
                    pass
            if coord_x and coord_y and len(coord_x) == len(coord_y):
                x_pts, y_pts = coord_x, coord_y

        if not (x_pts and y_pts and len(x_pts) == len(y_pts)):
            # x=[...], y=[...] bracket syntax
            x_list_match = re.search(r'x\s*=\s*\[\s*([0-9\.,\s\-]+)\s*\]', text_lower)
            y_list_match = re.search(r'y\s*=\s*\[\s*([0-9\.,\s\-]+)\s*\]', text_lower)
            if x_list_match and y_list_match:
                try:
                    x_pts = [float(x.strip()) for x in x_list_match.group(1).split(',')]
                    y_pts = [float(y.strip()) for y in y_list_match.group(1).split(',')]
                except ValueError:
                    pass

        if x_pts and y_pts and len(x_pts) == len(y_pts):
            params["x_pts"] = x_pts
            params["y_pts"] = y_pts
            
        target_x = find_target_x(text_lower, params.get("x_pts"))
        if target_x is not None:
            params["target_x"] = target_x
                
    elif method in ["trapezoidal", "simpson13", "simpson38"]:
        lim_match = re.search(r'(?:integrate|from|limits)\s+([0-9\.\-]+)\s+(?:to|and)\s+([0-9\.\-]+)', text_lower)
        if lim_match:
            try:
                params["a"] = float(lim_match.group(1))
                params["b"] = float(lim_match.group(2))
            except ValueError:
                pass
        else:
            lim_bracket = re.search(r'(?:interval|bounds|limits)\s*(?:\[|\()?([0-9\.\-]+)\s*(?:,|to)\s*([0-9\.\-]+)', text_lower)
            if lim_bracket:
                try:
                    params["a"] = float(lim_bracket.group(1))
                    params["b"] = float(lim_bracket.group(2))
                except ValueError:
                    pass
                    
        n_match = re.search(r'(\d+)\s*(?:intervals|steps|subintervals|strips|n\s*=)', text_lower)
        if n_match:
            try:
                params["n"] = int(n_match.group(1))
            except ValueError:
                pass
        else:
            params["n"] = 6
            
        eq_match = re.search(r'(?:integrate|of|function)\s+([^,\n\.\?]+)', text_lower)
        if eq_match:
            eq = eq_match.group(1).strip()
        else:
            eq = text
        params["equation"] = clean_extracted_equation(eq)
            
    elif method in ["euler", "rk4"]:
        ode_match = re.search(r'(?:dy/dx|y\'|f\(x,y\))\s*=\s*([^,\n\.\?]+)', text_lower)
        if ode_match:
            eq = ode_match.group(1).strip()
        else:
            eq = text
        params["equation"] = clean_extracted_equation(eq)
            
        init_match = re.search(r'y\(\s*([0-9\.\-]+)\s*\)\s*=\s*([0-9\.\-]+)', text_lower)
        if init_match:
            try:
                params["x0"] = float(init_match.group(1))
                params["y0"] = float(init_match.group(2))
            except ValueError:
                pass
        else:
            x0_m = re.search(r'x_?0\s*=\s*([0-9\.\-]+)', text_lower)
            y0_m = re.search(r'y_?0\s*=\s*([0-9\.\-]+)', text_lower)
            if x0_m:
                params["x0"] = float(x0_m.group(1))
            if y0_m:
                params["y0"] = float(y0_m.group(1))
                
        xn_direct_match = re.search(r'\bxn\s*=\s*([0-9\.\-]+)', text_lower)
        if xn_direct_match:
            try:
                params["xn"] = float(xn_direct_match.group(1))
            except ValueError:
                pass
        else:
            xn_match = re.search(r'(?:up\s+to\s+x|at\s+x|y\s*at\s*x)\s*(?:=|\s)\s*([0-9\.\-]+)', text_lower)
            if xn_match:
                try:
                    params["xn"] = float(xn_match.group(1))
                except ValueError:
                    pass
            else:
                y_target_match = re.search(r'y\(\s*([0-9\.\-]+)\s*\)\s*(?!=)', text_lower)
                if y_target_match:
                    try:
                        params["xn"] = float(y_target_match.group(1))
                    except ValueError:
                        pass
                
        h_match = re.search(r'h\s*=\s*([0-9\.\-]+)', text_lower)
        if h_match:
            try:
                params["h"] = float(h_match.group(1))
            except ValueError:
                pass
        else:
            params["h"] = 0.1

    return {
        "method": method,
        "params": params
    }