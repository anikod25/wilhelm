import { generateText } from './llm.js'
import { embedText, queryVectorStore } from './vectorstore.js'
import { createSession } from './session.js'
import {
  findPatentByApplicationNumber,
  findPatentById,
  PatentLookupError,
} from './patentLookup.js'

const MAX_HISTORY_TURNS = 10
const DEFAULT_TOP_K = 5
const PLANNER_INTENTS = new Set(['record', 'documents', 'both', 'conversation', 'clarify'])

function asksAboutIpReferenceMaterial(query) {
  const text = String(query ?? '').toLowerCase()
  const hasIpContext = /\b(?:ip|patent|filing|inventor|office action)\b/.test(text)
  const asksAboutMaterial = /\b(?:process|procedure|form|forms|notice|notices|checklist|template|guide|document|documents|steps|respond)\b/.test(text)
  return hasIpContext && asksAboutMaterial
}

function extractJson(text) {
  const cleaned = String(text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  try { return JSON.parse(cleaned) } catch { /* recover a JSON object surrounded by prose */ }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('LLM did not return a routing object')
  return JSON.parse(cleaned.slice(start, end + 1))
}

function safeRecord(record) {
  if (!record) return null
  return {
    id: record.id,
    application_number: record.application_number,
    patent_office: record.patent_office,
    title: record.title,
    status: record.status,
    filing_date: record.filing_date,
    publication_date: record.publication_date,
    publication_number: record.publication_number,
    grant_date: record.grant_date,
    grant_number: record.grant_number,
    assignee_name: record.assignee_name,
    reporting_year: record.reporting_year,
    needs_review: record.needs_review,
    cleaning_notes: record.cleaning_notes,
  }
}

async function planTurn(query, history, activePatent) {
  const prompt = `You are the conversation router for Wilhelm, an IP tracker and patent-document assistant.
Choose which backend data sources are needed. Do not answer the user.

Allowed intent values:
- "record": current tracker fields or status are needed
- "documents": indexed patent documents can answer the question
- "both": the question needs tracker fields and documents
- "conversation": greeting, clarification of how to use Wilhelm, or ordinary chat that needs no project facts
- "clarify": the target patent or question is ambiguous and cannot be resolved from history

Return ONLY valid JSON with exactly these keys:
{"intent":"record|documents|both|conversation|clarify","identifier_type":"application_number|id|none","identifier":"exact identifier or empty string","use_active_patent":true|false,"search_query":"standalone semantic search query or empty string","clarification":"short question to ask if needed"}

Rules:
- For current status, dates, assignee, or fields in the tracker, select record.
- For explanations from filings, office actions, or patent reference documents, select documents.
- For IP or patent filing processes, forms, notices, checklists, templates, or procedures, select documents even when the question is phrased generally.
- Select both when the user asks for a record fact and an explanation supported by its documents.
- Resolve follow-ups such as "what does that mean?" from the recent conversation. If they refer to the active patent below, set use_active_patent=true.
- If the user refers to a particular patent but no identifier is in the current turn or active context, select clarify and ask for its application number or IP ID.
- Copy identifiers exactly as written. Never invent or normalize an identifier.
- A general patent-document question may use documents without a patent identifier.
- Search queries should stand alone and include the active patent title/application number when relevant.

ACTIVE PATENT RECORD:
${JSON.stringify(safeRecord(activePatent))}

RECENT CONVERSATION:
${history || '(none)'}

CURRENT USER MESSAGE:
${query}`

  const raw = await generateText(prompt, { temperature: 0, maxTokens: 300 })
  const parsed = extractJson(raw)
  let intent = PLANNER_INTENTS.has(parsed.intent) ? parsed.intent : 'clarify'
  if (asksAboutIpReferenceMaterial(query)) {
    if (intent === 'conversation') intent = 'documents'
    else if (intent === 'record') intent = 'both'
  }
  const identifierType = ['application_number', 'id'].includes(parsed.identifier_type)
    ? parsed.identifier_type
    : 'none'
  return {
    intent,
    identifierType,
    identifier: typeof parsed.identifier === 'string' ? parsed.identifier.trim() : '',
    useActivePatent: parsed.use_active_patent === true,
    searchQuery: typeof parsed.search_query === 'string' ? parsed.search_query.trim() : '',
    clarification: typeof parsed.clarification === 'string' ? parsed.clarification.trim() : '',
  }
}

async function lookupPlannedRecord(plan, activePatent) {
  if (plan.identifier) {
    return plan.identifierType === 'id'
      ? findPatentById(plan.identifier)
      : findPatentByApplicationNumber(plan.identifier)
  }
  if (plan.useActivePatent && activePatent) {
    if (activePatent.id != null) return findPatentById(activePatent.id)
    if (activePatent.application_number) return findPatentByApplicationNumber(activePatent.application_number)
  }
  return null
}

async function retrievePatentDocuments(query, applicationNumber) {
  const embedding = await embedText(query)
  const filter = { domain: { $eq: 'patents' } }
  if (applicationNumber) filter.application_number = { $eq: applicationNumber }
  const topK = Math.max(1, Math.min(Number(process.env.PATENT_RAG_TOP_K) || DEFAULT_TOP_K, 20))
  return queryVectorStore(embedding, topK, filter)
}

function sourceList(chunks) {
  const seen = new Set()
  return chunks.flatMap((chunk, index) => {
    const metadata = chunk.metadata ?? {}
    const filePath = metadata.filePath ?? metadata.file_path ?? metadata.filename ?? chunk.id
    if (seen.has(filePath)) return []
    seen.add(filePath)
    return [{
      citation: index + 1,
      filename: metadata.filename ?? filePath.split(/[\\/]/).at(-1) ?? 'Patent document',
      filePath,
      heading: metadata.heading ?? '',
      documentType: metadata.document_type ?? '',
      applicationNumber: metadata.application_number ?? '',
      domain: 'patents',
    }]
  })
}

async function composeReply({ query, history, plan, patent, chunks, recordNotFound }) {
  const documentContext = chunks.map((chunk, index) => {
    const metadata = chunk.metadata ?? {}
    const label = [metadata.filename, metadata.heading, metadata.application_number]
      .filter(Boolean).join(' | ')
    return `[${index + 1}] ${label}\n${chunk.text ?? ''}`
  }).join('\n\n') || '(No matching patent document excerpts were retrieved.)'

  const trackerContext = patent
    ? JSON.stringify(safeRecord(patent), null, 2)
    : recordNotFound
      ? `No exact tracker record was found for ${recordNotFound.type}: ${recordNotFound.value}.`
      : '(No tracker record was requested or found.)'

  const prompt = `You are Wilhelm, a helpful conversational IP tracker and patent-document assistant.
Answer the current user naturally and use prior conversation to understand follow-up questions.

SOURCE RULES:
- The tracker record below is authoritative for current status and structured patent fields. Repeat its status exactly; never infer acceptance, rejection, grant, or progress from dates or documents.
- Patent-document excerpts are supporting evidence for explanations. Cite their numbered references inline as [1], [2] when using them.
- Do not claim you reviewed a document unless an excerpt is included below.
- If a requested tracker record was not found, say so clearly. Do not substitute another record.
- If the supplied record or document excerpts do not answer a project-specific question, say what is missing. For general conversational or general educational questions, you may answer from general knowledge and make clear when it is not based on the tracker/documents.
- Do not provide legal advice or present an interpretation as an official legal determination.
- Keep the reply direct, useful, and conversational. Offer a relevant next step when appropriate.

RECENT CONVERSATION:
${history || '(none)'}

TRACKER RECORD:
${trackerContext}

PATENT DOCUMENT EXCERPTS:
${documentContext}

CURRENT USER MESSAGE:
${query}

REPLY:`

  return generateText(prompt, { temperature: 0.25, maxTokens: 700 })
}

export async function askPatentAssistant(query, sessionId) {
  const reusableSessionId = typeof sessionId === 'string' && sessionId.length <= 128
    ? sessionId
    : undefined
  const session = createSession(reusableSessionId)
  const history = session.getContext(MAX_HISTORY_TURNS)
  const activePatent = session.activePatent ?? null
  session.addTurn({ role: 'user', content: query })

  const started = performance.now()
  const planStarted = performance.now()
  const plan = await planTurn(query, history, activePatent)
  const planMs = Math.round(performance.now() - planStarted)

  if (plan.intent === 'clarify') {
    const answer = plan.clarification || 'Which patent are you asking about? Please share its application number or IP ID.'
    session.addTurn({ role: 'assistant', content: answer, domain: 'patents', stage: 'needs_clarification' })
    return {
      answer, patent: null, sources: [], grounded: false, stage: 'needs_clarification',
      sessionId: session.id, timing: { planMs, recordMs: 0, retrieveMs: 0, answerMs: 0, totalMs: Math.round(performance.now() - started) },
    }
  }

  let patent = null
  let recordNotFound = null
  let recordMs = 0
  const needsRecord = plan.intent === 'record' || plan.intent === 'both' || Boolean(plan.identifier)
  if (needsRecord && !plan.identifier && !(plan.useActivePatent && activePatent)) {
    const answer = plan.clarification || 'Which patent are you asking about? Please share its application number or IP ID.'
    session.addTurn({ role: 'assistant', content: answer, domain: 'patents', stage: 'needs_clarification' })
    return {
      answer, patent: null, sources: [], grounded: false, stage: 'needs_clarification',
      sessionId: session.id, timing: { planMs, recordMs: 0, retrieveMs: 0, answerMs: 0, totalMs: Math.round(performance.now() - started) },
    }
  }
  if (needsRecord) {
    const recordStarted = performance.now()
    if (plan.identifier || (plan.useActivePatent && activePatent)) {
      patent = await lookupPlannedRecord(plan, activePatent)
      if (!patent) recordNotFound = { type: plan.identifierType, value: plan.identifier }
      else session.activePatent = patent
    }
    recordMs = Math.round(performance.now() - recordStarted)
    if (plan.identifier && !patent) session.activePatent = null
  }

  let chunks = []
  let retrieveMs = 0
  const needsDocuments = plan.intent === 'documents' || plan.intent === 'both'
  if (needsDocuments) {
    const searchQuery = plan.searchQuery || query
    const scopedApplicationNumber =
      (plan.useActivePatent && activePatent?.application_number) || patent?.application_number || null
    const retrievalStarted = performance.now()
    const invalidIdTarget = plan.identifierType === 'id' && recordNotFound
    if (!invalidIdTarget) {
      chunks = await retrievePatentDocuments(
        searchQuery,
        scopedApplicationNumber || (recordNotFound?.type === 'application_number' ? recordNotFound.value : null),
      )
    }
    retrieveMs = Math.round(performance.now() - retrievalStarted)
  }

  const answerStarted = performance.now()
  const answer = await composeReply({ query, history, plan, patent, chunks, recordNotFound })
  const answerMs = Math.round(performance.now() - answerStarted)
  session.addTurn({ role: 'assistant', content: answer, domain: 'patents', stage: 'answered' })

  const sources = sourceList(chunks)
  return {
    answer,
    patent: safeRecord(patent),
    sources,
    grounded: Boolean(patent || chunks.length),
    stage: 'answered',
    sessionId: session.id,
    timing: { planMs, recordMs, retrieveMs, answerMs, totalMs: Math.round(performance.now() - started) },
  }
}

export { PatentLookupError }
