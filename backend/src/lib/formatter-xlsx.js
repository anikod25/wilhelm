/**
 * formatter-xlsx.js — pipeline result(s) → validated .xlsx Buffer
 *
 * Public API:
 *   formatXlsx(input)  →  Promise<Buffer>
 *
 * `input` can be:
 *   • a single PipelineResult          → one data row on the "Answers" sheet
 *   • an array of PipelineResult       → one row per result (batch export)
 *   • an array of { query, result }    → same, but with the originating query
 *     where query is a string and result is a PipelineResult
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Workbook structure
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Sheet 1 — "Answers"
 *  ┌──────────┬─────────────────────┬────────┬───────────┬──────────┬──────────────┬─────────┬──────────────┬──────────────┐
 *  │  #       │  Query              │ Answer │  Domain   │ Grounded │  Stage       │  Conf.  │  Sources     │  Total ms    │
 *  ├──────────┼─────────────────────┼────────┼───────────┼──────────┼──────────────┼─────────┼──────────────┼──────────────┤
 *  │  1       │  How many days…     │ You…   │  hr       │  true    │  answered    │  high   │  hr-pol…     │  312         │
 *  └──────────┴─────────────────────┴────────┴───────────┴──────────┴──────────────┴─────────┴──────────────┴──────────────┘
 *
 *  Sheet 2 — "Sources"  (one row per source per answer; join back via row #)
 *  ┌──────────┬──────────────────────┬───────────────────┬────────────────┬──────────────┐
 *  │  Answer# │  Domain              │  Filename         │  Heading       │  File Path   │
 *  ├──────────┼──────────────────────┼───────────────────┼────────────────┼──────────────┤
 *  │  1       │  hr-policies         │  01-annual-leave  │  Entitlement   │  hr-pol…     │
 *  └──────────┴──────────────────────┴───────────────────┴────────────────┴──────────────┘
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Validation
 * ─────────────────────────────────────────────────────────────────────────────
 *   After building the workbook, formatXlsx() calls workbook.xlsx.writeBuffer()
 *   and then parses the resulting Buffer back using ExcelJS to confirm:
 *     • the Buffer is non-empty and parseable
 *     • the "Answers" sheet exists with the correct column headers
 *     • the row count matches the input length
 *   Throws XlsxValidationError (extends ValidationError) on failure.
 */

import ExcelJS from 'exceljs'
import { ValidationError } from './formatter.js'

// ── Error type ────────────────────────────────────────────────────────────────

export class XlsxValidationError extends ValidationError {
  /** @param {string} message @param {string} [field] */
  constructor(message, field) {
    super(message, field)
    this.name = 'XlsxValidationError'
  }
}

// ── Style constants ───────────────────────────────────────────────────────────

const HEADER_FILL = {
  type:    'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F3864' },   // dark navy
}

const HEADER_FONT = {
  name:  'Calibri',
  bold:  true,
  color: { argb: 'FFFFFFFF' },
  size:  11,
}

const BODY_FONT = { name: 'Calibri', size: 11 }

const BORDER_THIN = { style: 'thin', color: { argb: 'FFD0D0D0' } }

const CELL_BORDER = {
  top:    BORDER_THIN,
  left:   BORDER_THIN,
  bottom: BORDER_THIN,
  right:  BORDER_THIN,
}

const GROUNDED_TRUE_FILL = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFE2EFDA' },   // light green
}

const GROUNDED_FALSE_FILL = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFFCE4D6' },   // light red
}

// ── Input normalisation ───────────────────────────────────────────────────────

/**
 * @typedef {{ query: string, result: import('./pipeline.js').PipelineResult }} QAPair
 */

/**
 * Accept a single result, a result[], or a QAPair[] and normalise to QAPair[].
 * @param {*} input
 * @returns {QAPair[]}
 */
function normaliseInput(input) {
  if (!input) throw new XlsxValidationError('input must not be null or undefined', 'input')

  const arr = Array.isArray(input) ? input : [input]

  if (arr.length === 0) throw new XlsxValidationError('input array must not be empty', 'input')

  return arr.map((item, i) => {
    // Already a { query, result } pair
    if (item && typeof item === 'object' && 'result' in item) {
      return {
        query:  String(item.query  ?? ''),
        result: item.result,
      }
    }
    // Bare PipelineResult — must have at least an `answer` field
    if (item && typeof item === 'object' && 'answer' in item) {
      return { query: '', result: item }
    }
    throw new XlsxValidationError(`item at index ${i} is not a PipelineResult or QAPair`, 'input')
  })
}

