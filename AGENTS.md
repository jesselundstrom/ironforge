## Project Guidance

- For project vision, working style, and architecture decisions, read `CLAUDE.md`.
- For technical conventions, coding rules, and layer structure, read `.github/copilot-instructions.md`.
- Treat both files as project constraints unless the user explicitly overrides them.
- Do not rewrite or duplicate those files by default. Use them as shared sources of truth.

## Project Context

Ironforge is a personal coaching PWA whose broader product vision includes Training, Nutrition, and Recovery. The shipped runtime in this repo is currently the Training Core only: auth, onboarding, dashboard, workout logging, history, and settings. The production app runs through the React + Vite + Zustand shell in `src/`, while some compatibility and migration-era business logic still exists in `core/*.js` and `programs/*.js` for untouched seams. Nutrition coaching remains a deferred rebuild path and should not be treated as live shipped runtime behavior unless the user explicitly reintroduces it.
The shipped styling pipeline now runs through Tailwind v4 in `src/styles/tailwind.css`, while `src/styles/compat-ui.css` remains as a shrinking compatibility layer for untouched compatibility surfaces.

## Skills

A skill is a set of local instructions stored in a `SKILL.md` file. Use the skills below when the task matches their description or the user names them directly.

### Available Skills

- **builder-agent**: Clean, minimal implementation agent for building requested features without overstating readiness. Use when the user wants code changes, feature delivery, bug fixes, or implementation work, especially when paired with a separate audit step before release. (file: .agents/skills/builder-agent/SKILL.md)
- **frontend-design**: Create distinctive, production-grade frontend interfaces with high design quality. Use when building, restyling, or polishing pages, components, dashboards, or other web UI. (file: .agents/skills/frontend-design/SKILL.md)
- **ironforge-business-advisor**: Product and business decision partner for Ironforge. Use for roadmap priorities, monetization, onboarding, retention, positioning, premium UX tradeoffs, AI coaching feature direction, PWA-vs-native strategy, or broader app decisions that need business, coaching, safety, mobile, and implementation lenses together. (file: .agents/skills/ironforge-business-advisor/SKILL.md)
- **self-auditor**: Skeptical production-readiness audit focused on security, authorization, abuse prevention, data integrity, reliability, scalability, operational readiness, and type safety. Use when reviewing AI-generated code, release candidates, backend/API work, auth-sensitive changes, expensive model routes, or when the user asks for an audit or risk review. (file: .agents/skills/self-auditor/SKILL.md)
- **web-design-guidelines**: Review UI code for Web Interface Guidelines compliance. Use for accessibility audits, design reviews, or UX checks. (file: .agents/skills/web-design-guidelines/SKILL.md)
- **vercel-react-best-practices**: React and Next.js best practices. Relevant for future web framework migration planning. (file: .agents/skills/vercel-react-best-practices/SKILL.md)
- **vercel-react-native-skills**: React Native and Expo best practices. Relevant for the future native mobile app port. (file: .agents/skills/vercel-react-native-skills/SKILL.md)

### How to Use Skills

- Discovery: Read the skill file listed above only when the task matches it.
- Trigger rules: If the user names a skill or the task clearly matches the description, use that skill for the turn.
- Missing or blocked: If a skill file cannot be read, say so briefly and continue with the best fallback.
- Keep context small: Read only the files needed for the active task.
- Reuse bundled skill assets or references when present instead of recreating them from scratch.
