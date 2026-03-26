# Presentation Talking Points

## Files in `ppt/`

| File | Purpose |
|------|---------|
| `siloed.html` | Siloed workflows (problem) |
| `M6.html` | M6 unified platform (vision) |
| `M6.2.html` | M6 + technical stack + multi-personas |
| `softwareArchitecture.html` | **Technical graph:** simulation → Docker (PG + FastAPI) → fan-out to desktop / iPad / control room; **AWS** (API GW, Lambda, S3); **Jenkins** CI/CD; **React + Redux + Plotly** (required); **NUI** dashed to all clients |
| `combined.html` | **Redesigned merge:** compact **SVG** (clear arrows: CI/CD, sim chain, Docker, optional AWS arc, NUI→API); **no duplicate UI nodes** — personas = **photo cards + React/Redux/Plotly** text; AWS **small**; legend explains redesign |
| `pptSlide1.html` | **One PPT slide** (16:9): **6 M6 pills** (no Multi-User) + **full arch** — **big type**, short summaries |
| `pptSlide1.html.talkingPoints.md` | **Speaker notes** for `pptSlide1.html` only |
| `TALKING_POINTS.md` | Speaker notes (this file) |

Open HTML files in a browser from the `ppt` directory (double-click or `open ppt/softwareArchitecture.html`).

---

## Combined deck: COMBINED.HTML (business-first, architecture-backed)

Use **one URL/slide** when pitching **executives and technical leads** together.

### Story arc (2–3 min)
1. **Title + banner** — Collaboration and **decision making**; one stack for cubicle, field, control room.
2. **M6 badges** — Name all six (plus multi-user); you’re anchoring vocabulary.
3. **Bridge grid** — For each M6 bullet, point to **one phrase** of tech (Postgres, Docker, WebSocket, Plotly, NUI, Jenkins). *This is the link between value and credibility.*
4. **Side columns** — Multi-purpose / multi-dimensional (left); multi-personas / location / device (right).
5. **Center graph** — “Under the hood” in one view: simulation → governed core → AWS → three modalities + NUI.
6. **Outcomes row** — Maps product promises to **Visualization / Sync / API / Version control**.
7. **Persona strip** — Human proof; same stack for every photo.
8. **Legend** — Technical narrative; end with **For executives** paragraph.

### One-liner
> “M6 is what we promise; this graph is how we keep it honest—**single source of truth**, **shareable links**, and **one backend** for every persona.”

---

## Slide 0 (optional): SOFTWAREARCHITECTURE.HTML — Pure technical diagram

Use when the audience wants **only** the integration picture—no M6 / collaboration framing.

### What to say (60–90 sec)
> "Data originates in **RTDS**, feeds **PSCAD** for electrical / EMTDC co-simulation, then flows into **FlexSIM**, which we implement in **Python** for acquisition and processing. FlexSIM persists into **PostgreSQL**. The **Python API**—for example FastAPI—reads the database and serves **REST/JSON**. The **HTML / JavaScript** front end is what people see in the browser; it **consumes** that API for visualization."

### Point at arrows
- **Cyan:** simulation pipeline and writes to the database  
- **Gold (dashed):** CI/CD (e.g. **Jenkins**) into **Docker** images / deploy  
- **Violet:** bidirectional ORM between **PostgreSQL** and **FastAPI**  
- **Orange / green:** **AWS** edge — API Gateway, **Lambda**, async call-backs  
- **Pink:** one backend serving **three modalities** (desktop, iPad, control room)  
- **Purple (dashed):** **NUI as a service** into every client  

### If using the latest graph layout
> "This is intentionally a **graph**, not a ladder: the same **Docker** boundary hosts DB and API; **Plotly** and **Redux** are non-negotiable on every surface; Lambdas and NUI add **future** paths without redrawing the core."

---

## Slide 1: SILOED.HTML — The Problem (Show First)

### Opening (30 sec)
> "Today, every engineer has their own toolbox. That means the same dataset gets visualized in different ways—different units, different scaling, even different filtering."

### Make the Risk Explicit
> "So we don't just have a tooling problem—we have a **decision problem**. Two people can look at the same data and walk away with different conclusions."

### Hit the Root Cause
> "The root issue is that we don't have a **single source of truth** for visualization—everything is local, fragmented, and shared as static artifacts."

### What You See on the Slide
- **Three silos**: Engineer A (Python/Matlab), Engineer B (Excel), Engineer C (Custom tool)
- **Sharing**: Email, screenshots, CSV, attachments—no live connection
- **Result**: Same data → different plots → conflicting interpretations

