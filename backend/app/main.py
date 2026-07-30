import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.solvers import (
    solve_bisection, solve_false_position, solve_newton_raphson, solve_secant,
    solve_lagrange, solve_newton_divided_difference,
    solve_newton_forward, solve_newton_backward,
    smart_interpolation_selector,
    solve_integration,
    solve_euler, solve_rk4
)
from app.utils.parser import parse_question_text
from app.utils.file_extractor import extract_text_from_file
from app.utils.exporter import generate_docx, generate_pdf

from app.core.deps import get_current_user, get_optional_current_user
from app.db.database import Base, engine, get_db
from app.db.models import User  # noqa: F401 (import registers the model with Base)
from app.routers.auth import router as auth_router

# Create the users table on startup if it doesn't exist yet. No migrations
# framework for a table this simple — add Alembic later if the schema grows.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Fine Arc — Numerical Methods Solver API",
    description="Smart numerical methods engine with automatic interpolation selection.",
    version="2.0.0"
)

FRONTEND_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# In production, set FRONTEND_URL to your deployed frontend's URL (e.g.
# https://your-app.vercel.app) as an environment variable on Render.
# Local dev origins above still work either way, so this is purely additive.
_extra_origin = os.getenv("FRONTEND_URL")
if _extra_origin:
    FRONTEND_ORIGINS.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)

class SolveRequest(BaseModel):
    method: str
    params: Dict[str, Any]

class SmartInterpolationRequest(BaseModel):
    x_pts: List[float]
    y_pts: List[float]
    target_x: float
    interval_type: Optional[str] = "auto"


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "project": "Fine Arc — Numerical Methods Solver"}


@app.post("/api/parse")
def parse_question(payload: Dict[str, str], current_user: Optional[User] = Depends(get_optional_current_user)):
    text = payload.get("text", "")
    if not text:
        raise HTTPException(status_code=400, detail="Text field is required.")
    return parse_question_text(text)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...), current_user: Optional[User] = Depends(get_optional_current_user)):
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, file.filename)

    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        extracted_text = extract_text_from_file(file_path)
        parsed = parse_question_text(extracted_text)

        return {"filename": file.filename, "text": extracted_text, "parsed": parsed}

    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


@app.post("/api/smart-interpolate")
def smart_interpolate(
    request: SmartInterpolationRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """
    Fine Arc Smart Interpolation Engine.
    Automatically selects:
      - Equal interval   → Lagrange Interpolation
      - Unequal interval → Newton Forward (query near start) or Newton Backward (query near end)
    """
    try:
        result = smart_interpolation_selector(
            x_pts=request.x_pts,
            y_pts=request.y_pts,
            target_x=request.target_x,
            interval_type=request.interval_type
        )
        if current_user is not None:
            current_user.solve_count += 1
            db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Smart interpolation error: {str(e)}")


@app.post("/api/solve")
def solve_problem(
    request: SolveRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    method = request.method.lower()
    params = request.params

    try:
        if method == "bisection":
            result = solve_bisection(
                eq_str=params["equation"], a=float(params["a"]), b=float(params["b"]),
                tol=float(params.get("tol", 1e-6)), max_iter=int(params.get("max_iter", 100))
            )
        elif method == "false_position":
            result = solve_false_position(
                eq_str=params["equation"], a=float(params["a"]), b=float(params["b"]),
                tol=float(params.get("tol", 1e-6)), max_iter=int(params.get("max_iter", 100))
            )
        elif method == "newton_raphson":
            result = solve_newton_raphson(
                eq_str=params["equation"], x0=float(params["x0"]),
                tol=float(params.get("tol", 1e-6)), max_iter=int(params.get("max_iter", 100))
            )
        elif method == "secant":
            result = solve_secant(
                eq_str=params["equation"], x0=float(params["x0"]), x1=float(params["x1"]),
                tol=float(params.get("tol", 1e-6)), max_iter=int(params.get("max_iter", 100))
            )
        elif method == "lagrange":
            result = solve_lagrange(
                x_pts=[float(v) for v in params["x_pts"]],
                y_pts=[float(v) for v in params["y_pts"]],
                target_x=float(params["target_x"])
            )
        elif method == "divided_difference":
            result = solve_newton_divided_difference(
                x_pts=[float(v) for v in params["x_pts"]],
                y_pts=[float(v) for v in params["y_pts"]],
                target_x=float(params["target_x"])
            )
        elif method == "newton_forward":
            result = solve_newton_forward(
                x_pts=[float(v) for v in params["x_pts"]],
                y_pts=[float(v) for v in params["y_pts"]],
                target_x=float(params["target_x"])
            )
        elif method == "newton_backward":
            result = solve_newton_backward(
                x_pts=[float(v) for v in params["x_pts"]],
                y_pts=[float(v) for v in params["y_pts"]],
                target_x=float(params["target_x"])
            )
        elif method == "smart_interpolation":
            result = smart_interpolation_selector(
                x_pts=[float(v) for v in params["x_pts"]],
                y_pts=[float(v) for v in params["y_pts"]],
                target_x=float(params["target_x"]),
                interval_type=params.get("interval_type", "auto")
            )
        elif method in ["trapezoidal", "simpson13", "simpson38"]:
            result = solve_integration(
                eq_str=params["equation"], a=float(params["a"]), b=float(params["b"]),
                n=int(params["n"]), rule=method
            )
        elif method == "euler":
            result = solve_euler(
                eq_str=params["equation"], x0=float(params["x0"]), y0=float(params["y0"]),
                xn=float(params["xn"]), h=float(params["h"])
            )
        elif method == "rk4":
            result = solve_rk4(
                eq_str=params["equation"], x0=float(params["x0"]), y0=float(params["y0"]),
                xn=float(params["xn"]), h=float(params["h"])
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

        if current_user is not None:
            current_user.solve_count += 1
            db.commit()

        return result

    except KeyError as k_err:
        raise HTTPException(status_code=400, detail=f"Missing parameter: {str(k_err)}")
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=f"Mathematical error: {str(v_err)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@app.post("/api/export/docx")
def export_docx_endpoint(result_data: Dict[str, Any], current_user: Optional[User] = Depends(get_optional_current_user)):
    try:
        docx_stream = generate_docx(result_data)
        filename = f"finearc_{result_data.get('method','solution').lower().replace(' ','_')}.docx"
        return StreamingResponse(
            docx_stream,
            media_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Word export failed: {str(e)}")


@app.post("/api/export/pdf")
def export_pdf_endpoint(result_data: Dict[str, Any], current_user: Optional[User] = Depends(get_optional_current_user)):
    try:
        pdf_stream = generate_pdf(result_data)
        filename = f"finearc_{result_data.get('method','solution').lower().replace(' ','_')}.pdf"
        return StreamingResponse(
            pdf_stream,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF export failed: {str(e)}")
