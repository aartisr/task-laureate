# Getting Started

## Use Task-Laureate

Open [Task-Laureate](https://tasks.ai-aarti.com) to create a private workspace,
or explore the [sample workspace](https://tasks.ai-aarti.com/sample) first.
For phone installation, use [Install Task-Laureate](Install-Task-Laureate).

## Run it locally

Requirements: Node.js 20.19+ and npm.

```sh
git clone https://github.com/aartisr/task-laureate.git
cd task-laureate
npm ci --include=dev --include=optional
npm run dev
```

For architecture and environment details, read the versioned [Architecture guide](https://github.com/aartisr/task-laureate/blob/master/docs/ARCHITECTURE_GUIDE.md)
and [Production Operations](https://github.com/aartisr/task-laureate/blob/master/docs/OPERATIONS.md).

## Verify a change

```sh
npm run quality:gate
```

← [Wiki home](Home) · [Architecture](Architecture) · [Operations](Operations)