### Pain Points to Emphasize
- ❌ No version control (multiple inconsistent copies)
- ❌ No provenance (unclear origin or transformation history)
- ❌ Inconsistent representation (MW vs kW, linear vs log, different filters)
- ❌ Poor reproducibility (can't recreate results)
- ❌ No real-time collaboration
- ❌ No M6: single user, single location, single device

### Transition to Solution
> "What if we could change this? What if instead of three silos, we had one platform where everyone sees the exact same thing?"

---

## Slide 2: M6.HTML — The Solution (Show Second)

### Introduce the Solution
> "What we're proposing is simple: a **web-based, cloud platform** where the data and the visualization live together."

### Emphasize Behavior Change
> "Instead of emailing plots, we **share a link**. That link is the data, the visualization, and the configuration—all in one."

### Highlight the Breakthrough
> "Now everyone sees the exact same thing, can modify it live, and save a new version—with full traceability."

### M6 — The Six Pillars (Walk Through Each)

> **Note:** For the **technical + persona story** (Docker, AWS, PostgreSQL roadmap, React/Python, FFA + control room, **collaboration**, **decision making**), use **M6.2.html** after this slide.

1. **Multi-User** (in M6.2, pair with **Multi-Personas**: cubicle, field, control room)
   > "Anyone with the link can open it. No more sending files back and forth."

2. **Multi-Location**
   > "Imagine plotting data on your desktop, then walking to a meeting room and zooming on the big screen—it syncs instantly. Or your colleague in another building sees your zoom in real time."

3. **Multi-Device**
   > "Desktop, laptop, tablet—browser tabs across devices stay in sync. One view, everywhere."

4. **Multi-Purpose**
   > "Today we're looking at simulation data. Tomorrow it could be material science, thermal analysis, or any domain. Same platform, standardized visualization."

5. **Multi-Modal (Future)**
   > "We're architecting for NUI—Natural User Interface as a service. Voice commands, gesture recognition, Kinect, eye tracking. The platform is ready for it."

6. **Multi-Dimensional**
   > "2D, 3D, N-dimensional data. Time series, spatial, tensors. One engine, consistent representation."

### Key Benefits to Call Out
- ✅ **100% reproducible** — Every plot tied to dataset + config
- ✅ **Consistent interpretation** — Same units, scaling, transformations
- ✅ **Real-time collaboration** — Modify, visualize, save, share instantly
- ✅ **Eliminates version chaos** — Single source of truth
- ✅ **Scales** — Handles large datasets centrally

### Closing (1 Sentence Vision)
> "Instead of emailing plots, we share a link—and everyone sees, modifies, and builds on the **exact same truth**."

---

## Quick Reference: Before vs After

| Before (Siloed) | After (M6) |
|-----------------|------------|
| Local toolchains per engineer | Cloud-hosted single platform |
| Sharing via screenshots/files | Share via URL |
| No version control | Full audit trail, versioned |
| Same data, different plots | Standardized units, scaling, transforms |
| Conflicting interpretations | Consistent interpretation |
| Manual sync | Live collaboration |
| Single user, single device | Multi-user, multi-device, multi-location |

---

## Slide 3: M6.2.HTML — Technical Architecture & Multi-Personas (Optional Third Slide)

Show **after** M6.html when you want to ground the vision in **this repo** and **three concrete personas**.

### Opening Hook
> "Version two of the architecture shows something critical: it's not abstract cloud—it's **Docker**, **Python**, **React**, **future PostgreSQL**, and **AWS** — and **every persona hits the same stack**."

### Collaboration & Decision Making
> "We frame this as **multi-personas**, not just multi-user: a **simulation scientist in the cubicle**, an **FFA in the field with an iPad**, and a **control room with big screens** all need **collaboration** on the same data. That's how we support consistent **decision making**—no duplicate truths."

### What’s on the Slide (Walk the Viewer)
- **Top banner**: Collaboration → shared stack → decision making; same DB, Docker, AWS, Python, React.
- **Tech rows**: AWS/Cloud + Docker; React, HTML/CSS/JS, Python, FastAPI/Uvicorn; PostgreSQL (roadmap) + service names aligned with `docker-compose` (`dcs-ui`, `dcs-backend`).
- **Persona cubes (photos)**: Desktop cubicle, Laptop scientist, **Tablet C (FFA)** in plant/field, **Control room** big screens, Office D second site—each cube shows tiny stack tags (PG, Docker, AWS, etc.) to reinforce **one infrastructure**.
- **Animations**: Subtle motion on badges and stack layers—**multi-location** idea “everything dances to the same backend.”

### Tie to M6 Pillars (Keep All Original Words)
- **Multi-Personas** + **Multi-User** (both on slide)—personas are how we organize users in the field, lab, and control center.
- **Multi-Location / Multi-Device / Multi-Purpose / Multi-Modal / Multi-Dimensional** — unchanged from M6 messaging.
- **NUI stack**: Web Speech, WebRTC, MediaPipe/TF.js, Kinect, OpenCV, WebXR, WebSocket/SSE—future-ready.

### Closing Line
> "Whether you're at a desk, on the plant floor, or in the control room—you're not exporting screenshots; you're in the **same product**, on the **same services**, for defensible **decision making**."

---

## Timing Suggestion

- **Siloed slide**: 2–3 minutes (establish pain)
- **M6 slide**: 3–4 minutes (solution + M6 walkthrough)
- **M6.2 slide** (optional): 3–4 minutes (technical credibility + personas + collaboration)
- **Q&A**: Leave time for questions
