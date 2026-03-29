# AI Advertising Engineering Skills Assessment Platform

A premium, state-of-the-art SaaS platform designed to evaluate AI Engineering skills through interactive prompt generation, vision auditing, and document-grounded RAG (Retrieval-Augmented Generation).

![Engineer Shahan Lab UI](https://img.shields.io/badge/UI-Vite%20React-blue?style=for-the-badge&logo=react)
![Python Backend](https://img.shields.io/badge/Backend-FastAPI-green?style=for-the-badge&logo=fastapi)
![Agent SDK](https://img.shields.io/badge/Agent-OpenAI_Custom_SDK-black?style=for-the-badge&logo=openai)
![Model](https://img.shields.io/badge/Model-Gemini_2.5_Flash-purple?style=for-the-badge)

## 🌟 Core Features

- **1.1 Copywriting API:** Generate creative, JSON-structured ad copy variations (Headlines, Taglines, Body, CTA) instantly utilizing Gemini.
- **1.2 Prompt Lab:** Automatically evaluate and rewrite weak prompt logic into structured, high-performance 'Chain-of-Thought' architectures with calculated Enhancement Metrics scoring. 
- **2.1 Brief Analyzer:** Ingest complex text or PDFs to auto-extract strategic insights, target profiles, risk analysis, and execution logistics using purely client-side logic + Gemini integrations.
- **2.2 Vision Audit:** Perform advanced localized Safety & Tagging scans on uploaded image assets (Image-to-Text).
- **2.3 RAG Bot (Powered by FastAPI):** A dedicated Python Agent backend providing native PDF ingestion (`pypdf`), chunking, and contextual "Stuffing" to allow grounded Q&A conversations that strictly adhere to the OpenAI Agent SDK routing constraints while resolving Gemini proxy rate limits.
- **3.0 Practical Sandbox:** Integrated code editor interface explicitly designed for engineering challenges.

> **Note on Architecture:** The platform features an ultra-premium "Dark Matrix First" UI with glassmorphism `GlassCard` rendering, Framer Motion dynamic transitions, and distinct `lucide-react` visual telemetry.

---

## 🛠 Prerequisites

### Environment Secrets
You must configure your local environment with valid AI tokens before booting up.
Create a `.env` file at the root of the project:
```env
# Root /.env
GEMINI_API_KEY=your_gemini_key_here
VITE_GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_tracing_key_here # Optional for observability
```

---

## 🚀 Installation & Setup

This application uses a Dual-Node architecture (React Vite Frontend + FastAPI Python Backend). Both must be running simultaneously.

### 1. Start the Python Backend (RAG Core)
The Python server handles the advanced Agent SDK pipelines and PDF ingestion.

```bash
# 1. Open a terminal in the project root
cd "E:\Opencode Cli\AI ENGINEER"

# 2. (Optional) Create a virtual environment
python -m venv venv
.\venv\Scripts\activate

# 3. Install Python Dependencies
pip install -r requirements.txt

# 4. Boot the FastAPI Server
python agent_server.py
```
*The backend will boot up and bind to `http://localhost:8003`.*

### 2. Start the React Frontend
The Vite server handles the Next-Generation Glassmorphism UI.

```bash
# 1. Open a second terminal in the project root
cd "E:\Opencode Cli\AI ENGINEER"

# 2. Install Node Dependencies
npm install

# 3. Boot the Vite Development Server
npm run dev
```
*The frontend will boot up. Click the local network link (e.g., `http://localhost:3002`) provided in the terminal to access the Dashboard.*

---

## 🏗 Technical Stack

* **Frontend:**
  * React 18
  * Vite
  * TailwindCSS (Advanced Glassmorphism & Depth shadow utilities)
  * Framer Motion (Micro-animations)
  * Lucide React (Iconography)
  * PDF.js (Client-side asset parsing fallback)

* **Backend:**
  * Python 3.10+
  * FastAPI & Uvicorn (Orchestration)
  * PyPDF (Native lightweight text extraction)
  * `agents` (Custom strict internal OpenAI-compatible wrapper SDK)
  * Google Gemini `2.5-flash` and `2.5-flash-lite`

---

## ⚖️ Troubleshooting

* **`429 RESOURCE_EXHAUSTED` in Chat/UI:** If you are testing heavily, the strict Free Tier limits for Gemini 2.0 might kick in. The application has been permanently swapped to the high-capacity `gemini-2.5-flash` model to prevent this bottleneck.
* **`Error connecting to the OpenAI Agent SDK backend`:** Ensure your Python terminal is running the FastAPI script without hanging and is explicitly on port `8003`.
* **CORS Errors on RAG bot:** Vite natively connects to `localhost:8003/chat`. If you move the backend, you must update the `fetch()` endpoints in `src/App.jsx`.
