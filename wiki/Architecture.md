# Architecture

Task-Laureate separates product UI, domain rules, persistence, and provider
integrations so the application remains understandable as it grows.

```text
React UI → domain contracts and mutations → repository adapters → Supabase
Vercel functions → provider adapters → email, SMS, push, calendar services
```

- **React + TypeScript + Vite** provide the responsive app shell.
- **Supabase Auth, Postgres, and RLS** protect collaboration data.
- **Vercel functions** hold provider credentials and privileged orchestration.
- **PWA worker** owns offline app-shell resilience and Web Push in one scope.

The complete, versioned explanation is the [Architecture guide](https://github.com/aartisr/task-laureate/blob/master/docs/ARCHITECTURE_GUIDE.md).

← [Wiki home](Home) · [Operations](Operations) · [Contributing](Contributing)
