# Addendum: New Course Wizard — Technical-How & Options Considered

*Companion to `prd.md`. Captures depth that informed the PRD's decisions but doesn't belong in the PRD body — options considered, current-as-of-research-date specifics, and mechanism-level detail for whoever picks this up next (architecture, engineering). Treat anything dated below as a snapshot, not a commitment — verify at build time per PRD §8 Open Question 3.*

## AI Gateway: Options Considered (research snapshot, August 2026)

Two dominant provider-agnostic gateway patterns, both OpenAI-compatible, so switching a *plain chat-completion call* between them is a base-URL/key change, not a rewrite:

- **Self-hosted proxy (LiteLLM-class)** — open-source, normalizes 100+ providers behind one endpoint; config-file-driven virtual keys, budgets, per-request model routing, fallback chains, and usage/cost logging you own. Best when student/private data can't leave your network or spend is high enough that a platform fee matters.
- **Managed unified API (OpenRouter/Portkey-class)** — 300+ models via one key, zero markup on provider pricing but a platform fee (OpenRouter: ~5.5%, 5% with bring-your-own-key, waived on first 1M requests/month as of this research). Fast to stand up, good for prototyping and day-one access to new models.

The PRD's *original* decision (managed now, self-host at/before launch) matched the phased pattern recommended across multiple August 2026 comparisons: prototype on a managed gateway, move to self-hosted once data-residency, cost, or governance requirements harden.

**Superseded by cost review (2026-08-11):** the phasing above is dropped. **Portkey's open-source gateway** (Apache-licensed, `portkey-ai/gateway`, a lightweight ~45kb proxy) is self-hosted from day one instead — genuinely zero-markup (you pay providers directly; Portkey's *fees* are only for its optional hosted observability/control-plane tier, which this project doesn't use), so there is no platform fee to defer and no later migration to do. This also retires the original "Correction on migration cost" finding below it in an earlier version of this document — there's only one gateway now, so there's no re-authoring of fallback/budget config from one schema to another's at a later date. The general LiteLLM-vs-OpenRouter comparison above stays useful background (LiteLLM remains a reasonable alternative self-hosted proxy), but Portkey OSS is the current pick specifically because it was confirmed to carry zero inference markup even self-hosted, and its footprint is small enough to stand up on day one rather than deferring.

**Deployment note for the architecture pass:** Portkey's OSS gateway is a standalone lightweight service (not an in-process .NET library), so it needs its own Docker Compose entry alongside `postgres`/`api`/`web` — see backend `ARCHITECTURE-SPINE.md` AD-13/AD-14 for the resulting deployment envelope.

## Free/no-credit-card tiers for prototyping — privacy caveat

- **Groq** — genuinely free, no-credit-card tier, ~30 RPM / 1,000 RPD / 12K TPM on Llama 3.3-70B-class models; explicitly does not train on your data by default. Best privacy fit for student data among free tiers — this is why the PRD's Cross-Cutting NFRs (§4.14) name it as the dev-phase default for real-ish student content.
- **Google Gemini (AI Studio)** — most generous free context (up to 1M tokens, ~15 RPM on Flash-tier models) but free-tier prompts are used to improve Google's products (except EU/UK/EEA users); paid tier via Vertex AI turns this off. Usable for synthetic/non-student dev content only, per the PRD's privacy carve-out.
- **Anthropic and OpenAI** — no permanent free tier without a card; one-time trial credit (~$5) requires card entry.
- **Cerebras, Mistral La Plateforme, Cloudflare Workers AI, NVIDIA NIM** — also offer no-card free tiers with rate limits, lower-profile fallback options.
- No provider offers "unlimited" free — all gate by RPM/RPD/TPD, and free tiers are effectively "your data funds the free compute."

## Document extraction & subject-aware content

