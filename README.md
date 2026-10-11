# SPECTRA — Reliable Indoor Positioning with Self-Diagnosis

**Track:** CODE APEX 3.0 • AI/ML & Smart Systems  
**Team:** NonChalants  
**Team Leader:** Prathamesh Prashant Daph  
**Output Contract:** Floor ID + X Coordinate + Y Coordinate (2.5D Positioning) + Uncertainty Ellipse & Confidence Score

---

## 1. Overview & Problem Statement

Global Positioning System (GPS) fails completely in indoor multi-story environments. Conventional indoor localization algorithms (such as Ordinary Least Squares multilateration) make a fatal assumption: **they treat every ranging measurement as ground truth**.

In real-world facilities (warehouses, hospitals, industrial sites, airports), RF signals encounter:
1. **Severe Non-Line-of-Sight (NLOS) Multipath:** Signal reflection through concrete walls or metallic obstacles introduces an unpredictable positive delay ($b_i > 0$), pulling standard estimators wildly off target.
2. **Sparse Anchor Constellations:** High infrastructure costs limit deployment to sparse anchors (3–6 per floor), causing ill-conditioned geometric matrices (high GDOP).
3. **Noisy and Dropped Telemetry:** Packet collisions and interference cause missing readings.
4. **Anchor Hardware Failures:** Anchors drop offline or broadcast corrupted data.
5. **Floor Ambiguity:** Vertical signal bleeding between floors can cause disastrous wrong-floor classification.

### The SPECTRA Solution
**"A range is evidence — not ground truth."**  
SPECTRA evaluates measurement trust **before** solving the position fix. It dynamically identifies NLOS positive biases and outliers, downweights compromised anchors, performs temporal tracking via an Adaptive Extended Kalman Filter (EKF), executes 2.5D floor inference with temporal hysteresis, and provides geometry-driven sensor polling recommendations.

---

## 2. Mathematical Foundation & Algorithms

### A. Measurement Model
For target $(x, y)$ on floor $F$ and anchor $i$ at $(x_i, y_i, z_i)$:
$$d_i = \sqrt{(x - x_i)^2 + (y - y_i)^2 + (z - z_i)^2} + \epsilon_i + b_i$$
- $\epsilon_i \sim \mathcal{N}(0, \sigma_i^2)$: Zero-mean Gaussian measurement noise.
- $b_i \ge 0$: Non-Line-of-Sight positive bias (multipath delay).

### B. Self-Diagnosis & Trust Scoring
At each epoch, SPECTRA computes the residual against candidate position:
$$r_i = d_i - \hat{d}_i$$
- **NLOS Detection:** When $r_i > +1.0\text{ m}$ (positive bias), the engine flags NLOS reflection.
- **Trust Weight $T_i \in [0.05, 1.0]$:**
  $$T_i = \exp\left(-\frac{\max(0, r_i - r_{\text{tol}})^2}{2\sigma^2}\right)$$
- **Outlier Rejection:** Residuals exceeding $3.2\text{ m}$ ($>3\sigma$) are completely isolated ($w_i = 0$).

### C. Robust Soft-L1 Multilateration
Instead of quadratic penalty $(r^2)$ which allows outliers to pull the fix, SPECTRA minimizes Soft-L1 / Huber loss:
$$\min_{x, y} \sum_{i=1}^M \rho\left(\sqrt{T_i} \cdot \frac{r_i}{\sigma_0}\right), \quad \rho(z) = 2\left(\sqrt{1 + z^2} - 1\right)$$

### D. Adaptive Extended Kalman Filter (EKF)
State vector: $\mathbf{x} = [x, y, v_x, v_y]^T$.  
**Dynamic Covariance Scaling:** Measurement noise covariance $R_i$ is dynamically scaled inversely with trust weight:
$$R_i = \frac{\sigma_0^2}{\max(T_i, 0.08)^2}$$
When an anchor suffers from NLOS or high noise, its variance in the Kalman update expands exponentially, preserving trajectory smoothness and eliminating sudden jumps.

### E. 2.5D Floor Classification
A two-stage hierarchical model:
1. Stage 1: Evaluates posterior likelihood across candidate floors $F \in \{1, 2, 3\}$ using multi-floor anchor packet reception, vertical altitude evidence, and geometric residuals.
2. Temporal Hysteresis: Requires consecutive confirmation epochs before switching floors, preventing chatter near stairwells.
3. Stage 2: Solves 2D coordinates on the selected floor plane.

### F. Adaptive Measurement Decisions
When Dilution of Precision is poor ($\text{GDOP} > 3.5$) or active anchors $< 4$:
- Uses the Fisher Information Matrix (FIM) Jacobian $H$ to evaluate network geometry.
- Identifies the optimal auxiliary anchor or frequency-shift action that maximizes the determinant of $H^T H$ and reduces GDOP.

---

