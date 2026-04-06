# AI Builder Playbook

## Goal

Adapt Vibe Coach to a user’s repo quickly and cleanly.

Read [`AGENTS.md`](../AGENTS.md) first.

## Workflow

### 1. Gather repo context

Read:

- project README
- package manifests
- architecture docs
- core source directories
- issue tracker or roadmap docs if available
- the structured blueprint in [`vibe-coach.project.ts`](../vibe-coach.project.ts)

Output:

- a concise map of what the project does
- the major subsystems
- the major unknowns a new learner would face

### 2. Write research first

Create or update markdown files in the configured research folder.

The research should cover:

- product and architecture overview
- important tooling and dependencies
- workflow and operational concepts
- phased implementation or onboarding guidance

### 3. Update project context

Edit [`vibe-coach.project.ts`](../vibe-coach.project.ts).

This tells the engine:

- what project it is teaching
- where research lives
- what the initial learning track is called

### 4. Draft the curriculum

Edit [`server/content.ts`](../server/content.ts).

The lesson plan should:

- start with orientation
- move into subsystem understanding
- end with advanced and operational concepts
- include quizzes that test comprehension, not memorized phrasing

### 5. Sync and verify

Run:

- `npm run verify`

Then open the app and verify:

- lessons load
- research documents render
- comments save
- quiz scoring works

## Quality Rules

- keep research inspectable
- keep curriculum explicit
- do not hide personalization logic in prompts only
- prefer a small number of strong lessons over a bloated outline
- write for the actual learner context, not generic documentation

## Future Automation Direction

Eventually this playbook should become partially automated.

But even then, these steps should stay visible, because visibility is what makes the output trustworthy and maintainable.