- **IBM Docling — chosen (cost review, 2026-08-11).** Free, MIT-licensed, self-hosted, no per-page cost regardless of volume. Originally scoped as "strong for digital-born PDFs" only; confirmed on closer research to have real OCR capability too, via pluggable backends (EasyOCR, Tesseract/tesserocr, RapidOCR, Nemotron OCR — all Apache 2.0), which is what makes it viable for FR-12's scanned-page case, not just clean-PDF extraction. Accepted trade-off: less turnkey/accurate than LlamaParse or DeepSeek-OCR on heavily degraded scans out of the box — mitigated by FR-12's own confidence-threshold gate, which already routes low-confidence output to failed/retry rather than accepting it silently.
- **LlamaParse** — the strongest general-purpose parser for messy PDFs → clean structured Markdown in raw capability terms, with an "agentic mode" for multi-step vision reasoning on tables/charts/multi-column layouts. Not chosen: paid SaaS (LlamaIndex), free tier is 10,000 credits/month which shrinks to ~3,300 pages/month at higher-accuracy tiers — a real recurring cost at volume that Docling avoids entirely.
- **DeepSeek-OCR** — approaches scanned/image PDFs as a multimodal reasoning problem; noted as a stronger option than Docling on the hardest scans, but not adopted — Docling's free self-hosted OCR backends were judged sufficient given FR-12's confidence-threshold safety net.
- For math/physics/chemistry notation and Hindi/multilingual text: Gemini 3.1 Pro leads math benchmarks (MATH ~95%) and is called out for multimodal + multilingual strength; GPT-5.5 also wins math-heavy reasoning; Claude Opus leads on rigorous, long-context step-by-step reasoning.
- Scanned/low-quality PDFs need a distinct OCR pass before structure extraction — general "chat" LLMs are not reliable OCR engines on their own. This is why PRD FR-12 is a dedicated parsing/OCR step, not folded into `extractStructure()`.

## Upload malware scanning: options considered (cost review, 2026-08-11)

- **ClamAV — chosen.** Free, open-source (GPLv2), actively maintained by Cisco-Talos, official Docker images available — a small self-hosted service alongside the AI gateway. Known gap: detection rates against fresh/obfuscated malware are documented as materially lower than commercial engines (studies cite ~20-35% on novel samples, higher on known signatures) — acceptable here since FR-11's upload surface is small-scale, tutor-only, and not the kind of adversarial target profile that most exposes ClamAV's weak spot; supplementing with a third-party signature feed (e.g. SaneSecurity) is a cheap future hardening step if needed, not required for launch.
- No paid alternative researched (VirusTotal API paid tiers, cloud-provider-native scanning) was found to close ClamAV's detection gap through a fundamentally different mechanism at this scale — they aggregate more signature feeds, which is the same hardening step available for free via SaneSecurity-class feeds.

## Cost shape: cheap/fast vs. best-reasoning (informs FR-2/FR-3 per-task routing)