## 3. Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, Recharts
- **Backend:** Python 3.14 / 3.11+, FastAPI, Uvicorn, NumPy, SciPy (`least_squares`), SQLite3, WebSockets
- **UI/UX Aesthetic:** Minimal, modern enterprise SaaS inspired by Linear, Vercel, and Stripe. Clean light theme with slate/charcoal typography, restrained indigo accents, and dark mode support.

---

## 4. Getting Started & Installation

### Prerequisites
- Node.js (v18+) and npm
- Python (v3.10+) with `fastapi`, `uvicorn`, `numpy`, `scipy`

### Quick Start

#### 1. Start the FastAPI Backend
```bash
cd backend
python run_backend.py
# Backend runs at http://127.0.0.1:8000
# OpenAPI Docs available at http://127.0.0.1:8000/docs
```

#### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs at http://127.0.0.1:5173
```

---

## 5. Running Automated Unit Tests

Run the backend verification suite to validate multilateration, NLOS resistance, EKF tracking, and floor classification:

```bash
python backend/tests/test_positioning.py
```

Expected output:
```
Ran 5 tests in 0.475s
OK
[TEST PASSED] NLOS Test: Baseline OLS Error = 2.113m | SPECTRA Robust Error = 1.117m (Saved: 47.1%)
```

---

## 6. Presentation-Ready Guided Demo

Click the **Guided Demo** button in the top right corner of the dashboard to trigger the interactive 6-step demonstration:
1. **Nominal Indoor Positioning:** Observe clean LOS tracking with tight 95% uncertainty ellipse.
2. **Introduce NLOS Multipath & Packet Loss:** Watch the red baseline OLS marker diverge while SPECTRA isolates the biased anchor and stays on course.
3. **Anchor Dropout & Geometric Degradation:** Take Anchor A2 offline; watch GDOP increase and uncertainty bounds expand truthfully.
4. **Self-Diagnosis & Adaptive Decisions:** Inspect the real-time diagnostic narrative explaining downweighted anchors and recommended frequency hopping.
5. **Empirical Benchmark Suite:** Run the Monte Carlo batch evaluation comparing MAE, RMSE, P95, and latency side-by-side with exportable CSV/JSON reports.
6. **Graceful Handling of Insufficient Evidence:** Simulate extreme anchor blackout (dropping 4 anchors); watch SPECTRA safely dead-reckon and alert the operator instead of hallucinating.

---

## 7. Project Structure

```
spectra-positioning/
  ├── backend/
  │    ├── app/
  │    │    ├── main.py                     # FastAPI entry point, CORS, WebSockets
  │    │    ├── models.py                   # Pydantic schemas (telemetry, benchmarks, diagnostics)
  │    │    ├── database.py                 # SQLite persistence layer
  │    │    ├── engine/
  │    │    │    ├── positioning.py          # OLS & Robust Soft-L1 solvers, GDOP, error ellipses
  │    │    │    ├── tracker.py              # Adaptive Extended Kalman Filter (EKF)
  │    │    │    ├── floor_classifier.py     # 2.5D hierarchical floor inference
  │    │    │    ├── self_diagnosis.py       # Residual analysis, NLOS detection, trust scoring
  │    │    │    ├── adaptive_recommender.py # Fisher Information & GDOP action recommender
  │    │    │    └── simulator.py            # Physics motion & RF impairment simulation
  │    │    └── api/
  │    │         ├── routes_telemetry.py     # Live telemetry streaming & simulation state
  │    │         ├── routes_benchmark.py     # Monte Carlo batch evaluation
  │    │         ├── routes_experiments.py   # SQLite run history, CSV & JSON export
  │    │         └── routes_anchors.py       # Anchor constellation topology
  │    ├── tests/
  │    │    └── test_positioning.py         # 5 comprehensive test suites
  │    └── run_backend.py
  ├── frontend/
  │    ├── src/
  │    │    ├── components/
  │    │    │    ├── Header.tsx              # Brand, floor switcher, live indicator, theme toggle
  │    │    │    ├── FloorMap.tsx            # 2.5D architectural canvas, range vectors, error ellipses
  │    │    │    ├── TelemetryCards.tsx      # High-density KPI cards
  │    │    │    ├── SelfDiagnosisPanel.tsx  # Anchor trust breakdown, residual bars, narrative log
  │    │    │    ├── AdaptiveActionCard.tsx  # Real-time action recommendation & execution
  │    │    │    ├── SimulationLab.tsx       # Live noise, NLOS, speed sliders & scenario presets
  │    │    │    ├── BenchmarkView.tsx       # Comparative tables, time-series, CDF charts, export
  │    │    │    ├── HistoryView.tsx         # SQLite saved experiment registry
  │    │    │    └── GuidedDemoModal.tsx     # 6-step guided walkthrough
  │    │    ├── services/api.ts              # API client & resilient WebSocket manager
  │    │    ├── types/index.ts               # TypeScript data models
  │    │    ├── App.tsx                      # Root layout & tab router
  │    │    └── index.css                    # Tailwind CSS + custom tokens
  └── README.md
```
