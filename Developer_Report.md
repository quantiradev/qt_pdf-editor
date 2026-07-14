# QT PDF Editor - Developer Project Report

## 1. System Architecture Overview

The QT PDF Editor is a full-stack web application designed for in-browser PDF manipulation, real-time annotation, and document management.

- **Frontend:** Next.js (React), Zustand (State Management), Tailwind CSS, PDF.js (Client-side rendering).
- **Backend:** FastAPI (Python), PyMuPDF (PDF parsing and manipulation), Uvicorn (ASGI Server).
- **Data Layer:** File-based JSON database (`db.json`) for metadata and local filesystem for PDF binary storage.

The architecture follows a classic Client-Server model where the heavy lifting (parsing PDF structures, baking annotations, extracting fonts) is offloaded to the Python backend via PyMuPDF, while the React frontend handles UI interactions, canvas rendering, and state sync.

---

## 2. Backend Subsystem (Python / FastAPI)

The backend exposes a REST API to manage documents and process PDF mutations.

### Key Modules:
- **`main.py`**: The FastAPI application entry point. Routes incoming HTTP requests (upload, fetch, save annotations, merge pages, undo/redo operations). Uses `uvicorn` for auto-reloading during development.
- **`pdf_ops.py`**: The core workhorse for PDF mutations. It contains logic to `get_paragraphs` (extracting bounding boxes and text from PDFs), apply text edits (`_apply_text`), add shapes, handle redactions (`apply_redactions`), and draw annotations directly onto the PDF buffer.
- **`text_engine.py`**: A complex typography and text-fitting engine. It calculates font metrics, text wrapping, line heights, and maps PDF font descriptors to CSS-compatible font families (categorizing into `sans`, `serif`, `mono`). It handles the highly technical challenge of making HTML text look exactly like embedded PDF text.
- **`storage.py`**: Manages the local filesystem (`data/` directory). Handles versioning by maintaining an array of `undo` and `redo` snapshot files, allowing non-destructive rollback of PDF edits. Updates the `db.json` metadata index.
- **`auth.py`**: Handles authentication scaffolding (if applicable/extended in the future).

---

## 3. Frontend Subsystem (Next.js / React)

The frontend is a highly interactive, state-driven canvas editor.

### Core Components (`frontend/components/editor-studio/`):
- **`Editor.tsx` / `Previewer.tsx`**: The main layout wrappers. They orchestrate the sidebars, top bar, and the central canvas stage.
- **`CanvasStage.tsx`**: Manages the zoom/pan logic and renders the visible PDF pages.
- **`PageView.tsx`**: The bridge between React and Mozilla's `pdf.js`. It renders the raw PDF binary into a `<canvas>` element and overlays the text selection layer.
- **`AnnotLayer.tsx`**: The most complex interactive component. It renders live text editors (`TextBlockView`), sticky notes, shapes, and handles drag/drop, resize, and double-click-to-edit interactions.
- **State Management (`store.ts`)**: Uses Zustand to hold the transient state of all annotations, the current selected tool (e.g., pen, text, shape), zoom levels, and the active document metadata.
- **Styling (`globals.css`)**: Implements a custom CSS variable system (`--e-*`) to scope editor styles aggressively, preventing conflicts with standard Tailwind classes. Implements glassmorphism UI utilities and custom scrollbars.

---

## 4. Technical Challenges & Recent Resolutions

During the recent development sprints, several complex technical bugs bridging the frontend and backend were resolved:

### A. The "Ghost Text" Race Condition (Frontend)
- **Symptom:** New text annotations would disappear if the user clicked outside the text box before saving.
- **Root Cause:** A React race condition. Clicking outside the text box fired the `onPointerDown` event on the parent container, which immediately unmounted the text editor component. This unmount occurred *before* the browser could fire the `onBlur` event on the textarea, meaning the text was never committed to the Zustand store.
- **Fix:** Refactored `AnnotLayer.tsx` to use an `onChange` handler that continuously syncs the text state to the store on every keystroke. Added a state snapshot right before editing (`s.snapshot()`) to preserve undo/redo history.

### B. The Redaction Mask Rendering (Frontend/CSS)
- **Symptom:** Editing text on a PDF with a non-white background resulted in a glaring white rectangle covering the original text.
- **Root Cause:** The system uses a `.tb-mask` `div` to visually hide the underlying baked PDF text so the live HTML editor doesn't overlap it. This mask defaulted to `#ffffff`.
- **Fix:** Implemented a dynamic background color sampling utility within `AnnotLayer.tsx` (using a `MaskBlock` component). The app now samples the exact background pixel color of the PDF canvas adjacent to the text block and applies it to the mask, rendering it invisible to the user.

### C. Font Family Detection (Backend)
- **Symptom:** Sans-serif fonts with modern weight names (e.g., "Avenir-Book") were being sent to the frontend as Serif fonts, changing the visual style drastically during edits.
- **Root Cause:** In `text_engine.py`, the `_flags_style` function used a greedy substring match (`"book" in font_name`) to detect serif fonts like "Bookman". It incorrectly flagged sans-serif fonts containing the weight "Book".
- **Fix (and Revert):** Investigated and fixed the heuristic to check for strict names (`bookman`), resolving the mapping issue. *(Note: This was subsequently reverted based on explicit user request).*

---

## 5. Future Development Considerations

- **Concurrency & Locking:** Since the system relies on a local `db.json`, simultaneous multi-user edits on the same document might cause race conditions at the file system level. Transitioning to SQLite or PostgreSQL would be advised for scaling.
- **Font Subsetting:** To achieve perfect 1:1 parity between the browser editor and the original PDF, a future integration could extract the embedded font binaries from the PDF via PyMuPDF and inject them into the DOM via `@font-face`.
- **Canvas Virtualization:** For PDFs exceeding 50-100 pages, the current `CanvasStage` could suffer performance degradation. Implementing `react-window` or custom DOM virtualization to only render visible `<PageView>` components will ensure O(1) memory usage regardless of document size.
