# 📁 StudioMind — Folder Structure

> **Why this structure?**  
> StudioMind is a full-stack AI-powered video production studio. The project follows a **monorepo layout** — the frontend, backend, and shared code all live in one repository. This makes it easy to collaborate, share types/constants between client and server, and keep everything in sync.

---

## 🏗️ Top-Level Overview

```
studiomind/
├── client/          # React frontend (Vite)
├── server/          # Express.js backend (Node.js)
├── shared/          # Code shared between client & server
├── docs/            # Documentation
├── package.json     # Root package.json (monorepo config)
└── .git/
```

---

## 🖥️ `client/` — Frontend (React + Vite)

The entire React application lives here. Built with Vite for fast dev experience.

```
client/
├── src/                     # App entry point & global setup
│   ├── main.jsx             # React app bootstrap — mounts <App /> into DOM
│   ├── App.jsx              # Root component — holds router & top-level layout
│   ├── App.css              # Global styles for App component
│   ├── index.css            # Base/reset CSS (body, fonts, etc.)
│   ├── index.html           # HTML shell — Vite injects the bundle here
│   ├── vite.config.js       # Vite config — dev server, proxy, plugins
│   ├── eslint.config.js     # Linting rules
│   └── assets/              # Static assets bundled by Vite
│       ├── hero.png         # Hero/banner image
│       ├── vite.svg         # Vite logo
│       └── react.svg        # React logo
│
├── components/              # Reusable UI components (organized by feature)
│   ├── ui/                  # Generic UI primitives (buttons, inputs, modals, etc.)
│   ├── common/              # Shared components used across multiple features
│   ├── chat/                # Chat interface components (message bubbles, input, etc.)
│   ├── agents/              # AI agent UI (status cards, agent controls)
│   ├── dashboard/           # Dashboard widgets (stats, charts, recent activity)
│   └── upload/              # File upload components (drag-drop, progress bars)
│
├── pages/                   # Route-level page components (one folder per page)
│   ├── login/               # Login & authentication pages
│   ├── dashboard/           # Main dashboard view
│   ├── projects/            # Projects list page
│   ├── project/             # Single project detail view
│   ├── agents/              # AI agents management page
│   ├── analytics/           # Analytics & reporting page
│   └── setting/             # User settings page
│
├── routes/                  # Route definitions (React Router config)
│   └── (index files)        # Centralized route mapping
│
├── layouts/                 # Page layout wrappers (sidebar + content, auth layout, etc.)
│   └── (index files)
│
├── context/                 # React Context providers (global state)
│   └── (index files)        # Auth context, theme context, project context, etc.
│
├── hooks/                   # Custom React hooks
│   └── (index files)        # useAuth, useProject, useChat, useUpload, etc.
│
├── services/                # API client functions (calls to the server)
│   └── (index files)        # Each service maps to a backend route group
│
├── constants/               # Frontend-only constants (API URLs, config values)
│   └── (index files)
│
├── utils/                   # Utility/helper functions (formatting, validation)
│   └── (index files)
│
├── styles/                  # Global/shared CSS or theme files
│   └── (index files)
│
├── public/                  # Static files served as-is (not bundled by Vite)
│   ├── favicon.svg          # Browser tab icon
│   └── icons.svg            # SVG sprite sheet
│
├── package.json             # Client dependencies (React, Vite, etc.)
└── README.md                # Client-specific docs
```

### 📌 Client naming convention:
- **`pages/`** = top-level routes (each gets a URL)
- **`components/`** = reusable pieces used inside pages
- **`services/`** = where API calls live (not in components directly)

---

## ⚙️ `server/` — Backend (Express.js + Node.js)

REST API server that powers the AI agents, file handling, and data layer.