// ── Column definitions ────────────────────────────────────────────────────────

/** @type {Partial<ExcelJS.Column>[]} */
const ANSWERS_COLUMNS = [
  { header: '#',          key: 'num',        width: 6  },
  { header: 'Query',      key: 'query',      width: 40 },
  { header: 'Answer',     key: 'answer',     width: 70 },
  { header: 'Domain',     key: 'domain',     width: 14 },
  { header: 'Grounded',   key: 'grounded',   width: 11 },
  { header: 'Stage',      key: 'stage',      width: 15 },
  { header: 'Confidence', key: 'confidence', width: 13 },
  { header: 'Sources',    key: 'sources',    width: 45 },
  { header: 'Total ms',   key: 'totalMs',    width: 11 },
]

/** @type {Partial<ExcelJS.Column>[]} */
const SOURCES_COLUMNS = [
  { header: 'Answer #',  key: 'answerNum',  width: 11 },
  { header: 'Domain',    key: 'domain',     width: 16 },
  { header: 'Filename',  key: 'filename',   width: 28 },
  { header: 'Heading',   key: 'heading',    width: 28 },
  { header: 'File Path', key: 'filePath',   width: 45 },
]

// ── Sheet builders ────────────────────────────────────────────────────────────

/**
 * Apply consistent header styling to a worksheet's first row.
 * @param {ExcelJS.Worksheet} ws
 */
function styleHeaderRow(ws) {
  const row = ws.getRow(1)
  row.eachCell((cell) => {
    cell.fill   = HEADER_FILL
    cell.font   = HEADER_FONT
    cell.border = CELL_BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false }
  })
  row.height = 20
  row.commit()
}

/**
 * Apply body styling to a data row.
 * @param {ExcelJS.Row}  row
 * @param {boolean}      grounded   — used for conditional fill on that cell
 * @param {number}       rowIndex   — 1-based, used for zebra striping
 */
function styleDataRow(row, grounded, rowIndex) {
  const zebraFill = rowIndex % 2 === 0
    ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    : null

  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font   = BODY_FONT
    cell.border = CELL_BORDER
    cell.alignment = { vertical: 'top', wrapText: true }
    if (zebraFill) cell.fill = zebraFill
  })

  // Override grounded cell with traffic-light colour (Answers sheet only).
  // Guard: only call getCell if this worksheet actually has a 'grounded' column.
  const groundedColNum = row.worksheet.columns?.findIndex((c) => c?.key === 'grounded')
  if (groundedColNum > 0) {
    const groundedCell     = row.getCell(groundedColNum)
    groundedCell.fill      = grounded ? GROUNDED_TRUE_FILL : GROUNDED_FALSE_FILL
    groundedCell.alignment = { vertical: 'middle', horizontal: 'center' }
  }

  row.commit()
}

/**
 * Build the "Answers" sheet.
 * @param {ExcelJS.Worksheet} ws
 * @param {QAPair[]}          pairs
 */
function buildAnswersSheet(ws, pairs) {
  ws.columns = ANSWERS_COLUMNS

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  styleHeaderRow(ws)

  pairs.forEach(({ query, result }, i) => {
    const num      = i + 1
    const sources  = (result.sources ?? [])
      .map((s) => {
        const parts = [s.domain, s.filename, s.heading]
          .filter(Boolean).join(' › ')
        return parts
      })
      .join('\n')

    const row = ws.addRow({
      num,
      query:      String(query ?? ''),
      answer:     String(result.answer      ?? ''),
      domain:     String(result.domain      ?? ''),
      grounded:   Boolean(result.grounded),
      stage:      String(result.stage       ?? ''),
      confidence: String(result.confidence  ?? ''),
      sources,
      totalMs:    Number(result.timing?.totalMs ?? 0),
    })

    // Tall rows for multi-line answers
    row.height = Math.min(
      20 + Math.floor(String(result.answer ?? '').length / 80) * 14,
      200,
    )

    styleDataRow(row, Boolean(result.grounded), num)
  })

  // Auto-filter on header row
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + ANSWERS_COLUMNS.length)}1` }
}

/**
 * Build the "Sources" sheet.
 * @param {ExcelJS.Worksheet} ws
 * @param {QAPair[]}          pairs
 */
function buildSourcesSheet(ws, pairs) {
  ws.columns = SOURCES_COLUMNS
  ws.views   = [{ state: 'frozen', ySplit: 1 }]

  styleHeaderRow(ws)

  let dataRowIndex = 1
  pairs.forEach(({ result }, i) => {
    const answerNum = i + 1
    const docs = result.sources ?? []

    if (docs.length === 0) {
      // Still write a placeholder so the join back is obvious
      const row = ws.addRow({
        answerNum,
        domain:   '',
        filename: '(no sources)',
        heading:  '',
        filePath: '',
      })
      dataRowIndex++
      styleDataRow(row, true, dataRowIndex)
      return
    }

    docs.forEach((doc) => {
      const row = ws.addRow({
        answerNum,
        domain:   String(doc.domain   ?? ''),
        filename: String(doc.filename ?? ''),
        heading:  String(doc.heading  ?? ''),
        filePath: String(doc.filePath ?? ''),
      })
      dataRowIndex++
      styleDataRow(row, true, dataRowIndex)
    })
  })

  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + SOURCES_COLUMNS.length)}1` }
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Parse the Buffer back and assert structural integrity.
 * @param {Buffer} buffer
 * @param {number} expectedRows   — number of data rows expected in "Answers"
 */
