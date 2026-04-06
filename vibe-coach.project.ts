type ResearchDeliverable = {
  fileName: string
  purpose: string
}

type AdaptationBlueprint = {
  inspectPaths: string[]
  ignorePaths: string[]
  repoQuestions: string[]
  researchDeliverables: ResearchDeliverable[]
  curriculumGuidance: string[]
  personalizationLoop: string[]
  verificationSteps: string[]
}

export const VIBE_COACH_BRAND = {
  name: 'Vibe Coach',
  tagline: 'The educational platform that teaches you while you build.',
  promise:
    'Drop it into a repo, let AI research the project, turn that into lessons, and personalize onboarding over time.',
}

export const PROJECT_CONTEXT = {
  slug: 'local-ai-coding-harness',
  title: 'Local AI Coding Harness',
  description:
    'A local-first coding harness research project and evolving lesson plan for building a model-agnostic code agent host.',
  researchDirectory: ['research', '2026-04-06-local-ai-coding-harness'],
  track: {
    slug: 'harness-foundations',
    title: 'Harness Foundations',
    description:
      'A progressive path from the core mental model to the advanced architectural decisions behind a local AI coding harness.',
  },
  audience:
    'Builders onboarding into unfamiliar codebases, new domains, or early product ideas where they do not yet know what they do not know.',
}

export const ADAPTATION_BLUEPRINT: AdaptationBlueprint = {
  inspectPaths: [
    'README*',
    'package.json',
    'tsconfig*.json',
    'docs/',
    'src/',
    'server/',
    '.github/',
    'supabase/',
    'vercel.json',
  ],
  ignorePaths: [
    'node_modules/',
    'dist/',
    'data/*.sqlite',
    'data/*.sqlite-shm',
    'data/*.sqlite-wal',
  ],
  repoQuestions: [
    'What does this repo do for a real user or operator?',
    'Which directories matter most for understanding the project quickly?',
    'What concepts would block a capable builder who is new to this repo?',
    'What workflows, commands, or deployment steps are easy to miss but important?',
    'Which parts of the system deserve foundational lessons before advanced implementation details?',
  ],
  researchDeliverables: [
    {
      fileName: 'README.md',
      purpose: 'Write a blunt orientation document with the project goal, current maturity, and recommended learning path.',
    },
    {
      fileName: '01-product-and-system-overview.md',
      purpose: 'Explain the user problem, system shape, and the main subsystems in plain language.',
    },
    {
      fileName: '02-tooling-and-runtime.md',
      purpose: 'Explain the runtime, dependencies, infrastructure, and developer workflow choices.',
    },
    {
      fileName: '03-key-workflows.md',
      purpose: 'Document the operational or development flows a new learner must understand to contribute safely.',
    },
    {
      fileName: '04-roadmap-and-risks.md',
      purpose: 'Capture the likely build phases, tradeoffs, risks, and open questions.',
    },
    {
      fileName: 'sources.md',
      purpose: 'Track the repo files, docs, links, and references that grounded the research.',
    },
  ],
  curriculumGuidance: [
    'Start with orientation and the mental model before subsystem detail.',
    'Prefer 6-10 strong lessons over a bloated outline.',
    'Use quizzes to test reasoning, not memorized phrasing.',
    'Teach progressively: foundations, systems, operations, then advanced decisions.',
    'Point each lesson back to the research documents that support it.',
  ],
  personalizationLoop: [
    'Treat comments as evidence about confusion, depth requests, and example requests.',
    'Use quiz misses to identify concept gaps before rewriting lessons.',
    'Revise future lessons around actual learner friction, not generic completeness.',
  ],
  verificationSteps: ['npm install', 'npm run verify', 'npm run dev'],
}