```
server/
├── src/
│   ├── server.js            # Entry point — creates Express app & starts listening on port 3000
│   ├── app.js               # Express app setup — middleware, CORS, body parsing (configures the app without starting it)
│   │
│   ├── config/              # Configuration & setup for external services
│   │   ├── env.js           # Environment variable loading (dotenv setup)
│   │   ├── db.js            # MongoDB connection setup (Mongoose)
│   │   ├── gemini.js        # Google Gemini AI client setup
│   │   └── storage.js       # File storage configuration (local/cloud)
│   │
│   ├── routes/              # API route definitions (one file per resource)
│   │   └── (index files)    # GET /api/projects, POST /api/chat, etc.
│   │
│   ├── controllers/         # Route handlers — receives request, calls service, sends response
│   │   └── (index files)    # projectController.js, chatController.js, etc.
│   │
│   ├── services/            # Business logic — where the real work happens
│   │   ├── video/           # Video processing services (render, encode, effects)
│   │   ├── audio/           # Audio processing (TTS, music, mixing)
│   │   ├── script/          # Script/story generation logic
│   │   ├── gemini/          # Gemini AI integration logic
│   │   └── storage/         # File upload/download/management
│   │
│   ├── agents/              # AI agent definitions — each agent is a specialized AI worker
│   │   ├── director/        # Director agent — orchestrates the overall production pipeline
│   │   ├── screenplay/      # Screenplay agent — writes scripts & dialogues
│   │   ├── storyoard/       # Storyboard agent — generates scene descriptions & visuals
│   │   ├── video/           # Video agent — handles video generation/editing tasks
│   │   ├── audio/           # Audio agent — handles voiceover, SFX, music
│   │   ├── schedular/       # Scheduler agent — manages task ordering & dependencies
│   │   └── analytics/       # Analytics agent — tracks progress & generates reports
│   │
│   ├── models/              # Mongoose data models (database schemas)
│   │   └── (index files)    # User.js, Project.js, Agent.js, etc.
│   │
│   ├── middleware/           # Express middleware (runs before route handlers)
│   │   └── (index files)    # Auth middleware, error handling, logging, rate limiting
│   │
│   ├── prompts/             # AI prompt templates (system prompts for Gemini agents)
│   │   └── (index files)
│   │
│   ├── utils/               # Server utility functions (helpers, validators)
│   │   └── (index files)
│   │
│   └── uploads/             # Temporary file uploads (user-uploaded media)
│
├── .env                     # Environment secrets (API keys, DB URI) — never commit this!
├── package.json             # Server dependencies (Express, Mongoose, dotenv, etc.)
└── package-lock.json
```

### 📌 Server request flow:
```
Request → Route → Controller → Service → Agent/Model → Response
```

### 📌 Agent system:
Each folder under `agents/` is a **specialized AI agent** with its own prompts and logic. They work together like a film crew — the Director coordinates, the Screenplay agent writes, the Storyboard agent visualizes, and so on.

---

## 🤝 `shared/` — Shared Code (Client + Server)

Code that both the frontend and backend need to use. Avoids duplication and keeps types in sync.

```
shared/
├── types/                   # TypeScript or JSDoc type definitions
│   └── (index files)        # Shared data shapes: Project, Agent, Message, etc.
│
├── constants/               # Shared constants (status codes, roles, limits)
│   └── (index files)
│
├── schemas/                 # Validation schemas (Zod, Joi, etc.)
│   └── (index files)        # Used on both client (form validation) & server (request validation)
│
└── prompts/                 # Shared prompt templates used by both client & server
    └── (index files)
```

---

## 📂 `docs/` — Documentation

```
docs/
├── folder.md                # This file — explains the folder structure
└── (other docs)             # API docs, architecture notes, setup guides
```

---

## 🧠 Why This Structure?

| Decision | Reason |
|---|---|
| **Monorepo** | One repo = easier collaboration, atomic commits across client & server |
| **`shared/` folder** | Avoids copy-pasting types and constants between client and server |
| **Agents per folder** | Each AI agent is isolated — easy to develop, test, and debug independently |
| **Controllers + Services split** | Controllers handle HTTP; services handle logic. Keeps code testable and clean |
| **Components by feature** | Chat components together, dashboard together — not by type (buttons, inputs, etc.) |
| **Pages as routes** | Each folder in `pages/` = one URL. Easy to find where a page lives |
| **Empty folders are intentional** | They're scaffolding — fill them in as you build each feature |

---

## 🚀 Quick Start

```bash
# Install server dependencies
cd server && npm install

# Run the server
node src/server.js

# Install client dependencies (separate terminal)
cd client && npm install

# Run the client dev server
npm run dev
```

---

> **Questions?** Check `docs/` for more documentation or ask in the group chat.
