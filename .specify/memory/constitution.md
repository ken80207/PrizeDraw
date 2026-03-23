<!--
Sync Impact Report
- Version change: 1.0.0 → 1.0.1 (added no-boilerplate rule)
- Added principles:
  - I. Code Quality First
  - II. Testing Standards
  - III. User Experience Consistency
  - IV. Performance Requirements
- Added sections:
  - Development Workflow
  - Quality Gates
- Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (Constitution Check aligned)
  - .specify/templates/spec-template.md ✅ (success criteria aligned)
  - .specify/templates/tasks-template.md ✅ (test/performance tasks aligned)
- Follow-up TODOs: none
-->

# PrizeDraw Constitution

## Core Principles

### I. Code Quality First

All code MUST follow consistent, maintainable, and readable standards:

- Every module MUST have a single, well-defined responsibility
- Functions MUST be concise — no function exceeds 50 lines of logic; extract helper functions when complexity grows
- All public APIs MUST include type annotations (TypeScript strict mode, Python type hints, or equivalent)
- Dead code, unused imports, and commented-out blocks MUST be removed before merge
- Naming MUST be descriptive and self-documenting — avoid abbreviations unless they are universally understood domain terms
- Boilerplate code MUST be eliminated — use abstractions, shared utilities, generics, or code generation to avoid repetitive patterns; if similar code appears in three or more places, it MUST be extracted
- Linting and formatting MUST be enforced via automated tooling (ESLint, Prettier, Ruff, or equivalent) with zero warnings policy

**Rationale**: Consistent code quality reduces onboarding time, minimizes bugs, and ensures every contributor can confidently read and modify any part of the codebase.

### II. Testing Standards

All features MUST be accompanied by meaningful, automated tests:

- Unit tests MUST cover all business logic with a minimum of 80% branch coverage
- Integration tests MUST verify critical user flows end-to-end
- Test-Driven Development (TDD) is RECOMMENDED: write failing tests first, then implement to make them pass
- Tests MUST be deterministic — no flaky tests allowed; any flaky test MUST be fixed or quarantined within 24 hours
- Test names MUST clearly describe the scenario being verified (e.g., `test_user_cannot_draw_prize_twice`)
- Mocks SHOULD be limited to external service boundaries; prefer real implementations for internal logic

**Rationale**: Comprehensive testing catches regressions early, enables confident refactoring, and serves as living documentation of expected behavior.

### III. User Experience Consistency

All user-facing interfaces MUST deliver a coherent, predictable experience:

- UI components MUST follow a shared design system — consistent spacing, typography, color palette, and interaction patterns
- All user actions MUST provide immediate visual feedback (loading states, success/error indicators, transitions)
- Error messages MUST be user-friendly, actionable, and written in the user's language — never expose raw stack traces or technical codes
- Accessibility MUST be a baseline requirement: semantic HTML, ARIA labels, keyboard navigability, and sufficient color contrast (WCAG 2.1 AA minimum)
- Responsive design MUST support mobile, tablet, and desktop breakpoints without layout breakage
- Animation and transition duration MUST NOT exceed 300ms for UI state changes to preserve perceived responsiveness

**Rationale**: A consistent UX builds user trust, reduces support burden, and ensures the product is usable by the widest possible audience.

### IV. Performance Requirements

All features MUST meet defined performance thresholds before shipping:

- Page/screen initial load MUST complete within 2 seconds on a standard 4G connection
- API response time MUST stay below 200ms at p95 for read operations and below 500ms at p95 for write operations
- Client-side bundle size MUST NOT exceed the established budget — any increase over 10KB requires justification and approval
- Database queries MUST use appropriate indexes; any query exceeding 100ms MUST be optimized or justified
- Memory usage MUST remain stable under sustained load — no memory leaks allowed
- Performance regression tests MUST be included for any latency-critical path

**Rationale**: Performance directly impacts user retention and satisfaction. Defined thresholds prevent gradual degradation and create accountability for every change.

## Quality Gates

All code changes MUST pass the following gates before merge:

1. **Automated Checks**: Linting, formatting, type checking, and all tests pass in CI
2. **Code Review**: At least one approval from a team member who did not author the change
3. **Performance Validation**: No p95 latency regression beyond 10% on affected endpoints
4. **Accessibility Audit**: New UI components MUST pass automated accessibility checks (axe-core or equivalent)
5. **Bundle Size Check**: CI MUST report bundle size delta; increases beyond threshold block merge until approved

## Development Workflow

The development process MUST follow this order:

1. **Specification**: Define requirements and acceptance criteria before writing code
2. **Design**: Identify technical approach, data model, and API contracts
3. **Implementation**: Write code following TDD where applicable — tests first, then production code
4. **Review**: Submit for code review with passing CI checks
5. **Validation**: Verify against acceptance criteria, performance thresholds, and UX consistency standards
6. **Merge**: Squash-merge into the main branch with a descriptive commit message

All developers MUST keep feature branches short-lived (target < 3 days) to minimize merge conflicts and integration risk.

## Governance

This constitution is the authoritative source of development standards for PrizeDraw. All code reviews, pull requests, and architectural decisions MUST verify compliance with these principles.

**Amendment Procedure**:
- Any team member may propose amendments via a pull request to this file
- Amendments MUST include rationale and impact assessment
- Version MUST be incremented following semantic versioning:
  - MAJOR: Principle removal or incompatible redefinition
  - MINOR: New principle or material expansion of existing guidance
  - PATCH: Clarification, wording, or non-semantic refinement
- All active team members MUST be notified of amendments

**Compliance Review**: Principles MUST be reviewed quarterly to ensure they remain relevant and achievable.

**Version**: 1.0.1 | **Ratified**: 2026-03-24 | **Last Amended**: 2026-03-24