async function validateBuffer(buffer, expectedRows) {
  if (!buffer || buffer.length === 0) {
    throw new XlsxValidationError('writeBuffer produced an empty buffer', 'buffer')
  }

  // Re-parse the Buffer through ExcelJS
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer)
  } catch (err) {
    throw new XlsxValidationError(
      `parse-back failed — buffer is not valid xlsx: ${err.message}`,
      'buffer',
    )
  }

  // "Answers" sheet must exist
  const answers = wb.getWorksheet('Answers')
  if (!answers) {
    throw new XlsxValidationError('sheet "Answers" not found after parse-back', 'Answers')
  }

  // Header row must have expected column names
  const expectedHeaders = ANSWERS_COLUMNS.map((c) => c.header)
  const actualHeaders   = answers.getRow(1).values.slice(1) // values[0] is undefined in ExcelJS
  for (let i = 0; i < expectedHeaders.length; i++) {
    if (actualHeaders[i] !== expectedHeaders[i]) {
      throw new XlsxValidationError(
        `Answers column ${i + 1}: expected "${expectedHeaders[i]}", got "${actualHeaders[i]}"`,
        `Answers.header[${i}]`,
      )
    }
  }

  // Data row count must match
  const actualRows = answers.rowCount - 1  // subtract header
  if (actualRows !== expectedRows) {
    throw new XlsxValidationError(
      `Answers sheet has ${actualRows} data rows, expected ${expectedRows}`,
      'Answers.rowCount',
    )
  }

  // "Sources" sheet must also exist
  const sources = wb.getWorksheet('Sources')
  if (!sources) {
    throw new XlsxValidationError('sheet "Sources" not found after parse-back', 'Sources')
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Format one or more pipeline results as a downloadable .xlsx Buffer.
 *
 * @param {
 *   import('./pipeline.js').PipelineResult |
 *   import('./pipeline.js').PipelineResult[] |
 *   Array<{ query: string, result: import('./pipeline.js').PipelineResult }>
 * } input
 * @returns {Promise<Buffer>}
 * @throws {XlsxValidationError}  if input is invalid or the parse-back check fails
 *
 * @example
 * // Single result
 * const buf = await formatXlsx(pipelineResult)
 * res.set({
 *   'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 *   'Content-Disposition': 'attachment; filename="answer.xlsx"',
 * }).send(buf)
 *
 * @example
 * // Batch export with queries
 * const buf = await formatXlsx([
 *   { query: 'How many sick days?', result: result1 },
 *   { query: 'How do I reset my VPN?', result: result2 },
 * ])
 */
export async function formatXlsx(input) {
  // ── 1. Normalise input ───────────────────────────────────────────────────
  const pairs = normaliseInput(input)

  // ── 2. Build workbook ────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()

  wb.creator  = 'Wilhelm Knowledge Base'
  wb.created  = new Date()
  wb.modified = new Date()
  wb.properties.date1904 = false

  buildAnswersSheet(wb.addWorksheet('Answers'), pairs)
  buildSourcesSheet(wb.addWorksheet('Sources'), pairs)

  // ── 3. Serialise to Buffer ───────────────────────────────────────────────
  let buffer
  try {
    buffer = Buffer.from(await wb.xlsx.writeBuffer())
  } catch (err) {
    throw new XlsxValidationError(
      `writeBuffer failed: ${err.message}`,
      'buffer',
    )
  }

  // ── 4. Parse-back validation ─────────────────────────────────────────────
  await validateBuffer(buffer, pairs.length)

  return buffer
}
