import pytest
from app.utils.parser import parse_question_text

def test_parse_root_finding_bisection():
    question = "Solve the equation x^3 - x - 2 = 0 using Bisection Method in the interval [1, 2] with tolerance 1e-5"
    res = parse_question_text(question)
    assert res["method"] == "bisection"
    assert res["params"]["equation"] == "x**3 - x - 2"
    assert res["params"]["a"] == 1.0
    assert res["params"]["b"] == 2.0
    assert res["params"]["tol"] == 1e-5

def test_parse_root_finding_newton():
    question = "Find a root of x^2 - 4 = 0 using Newton Raphson starting with initial guess x0 = 3 and tolerance 0.0001"
    res = parse_question_text(question)
    assert res["method"] == "newton_raphson"
    assert res["params"]["equation"] == "x**2 - 4"
    assert res["params"]["x0"] == 3.0
    assert res["params"]["tol"] == 0.0001

def test_parse_lagrange_interpolation():
    question = "Find the value of y at x = 2.5 using Lagrange interpolation for points (1, 2), (2, 4), (3, 8)"
    res = parse_question_text(question)
    assert res["method"] == "lagrange"
    assert res["params"]["target_x"] == 2.5
    assert res["params"]["x_pts"] == [1.0, 2.0, 3.0]
    assert res["params"]["y_pts"] == [2.0, 4.0, 8.0]

def test_parse_divided_difference():
    question = "Interpolate value at 1.5 with Newton's Divided Difference method on x=[1, 2], y=[2, 5]"
    res = parse_question_text(question)
    assert res["method"] == "divided_difference"
    assert res["params"]["target_x"] == 1.5
    assert res["params"]["x_pts"] == [1.0, 2.0]
    assert res["params"]["y_pts"] == [2.0, 5.0]

def test_parse_numerical_integration():
    question = "Integrate function x^2 + 1 from 0 to 3 using Simpson's 1/3 rule with 6 intervals"
    res = parse_question_text(question)
    assert res["method"] == "simpson13"
    assert res["params"]["equation"] == "x**2 + 1"
    assert res["params"]["a"] == 0.0
    assert res["params"]["b"] == 3.0
    assert res["params"]["n"] == 6

def test_parse_ode_rk4():
    question = "Solve differential equation dy/dx = x + y with initial condition y(0) = 1 up to x = 0.5 using RK4 step size h = 0.1"
    res = parse_question_text(question)
    assert res["method"] == "rk4"
    assert res["params"]["equation"] == "x + y"
    assert res["params"]["x0"] == 0.0
    assert res["params"]["y0"] == 1.0
    assert res["params"]["xn"] == 0.5
    assert res["params"]["h"] == 0.1
