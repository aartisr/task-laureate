# Contributing to Task-Laureate

Thank you for your interest in improving **Task-Laureate**! We welcome bug fixes, documentation improvements, domain enhancements, and performance optimizations.

---

## 🛠️ Development Setup

1. **Prerequisites**:
   - Node.js `20.19.0+` (or Node.js 22 LTS)
   - npm `10+`
   - Git

2. **Clone & Install**:
   ```bash
   git clone https://github.com/aartisr/task-laureate.git
   cd task-laureate
   npm ci
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Run Quality Gates**:
   ```bash
   npm run quality:gate
   ```
   This validates database migrations, runs the full test suite (625+ tests), executes TypeScript typechecking, builds the production bundle, and validates performance budgets.

---

## 📐 Architecture & Principles

Before submitting code, please familiarize yourself with our core tenets:

- **Local-First Reliability**: The UI must remain responsive and functional offline. All state mutations should be optimistic, queued in the durable outbox, and flushed cleanly when reconnected.
- **Cognitive Calm ("Anti-Backlog")**: Avoid guilt-driven streaks, red countdown banners, or overwhelming priority grids. Features should help users pick a single, feasible next action based on available time and energy.
- **Strict Separation of Concerns**:
  - `src/core/domain/`: Pure business logic, free of framework or DOM dependencies. 100% unit-tested.
  - `src/core/contracts/`: Shared schemas, domain types, and interfaces.
  - `src/core/services/`: Orchestration and application workflow logic.
  - `src/infrastructure/`: Concrete adapters for Supabase, LocalStorage, PostHog, and Push Notifications.
  - `src/components/` & `src/pages/`: Accessible, responsive React UI components.

---

## 📝 Commit Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>
```

### Allowed Types:
- `feat`: A new user-facing capability or enhancement.
- `fix`: A bug fix.
- `refactor`: Code change that neither fixes a bug nor adds a feature.
- `perf`: Performance improvement (e.g. bundle size reduction, memoization).
- `test`: Adding or correcting tests.
- `docs`: Documentation updates.
- `chore`: Build scripts, dependencies, or toolchain changes.

---

## 🧪 Testing Standards

- **Unit & Property Tests**: Add unit tests for every new domain parser, calculation, or policy function.
- **Component & A11y Tests**: Components must be tested for ARIA roles, keyboard traps, focus handling, and color contrast compliance.
- **Deterministic Time**: Never rely on `new Date()` without supporting custom reference timestamps or mock clocks in domain calculations.
- **Zero Flakiness**: All tests must run deterministically in any timezone (`TZ=America/New_York`, `TZ=UTC`).

---

## 🚀 Submitting a Pull Request

1. Fork the repository and create your branch from `master`:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Make your changes with concise, well-tested commits.
3. Ensure all quality checks pass locally:
   ```bash
   npm run quality:gate
   ```
4. Open a Pull Request on GitHub with a clear description of the problem solved and the approach taken.
