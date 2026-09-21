# Wilhelm

A multi-turn enterprise knowledge-base agent with domain routing, grounded RAG answers, and on-demand output formatting. Built for the hackathon demo; runs fully locally or against any cloud LLM/embedding provider.

---

## 🎥 Demo Video

[![Wilhelm Demo](https://img.youtube.com/vi/u8KGFWQlJhs/maxresdefault.jpg)](https://youtu.be/u8KGFWQlJhs)

**YouTube:** https://youtu.be/u8KGFWQlJhs

---

> **⚠️ Synthetic demo data notice**
>
> The HR policy and IT support documents in `data/hr-policies/` and `data/it-support/` are **entirely synthetic**. They were generated for this hackathon and do **not** represent real KOHLER policy, procedures, or guidance of any kind. Do not treat them as authoritative. Both document sets are committed to the repository so the project is fully reproducible by anyone who clones it — no separate data download required.

---

## What it does

Wilhelm answers employee questions by retrieving relevant passages from an internal knowledge base and generating a grounded, cited response. It never answers from model training data alone — every response traces back to a specific retrieved document.

Key capabilities:

- **Domain routing** — a lightweight LLM-based router classifies each query as `hr`, `support`, or `out_of_scope` before touching the vector store. Out-of-scope queries are rejected immediately with zero retrieval cost.
- **Grounded RAG answers** — retrieved chunks are injected into the LLM prompt and the model is instructed to signal when the context doesn't cover the question. The `grounded` boolean in every response makes this machine-readable.
- **Multi-turn sessions** — conversation history is kept server-side and injected into subsequent prompts. Follow-up queries (e.g. "and what about annual leave?") resolve correctly without the user repeating context.
- **On-demand output formatting** — the same answer can be returned as plain text, a structured JSON object, an XML document, a downloadable Excel file, or a ready-to-send email draft. The format is selected per-request.
- **Source panel** — the chat UI shows an expandable panel under each answer listing exactly which document sections were retrieved, with a green/amber grounding indicator.

---

## Architecture

```text
User query
    │
    ▼
┌─────────────┐
│   Router    │  LLM call — classifies domain + confidence
│  (router.js)│  → hr | support | out_of_scope
└──────┬──────┘
       │ (out_of_scope → fast reject, no further calls)
       ▼
┌─────────────┐
│  Retriever  │  embedText(query) → queryVectorStore(embedding, topK, {domain})
│(retriever.js│  returns ranked chunks with source metadata
└──────┬──────┘
       │ (empty result → "no context" fast path)
       ▼
┌─────────────┐
│   Answer    │  generateText(prompt + chunks + history)
│  (answer.js)│  → { answer, sources, grounded }
└──────┬──────┘
       ▼
┌──────────────────┐
│ Format dispatcher│  dispatch(format, result)
│ (dispatcher.js)  │  → json | xml | xlsx | email | plain
└──────────────────┘
       │
       ▼
  HTTP response  (Content-Type set per format)