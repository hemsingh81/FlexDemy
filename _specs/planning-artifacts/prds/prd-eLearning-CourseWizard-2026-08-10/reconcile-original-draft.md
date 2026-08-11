# Input Reconciliation: Original User Draft vs. Final PRD

*Input: the user's pasted "New Course Wizard (v2)" draft PRD, dated 10 August 2026 (the session's initial brain dump). Reconciled against `prd.md` + `addendum.md` at Finalize step 2.*

## Gaps found

1. **"Local models" dev-phase option silently dropped.** Original §4.2/§4.3 explicitly names local models (alongside free API tiers) for unlimited, fully-private dev-phase testing and for embeddings ("Local/free embeddings" dev row) — distinct from free-tier APIs, which the original itself calls "rate-limited prototype lanes, not production SLAs." The final PRD/addendum only discuss cloud options (Groq free tier, OpenRouter/Portkey managed, LiteLLM self-hosted *proxy* — still a cloud/network call unless self-hosting the model weights too). The zero-cost, zero-rate-limit, fully-private local-inference lever is gone.

2. **Chemistry "structures" narrowed to formulas/reactions only.** Original §5.4 lists three distinct chemistry needs: "chemical formulas, reactions, **structures**" (molecular/structural diagrams). Final FR-16 commits only to KaTeX + mhchem, a text-notation extension that cannot render structural/skeletal diagrams — that need is quietly absorbed into the generic biology-diagrams language and effectively dropped.

3. **Cost guardrail weakened from a requirement to an unenforced metric.** Original §2 Goals: cost "**must stay within budget** after the backbone swap" — a constraint to guarantee. Final PRD reduces this to SM-5, a trackable metric with no FR for budget caps, thresholds, or alerting. The word "budget" doesn't appear in `prd.md`.

4. **Gateway choice reframed from explicitly-not-a-product-constraint to a committed two-phase decision.** Original §4.1: the self-hosted-vs-managed choice "is an implementation detail, **not a product constraint**." Final FR-2 commits to a specific sequence (managed now, self-hosted at/before launch) as settled product posture. Defensible as research-informed elaboration (this session's privacy research plus your own confirmation), but it inverts the original's explicit instruction — worth a conscious yes/no rather than quietly overriding it.

Total: 4 gaps, none yet resolved in `prd.md`.
