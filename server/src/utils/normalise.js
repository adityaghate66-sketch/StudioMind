/**
 * Shared normalisation helpers for LLM output → Mongoose schema compliance.
 *
 * Imported by both the Director agent (mid-pipeline saves) and the
 * pipeline controller (final save).  A single source of truth prevents
 * the two copies from drifting.
 *
 * Every time a value has to be substituted (missing, empty, or outside the
 * valid enums), a `[normalise] substitution` warning is logged. With the
 * responseSchema constraints in place these should be rare — seeing them means
 * the model still drifted and the safety net caught it.
 */

const VALID_VERDICTS = ['confirmed', 'disputed', 'unverifiable']
const VALID_CONFIDENCE = ['high', 'medium', 'low']
const VALID_RISK = ['low', 'medium', 'high']
const VALID_FRAMING = [
  'wide', 'medium', 'close-up', 'extreme-close-up',
  'over-shoulder', 'aerial', 'tracking', 'static',
]

/** Log that a raw LLM value was replaced by a fallback / coerced enum. */
const logSubstitution = (where, field, raw, resolved) => {
  let rawPreview
  try {
    rawPreview = raw === undefined ? '(missing)' : JSON.stringify(raw)
  } catch {
    rawPreview = String(raw)
  }
  console.warn(
    `[normalise] substitution in ${where}.${field}: ${rawPreview} -> ${JSON.stringify(resolved)}`
  )
}

/** Lowercase and trim a string, return fallback if empty. */
const safeStr = (v, fallback = '', where = '', field = '') => {
  if (typeof v === 'string' && v.trim()) return v.trim()
  logSubstitution(where || 'value', field || 'text', v, fallback)
  return fallback
}

/** Pick the closest valid enum value via prefix match, or return fallback. */
const closestEnum = (value, valid, fallback, where = '', field = '') => {
  const raw = typeof value === 'string' ? value.trim() : ''
  const v = raw.toLowerCase()
  if (!v) {
    logSubstitution(where || 'enum', field || 'value', value ?? '(missing)', fallback)
    return fallback
  }
  if (valid.includes(v)) return v
  const match = valid.find((e) => e.startsWith(v)) || fallback
  logSubstitution(where || 'enum', field || 'value', value, match)
  return match
}

/** Short label identifying which claim a substitution warning belongs to. */
const claimLabel = (c) => (c && typeof c.claim === 'string' ? `claim "${c.claim.slice(0, 60)}"` : 'claim')

/** Short label identifying which shot a substitution warning belongs to. */
const shotLabel = (s) =>
  s && typeof s.description === 'string' ? `shot "${s.description.slice(0, 60)}"` : 'shot'

/** Normalise a single continuity claim from Gemini. */
const normaliseClaim = (c) => {
  const where = claimLabel(c)
  return {
    claim: safeStr(c?.claim, '[No claim text]', where, 'claim'),
    type: safeStr(c?.type, 'other', where, 'type'),
    verdict: closestEnum(c?.verdict, VALID_VERDICTS, 'unverifiable', where, 'verdict'),
    confidence: closestEnum(c?.confidence, VALID_CONFIDENCE, 'medium', where, 'confidence'),
    summary: safeStr(c?.summary, 'No summary provided.', where, 'summary'),
    sources: Array.isArray(c?.sources)
      ? c.sources.map((s) => safeStr(s)).filter(Boolean)
      : (() => {
          logSubstitution(where, 'sources', c?.sources ?? '(missing)', [])
          return []
        })(),
  }
}

/** Normalise a single shot from Gemini. */
const normaliseShot = (s) => {
  const where = shotLabel(s)
  const shotNumber = Number.isFinite(Number(s?.shotNumber)) ? Number(s.shotNumber) : (() => {
    logSubstitution(where, 'shotNumber', s?.shotNumber ?? '(missing)', 0)
    return 0
  })()
  const flagged = typeof s?.flagged === 'boolean' ? s.flagged : (() => {
    logSubstitution(where, 'flagged', s?.flagged ?? '(missing)', Boolean(s?.flagged))
    return Boolean(s?.flagged)
  })()
  const flagReason =
    flagged
      ? safeStr(s?.flagReason, 'Flagged by AI', where, 'flagReason')
      : null
  return {
    shotNumber,
    framing: closestEnum(s?.framing, VALID_FRAMING, 'static', where, 'framing'),
    description: safeStr(s?.description, '[No description]', where, 'description'),
    flagged,
    flagReason,
  }
}

/** Normalise the full pipeline result before saving. */
const normaliseResult = (result) => {
  const continuityClaims = Array.isArray(result.continuityReport?.claims)
    ? result.continuityReport.claims.map(normaliseClaim)
    : (() => {
        logSubstitution('continuityReport', 'claims', result.continuityReport?.claims ?? '(missing)', [])
        return []
      })()

  const continuityOverallRisk = closestEnum(
    result.continuityReport?.overallRisk,
    VALID_RISK,
    'low',
    'continuityReport',
    'overallRisk'
  )

  const continuitySummary = safeStr(result.continuityReport?.summary, '', 'continuityReport', 'summary')

  const shots = Array.isArray(result.storyboard?.shots)
    ? result.storyboard.shots.map(normaliseShot)
    : (() => {
        logSubstitution('storyboard', 'shots', result.storyboard?.shots ?? '(missing)', [])
        return []
      })()

  return { continuityClaims, continuityOverallRisk, continuitySummary, shots }
}

module.exports = {
  safeStr,
  closestEnum,
  normaliseClaim,
  normaliseShot,
  normaliseResult,
}