- **High-volume "click keyword → definition" (FR-20)**: cheapest-tier models — GPT-5 Nano and Gemini 2.5 Flash-Lite both ~$0.10/M input tokens (Flash-Lite ~$0.40/M output); niche ultra-cheap options (Qwen3.7 Flash ~$0.03/$0.13/M, DeepSeek V4 ~$0.14/$0.28/M) for tighter margins. Batch APIs add a further ~50% discount where near-real-time isn't required.
- **5-level drill-down / best-reasoning tier (FR-17)**: Claude Opus 4.6/4.8, GPT-5.5, and Gemini 3.1 Pro are the current frontier tier — Opus leads the Artificial Analysis Intelligence Index (61.4 vs GPT-5.5's 60.2) and long-context reasoning; GPT-5.5 wins math-heavy tasks; Gemini 3.1 Pro delivers roughly 70% of the depth at roughly a third of the price — a plausible "best-fit paid model" if cost-sensitivity outweighs peak quality.
- Claude Haiku 4.5 (~$1/$5 per M) sits mid-tier, notably pricier than GPT-5 Nano/Gemini Flash-Lite — reinforces per-task routing (cheap model for definitions, frontier model for drill-down) as the right default rather than one model for everything.

## Repo prior art (informs §0 Document Purpose and reuse decisions)

- `FrontEnd/src/features/Dashboard/TutorEducatorHubView.tsx` (lines 73–107, 283–342, 636–791) — the existing 4-step Course Creation Wizard prototype (Dashboard PRD's FR-18), client-only, flat `Course.modules: Module[]` → `Lesson[]` (`types.ts:111-115`), superseded by this PRD.
- `CourseUploadAsset` type (`types.ts:268-280`) — an unused/unwired shape stub with `analysisStatus` and `extractedChapters: {chapterTitle, keyTopics, generatedQuestionsCount}[]`, already anticipating AI-extraction results.
- `FrontEnd/src/features/CoursePlayer/DrilldownPanel.tsx` — working "5-Level Deep Drilldown" UI (static mock data) — reused by FR-17.
- `FrontEnd/src/features/CoursePlayer/ReaderCanvas.tsx` — has a simulated/fake "LLM Assistant" (`handleAskLevelLLM`, hardcoded response, no network call) — resolved as PRD FR-20 (Click-Any-Keyword): this is the real implementation of that existing affordance, not a separate feature.
- `FrontEnd/src/features/Admin/MasterDataManager.tsx` + `services/masterDataService.ts` — real backend-integrated CRUD for Country→State→City→Board→ClassLevel→Subject, gated by a `masterdata.manage` policy — reused by FR-8.
- KaTeX is already a `package.json` dependency, used in `ReaderCanvas.tsx`, `DrilldownPanel.tsx`, `FlashcardsModal.tsx`, `CoursePlayer.tsx` — reused by FR-16; the `mhchem` extension is not yet installed.
- Backend (`BackEnd/src/`) has no course-authoring, upload, content-extraction, or AI-gateway code — Clean Architecture scaffolding only. The backend architecture spine explicitly deferred the AI pipeline: "AI microservice pipeline (concept drilldown, auto-grading) — out of scope... likely its own Infrastructure-layer client calling an external AI API."

## Sources (as retrieved, August 2026)

Covers the Gateway, Free-Tier, Extraction, and Cost-Shape sections above. Cost-review addition (2026-08-11) covers the gateway/OCR/scanning revisions specifically:

- OpenRouter Pricing Guide 2026 — aireiter.com/blog/openrouter-pricing-guide-2026
- OpenRouter Hidden Fee Breakdown — ofox.ai/blog/openrouter-pricing-hidden-markup-breakdown-2026
- OpenRouter BYOK Announcement + Docs — openrouter.ai/blog/announcements/1-million-free-byok-requests-per-month, openrouter.ai/docs/guides/overview/auth/byok
- Portkey Pricing Guide — truefoundry.com/blog/portkey-pricing-guide
- Portkey-AI/gateway (GitHub, OSS) — github.com/portkey-ai/gateway
- Groq OpenAI Compatibility Docs — console.groq.com/docs/openai
- Groq Free Tier 2026 — tokenmix.ai/blog/groq-api-access-2026-free-tier-rate-limits
- LlamaParse Pricing/Tiers — developers.llamaindex.ai/llamaparse/parse/guides/tiers
- Docling Documentation — docling.org/doc
- Docling OCR overview — heidloff.net/article/document-parser-ocr-docling
- ClamAV Docker Docs — docs.clamav.net/manual/Installing/Docker.html
- How Good is ClamAV at Detecting Commodity Malware — splunk.com/en_us/blog/security/how-good-is-clamav-at-detecting-commodity-malware.html
- SaneSecurity — sanesecurity.com
- Font Squirrel: Fraunces / Outfit licenses — fontsquirrel.com/license/fraunces, fontsquirrel.com/fonts/outfit
- LiteLLM vs OpenRouter (2026) — truefoundry.com/blog/litellm-vs-openrouter
- LLM Gateways Compared 2026 — wavect.io/blog/llm-gateway-router-comparison-2026
- OpenRouter vs LiteLLM — openrouter.ai/blog/insights/openrouter-vs-litellm
- Free LLM API in 2026: 13 Options Ranked — openrouter.ai/blog/tutorials/free-llm-apis-compared
- Groq pricing in 2026 — eesel.ai/blog/groq-pricing
- Google AI Studio Pricing 2026 — nocode.mba/articles/google-ai-studio-pricing
- AI Inference Providers 2026: Free Tier Deep-Dive — belski.me/blog/ai_inference_providers_2026_free_tier_deep_dive
- Best AI for PDF Table Extraction (2026) — llamaindex.ai/insights/best-ai-for-pdf-table-extraction
- Best OCR Software of 2026 — llamaindex.ai/insights/best-ocr-software
- Best PDF Parsers for AI and RAG Workflows in 2026 — firecrawl.dev/blog/best-pdf-parsers
- Gemini 3 Pro vs Claude Opus 4.5 vs GPT-5 comparison — getmaxim.ai/articles/gemini-3-pro-vs-claude-opus-4-5-vs-gpt-5-the-ultimate-frontier-model-comparison
- Best AI Model for Math 2026 — help.apiyi.com/en/best-ai-model-for-math-2026-en.html
- Claude Opus 4.6 vs GPT-5.5 vs Gemini 3.1 Pro Reasoning 2026 — ofox.ai/blog/claude-opus-4-6-vs-gpt-5-5-vs-gemini-3-1-pro-reasoning-2026
- LLM API Pricing Comparison In 2026 — cloudzero.com/blog/llm-api-pricing-comparison
- Cross-Provider LLM API Pricing Comparison (April 2026) — pecollective.com/blog/llm-pricing-comparison-2026
