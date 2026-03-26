# pptSlide1.html — Talking points (full M6 + architecture)

This slide shows **six M6 pills** (no separate “Multi-User” — covered by Multi-Personas) and the **full stack** (RTDS → PSCAD → 🐍 FlexSIM → 🐳 Docker with 🐘 PostgreSQL ↔ 🐍 FastAPI, plus AWS & NUI, then five client surfaces). Fonts are sized for **projection**, not spec sheets.

---

## Open (20 sec)

> “This is the **M6 Unified Visualization Platform**. **M6** names six dimensions on the slide: personas, location, device, purpose, modality, and dimension — all on **one backend** so we get **collaboration** and **decision-grade** consistency.”

---

## Walk the architecture top → bottom (45–60 sec)

**CI/CD + Docker**  
> “We **govern how software ships**: **Jenkins**, **Git**, promoted **Docker** images — so what runs in the room is what we tested.”

**Simulation chain**  
> “Data comes from the **lab path** the business trusts: **RTDS**, **PSCAD**, **Python FlexSIM** — not a one-off CSV export.”

**Docker core**  
> “Inside **Docker** we keep **PostgreSQL** as system of record and **FastAPI** as the API — **🐘 and 🐍** on purpose: one database truth, one service layer.”

**AWS & NUI**  
> “**AWS** — **API Gateway**, **Lambda**, **S3**, **scale** and **edge** — when we need it. **NUI as a service** — **voice**, **gesture** — still the **same API**.”

**Clients**  
> “**Desk, laptop, field tablet, control room, remote** — same **React, Redux, Plotly** story; we only fork the **surface**, not the **truth**.”

---

## Close (15 sec)

> “**M6** is the contract; this drawing is the **minimum architecture** that keeps it honest. Detail decks use **`combined.html`** — this slide is the **one-screen** version for PowerPoint.”

---

## If they ask “where’s the diagram like before?”

> “Same **nodes and relationships** as **`combined.html`**, rebuilt in **big HTML blocks** so nothing is 8pt. If you need the vector graphic for a paper, use **`combined.html`**.”

---

## ~1 minute — continuous talk track (read aloud / paraphrase)

We built **M6** as the direct response to the **siloed** picture you just saw: one platform that unifies **data** and **devices** into a **single system**. What **M6** encodes in practice is **multi-persona** / **multi-user** access, **multi-device** clients, use in **multiple locations**, and **multi-dimensional** presentation of the same underlying information—so we are not reconciling several local worlds after the fact. **Multi-modality**—**voice**, **hand tracking**, **gesture recognition**, **eye tracking**, and similar channels—is part of the forward path; today the emphasis is a shared analytical and visualization surface backed by one store. The stack is also deliberately **multi-purpose**: the dominant load today is **simulation** data, but the architecture is **polymorphic** in the sense that the same **PostgreSQL** foundation, running **containerized** on **AWS**, can support other domains without duplicating “official” views or forking the database. Operationally, that lets a **simulation scientist** present clearly to a **stakeholder**, and it lets an **FFA** or **plant manager** in a **control room** decide from data that the technical team has already exercised—**same visualization layer**, **same plots**, **same scales**, **same form factors**, **same naming on the axes**, **same filters**, **same data-exploration context**—so debate is about interpretation and risk, not about which file or screenshot happened to circulate.
