# pptSlide2.html — Talking points

Use **after** the room agrees there is pain, **before** **pptSlide1** (unified M6 + architecture). Keep tone factual: **this is the baseline**, not a blame slide.

---

## Open (15 sec)

> “The headline is **siloed visualization**; the line underneath frames it as **current practice** — **siloed toolchains and workflows** — not best-in-class architecture, just **what’s typical today**.”

Point to the **six cards**: each has a **small schematic** (version chaos, broken lineage, mismatched units, diverging runs, manual vs stale, isolated users) so the audience reads **pain** visually, not only as bullets.

---

## Walk the three silos (25–35 sec)

**Simulation scientist A — Python / Matlab**  

> “Results live on a **local machine**. Peers see outputs via **email** and **screenshots** — not queryable data.”

**Plant manager / stakeholder — Excel**  

> “Same study gets **flattened into spreadsheets**, passed as **attachments** and **CSV** — **units** and **version** get fuzzy fast.”

**Control room engineer — custom tool**  

> “A **one-off** or **departmental** viewer — **export** and **copy-paste** become the integration layer.”

**Bridge line (center)**  

> “Everyone can be looking at **the same underlying phenomenon** and still walk out with **different plots** and **different conclusions** — because there is **no single governed view**.”

---

## Six consequences — read as checklist (20–30 sec)

> “Mechanically you lose the things executives care about: **no version control**, weak **provenance**, **scaling and units** that don’t line up, **reproducibility** suffers, **manual sync** drives **interpretation drift**, and there is **no real-time collaboration** on one truth.”

Pause after **audit trail** if your audience is **quality / regulated** context.

---

## Close into M6 / slide 1 (15 sec)

> “This is the **anti–M6** picture: **single** user, **single** place, **single** device, **single** purpose, **single** modality, **thin** dimensions. **Next slide** is how we **flip** that — **one link, one backend, six M6 dimensions** without fragmenting the stack.”

---

## If they push back (“we already share a drive”)

> “A **shared drive** is **not** a **visualization contract**. You still get **forked plots**, **stale attachments**, and **no API** — the **next slide** shows where **truth** actually lives.”

---

## Pairing


| File             | Role                                             |
| ---------------- | ------------------------------------------------ |
| `pptSlide2.html` | **16:9** one-screen **problem** for PowerPoint   |
| `siloed.html`    | Same story, **scrollable** detail / leave-behind |

---

## ~1 minute — continuous talk track (read aloud / paraphrase)

The current state of the art is that today, we have **siloed visualization** — in other words, **current practice** really is **siloed toolchains** and **workflows** spread across people who are all trying to decide something, which is why we end up with **fragmented workflows** and **no single source of truth**. Indeed, a **simulation scientist A** may live in **Python / Matlab** on a **local machine** and share by **email** or **screenshot**; separately, a **plant manager / stakeholder** may anchor the story in **Excel**, still on a **local machine**, passing **attachments** or **CSV**; and a **control room engineer** may rely on a **custom tool**, again **local**, and move data by **export** or **copy‑paste** — and that’s the everyday glue. When you add it up, you get what the slide says in one line: **same data**, **different plots**, **different conclusions**. Under that you see the consequences we’re naming out loud — **no version control**, **no provenance / audit**, **inconsistent scaling & units**, **poor reproducibility**, **manual sync** and **drift**, and **no real-time collaboration** — so we’re not pretending the pain is abstract. And that bottom line is deliberate too: today it’s **no M6** — **single user**, **location**, **device**, **purpose**, **modality** — **limited dimensions** — which is exactly why the next slide has to be about breaking out of that box.

