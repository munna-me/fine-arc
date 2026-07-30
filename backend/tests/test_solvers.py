import pytest
from app.core.solvers import (
    solve_bisection, solve_false_position, solve_newton_raphson, solve_secant,
    solve_lagrange, solve_newton_divided_difference,
    smart_interpolation_selector,
    solve_integration,
    solve_euler, solve_rk4
)

def test_bisection():
    # Root of x^2 - 4 = 0 is 2. Bracket [0, 3]
    result = solve_bisection("x**2 - 4", 0, 3, tol=1e-5)
    assert result["converged"] is True
    assert abs(result["root"] - 2.0) < 1e-4
    assert len(result["steps"]) > 0

def test_false_position():
    result = solve_false_position("x**2 - 4", 0, 3, tol=1e-5)
    assert result["converged"] is True
    assert abs(result["root"] - 2.0) < 1e-4

def test_newton_raphson():
    # Root of x^3 - x - 2 = 0 is ~1.5213797
    result = solve_newton_raphson("x**3 - x - 2", 2.0, tol=1e-5)
    assert result["converged"] is True
    assert abs(result["root"] - 1.5213797) < 1e-4

def test_secant():
    result = solve_secant("x**3 - x - 2", 1.0, 2.0, tol=1e-5)
    assert result["converged"] is True
    assert abs(result["root"] - 1.5213797) < 1e-4

def test_lagrange():
    # Points (1, 1), (2, 4), (3, 9) represents y = x^2
    # At x = 2.5, y should be 6.25
    result = solve_lagrange([1, 2, 3], [1, 4, 9], 2.5)
    assert abs(result["interpolated_y"] - 6.25) < 1e-6

def test_newton_divided_difference():
    result = solve_newton_divided_difference([1, 2, 3], [1, 4, 9], 2.5)
    assert abs(result["interpolated_y"] - 6.25) < 1e-6

def test_smart_interpolation_equal_uses_forward_near_start():
    result = smart_interpolation_selector([1, 2, 3, 4], [1, 4, 9, 16], 1.5)
    assert result["method"] == "Newton's Forward Difference Formula"
    assert result["auto_selection"]["interval_type"] == "equal"

def test_smart_interpolation_equal_uses_backward_near_end():
    result = smart_interpolation_selector([1, 2, 3, 4], [1, 4, 9, 16], 3.5)
    assert result["method"] == "Newton's Backward Difference Formula"
    assert result["auto_selection"]["interval_type"] == "equal"

def test_smart_interpolation_unequal_uses_lagrange():
    result = smart_interpolation_selector([1, 2.5, 4], [2, 6, 17], 2)
    assert result["method"] == "Lagrange Interpolation"
    assert result["auto_selection"]["interval_type"] == "unequal"

def test_integration_trapezoidal():
    # Integrate 2*x from 0 to 2. Analytical: [x^2]_0^2 = 4
    result = solve_integration("2*x", 0, 2, n=4, rule="trapezoidal")
    assert abs(result["integral"] - 4.0) < 1e-6

def test_integration_simpson13():
    # Integrate x^2 from 0 to 2. Analytical: [x^3/3]_0^2 = 8/3 ~ 2.666667
    result = solve_integration("x**2", 0, 2, n=4, rule="simpson13")
    assert abs(result["integral"] - 2.666667) < 1e-5

def test_euler_ode():
    # dy/dx = x + y, y(0) = 1. step size 0.1, find y(0.2)
    # y1 = y0 + h*(x0 + y0) = 1 + 0.1*(0 + 1) = 1.1
    # y2 = y1 + h*(x1 + y1) = 1.1 + 0.1*(0.1 + 1.1) = 1.1 + 0.12 = 1.22
    result = solve_euler("x + y", 0.0, 1.0, 0.2, 0.1)
    assert abs(result["final_y"] - 1.22) < 1e-6

def test_bisection_curve_sample():
    result = solve_bisection("x**2 - 4", 0, 3, tol=1e-5)
    assert "curve" in result
    assert len(result["curve"]) > 0
    xs = [p["x"] for p in result["curve"]]
    # padded window should extend outside the original [0, 3] bracket
    assert min(xs) < 0
    assert max(xs) > 3

def test_newton_raphson_curve_sample():
    result = solve_newton_raphson("x**3 - x - 2", 2.0, tol=1e-5)
    assert "curve" in result
    assert len(result["curve"]) > 0
    xs = [p["x"] for p in result["curve"]]
    # curve should be centered around the path Newton actually walked, i.e.
    # bracket the root without being an arbitrary huge window
    assert min(xs) < result["root"] < max(xs)

def test_integration_curve_sample_finer_than_steps():
    result = solve_integration("x**2", 0, 2, n=4, rule="simpson13")
    assert "curve" in result
    # curve is a separate, finer sample of true f(x); steps are the coarse
    # n-subinterval points the rule itself summed over
    assert len(result["curve"]) > len(result["steps"])

def test_rk4_ode():
    # dy/dx = x + y, y(0) = 1. step size 0.2, find y(0.2)
    result = solve_rk4("x + y", 0.0, 1.0, 0.2, 0.2)
    # Analytical solution: y(x) = 2*e^x - x - 1
    # y(0.2) = 2*e^0.2 - 0.2 - 1 = 2*1.221402758 - 1.2 = 2.4428055 - 1.2 = 1.2428055
    assert abs(result["final_y"] - 1.2428055) < 1e-5