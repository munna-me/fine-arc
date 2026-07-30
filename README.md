# Fine Arc — Numerical Methods Studio

A full-stack numerical methods solver. Enter a problem (or upload/describe one
in plain English) and get a step-by-step solution — root finding,
interpolation, integration, and ODEs — with charts and a downloadable Word/PDF
report.

**Live app:** https://fine-arc.vercel.app

---

## Features

- **11 numerical methods**, all with full step-by-step working:
  - Root finding — Bisection, False Position, Newton-Raphson, Secant
  - Interpolation — Lagrange, Newton's Forward Difference, Newton's Backward
    Difference, Newton's Divided Difference
  - Integration — Trapezoidal, Simpson's 1/3, Simpson's 3/8
  - ODEs — Euler's Method, Runge-Kutta 4th Order (RK4)
- **Smart Interpolation** — pick equal or unequal interval, Fine Arc
  automatically selects the right formula (Newton Forward/Backward for equal
  spacing depending on where the target sits, Lagrange for unequal spacing)
- **General Solver** — describe a problem in plain English, or upload a file,
  and the parser extracts the data and picks a method
- **Interactive "Teach me this" tutorial** — built dynamically from the
  problem you just solved (not a fixed example), covering Lagrange, Newton
  Forward/Backward, Bisection, Newton-Raphson, and Secant
- **Charts** for every method — interpolation curve, ODE trajectory,
  root-finding convergence, and (for root-finding/integration) an actual
  sampled f(x) curve with a tangent/secant line or shaded integration region
- **Auth** — email/password (JWT), Google Sign-In, or continue as a guest;
  solving works without an account, sign-in unlocks a per-user solve counter
  and profile panel
- **Export** — download any solution as a formatted Word document or PDF,
  including difference tables and term-by-term breakdowns
- **Light/dark theme**, animated UI (Framer Motion), KaTeX-rendered math

---

## Stack

**Backend** — FastAPI (Python 3.13), SQLite via SQLAlchemy, sympy/numpy for
the solvers, python-docx/reportlab for exports, bcrypt + PyJWT for auth.

**Frontend** — React 19 + Vite, Framer Motion, KaTeX, Recharts, lucide-react.

**Deployment** — backend on [Render](https://render.com), frontend on
[Vercel](https://vercel.com), connected via CORS + an `VITE_API_URL`
environment variable.

---

## Project structure

```
fine-arc/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, routes, CORS config
│   │   ├── core/
│   │   │   ├── solvers.py       # All 11 numerical methods
│   │   │   ├── security.py      # Password hashing, JWT
│   │   │   ├── deps.py          # Auth dependencies (required / optional)
│   │   │   └── mailer.py        # Email sending (SMTP)
│   │   ├── db/
│   │   │   ├── database.py      # SQLAlchemy engine/session
│   │   │   └── models.py        # User model
│   │   ├── routers/auth.py      # /api/auth/* endpoints
│   │   ├── schemas/auth.py      # Pydantic request/response models
│   │   └── utils/
│   │       ├── parser.py        # Plain-English problem parsing
│   │       ├── exporter.py      # DOCX/PDF generation
│   │       └── file_extractor.py
│   ├── tests/                   # pytest suite for solvers + parser
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx               # Main app shell
    │   ├── api/client.js         # Backend API wrapper
    │   ├── context/AuthContext.jsx
    │   └── components/
    │       ├── auth/AuthPage.jsx
    │       ├── SmartInterpolation.jsx
    │       ├── ChatInterface.jsx     # General solver chat UI
    │       ├── SolutionRenderer.jsx  # Renders a solved result
    │       ├── SolutionChart.jsx     # Recharts visualizations
    │       ├── InterpolationTutorial.jsx
    │       └── ProfilePanel.jsx
    └── public/                  # Logo, favicon, static assets
```

---

## Running locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` (see `backend/.env.example` for the full list):

```
JWT_SECRET_KEY=<any random string>
GOOGLE_CLIENT_ID=<your Google OAuth client ID>
SMTP_HOST=...
SMTP_PORT=...
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=...
SMTP_FROM_NAME=...
```

Then run:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (see `frontend/.env.example`):

```
VITE_GOOGLE_CLIENT_ID=<same Google OAuth client ID as the backend>
```

`VITE_API_URL` doesn't need to be set locally — it defaults to
`http://localhost:8000/api` when absent.

```bash
npm run dev
```

Visit http://localhost:5173.

### Tests

```bash
cd backend
pytest tests/
```

---

## Deployment notes

- **Backend (Render):** root directory `backend`, build command
  `pip install -r requirements.txt`, start command
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set all the `.env`
  variables above as environment variables in the Render dashboard, plus
  `FRONTEND_URL` set to the deployed frontend's URL (needed for CORS).
- **Frontend (Vercel):** root directory `frontend`, framework auto-detected
  as Vite. Set `VITE_GOOGLE_CLIENT_ID` and `VITE_API_URL` (pointing at the
  Render backend + `/api`) as environment variables.
- **Google OAuth:** the Google Cloud Console OAuth client needs both the
  local (`http://localhost:5173`) and deployed frontend URL listed under
  **Authorized JavaScript origins** (and **Authorized redirect URIs**), or
  Google Sign-In will fail with `origin_mismatch` on the deployed site.
- **Database:** SQLite, created automatically on first run. Render's free
  tier disk is not persistent across redeploys — fine for a demo, but a
  managed Postgres database is recommended before relying on it for real
  user data long-term.
- Render's free tier spins the backend down after 15 minutes of inactivity;
  the first request after idle can take 30–60 seconds to respond.

---

## Security notes

- Never commit `backend/.env` or `frontend/.env` — see `.gitignore`.
  `.env.example` files in both folders document the required variable names
  without real values.
- If a secret is ever accidentally exposed (e.g. pasted somewhere it
  shouldn't be), rotate it — generate a new value and update it everywhere
  it's configured (local `.env` files and the Render dashboard).
