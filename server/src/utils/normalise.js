/**
 * Shared normalisation helpers for LLM output → Mongoose schema compliance.
 *
 * Imported by both the Director agent (mid-pipeline saves) and the
 * pipeline controller (final save).  A single source of truth prevents
 * the two copies from drifting.
 */

const VALID_VERDICTS = ['confirmed', 'disputed', 'unverifiable']
const VALID_CONFIDENCE = ['high', 'medium', 'low']
const VALID_RISK = ['low', 'medium', 'high']
const VALID_FRAMING = [
  'wide', 'medium', 'close-up', 'extreme-close-up',
  'over-shoulder', 'aerial', 'tracking', 'static',
]

/** Lowercase and trim a string, return fallback if empty. */
const safeStr = (v, fallback = '') =>
  typeof v === 'string' ? v.trim() || fallback : fallback

/** Pick the closest valid enum value via prefix match, or return fallback. */
const closestEnum = (value, valid, fallback) => {
  const v = safeStr(value).toLowerCase()
  if (!v) return fallback
  if (valid.includes(v)) return v
  const match = valid.find((e) => e.startsWith(v))
  return match || fallback
}

/** Normalise a single continuity claim from Gemini. */
const normaliseClaim = (c) => ({
  claim: safeStr(c?.claim, '[No claim text]'),
  type: safeStr(c?.type, 'other'),
  verdict: closestEnum(c?.verdict, VALID_VERDICTS, 'unverifiable'),
  confidence: closestEnum(c?.confidence, VALID_CONFIDENCE, 'medium'),
  summary: safeStr(c?.summary, 'No summary provided.'),
  sources: Array.isArray(c?.sources)
    ? c.sources.map((s) => safeStr(s)).filter(Boolean)
    : [],
})

/** Normalise a single shot from Gemini. */
const normaliseShot = (s) => ({
  shotNumber: Number.isFinite(Number(s?.shotNumber)) ? Number(s.shotNumber) : 0,
  framing: closestEnum(s?.framing, VALID_FRAMING, 'static'),
  description: safeStr(s?.description, '[No description]'),
  flagged: Boolean(s?.flagged),
  flagReason: s?.flagged ? safeStr(s?.flagReason, 'Flagged by AI') : null,
})

/** Normalise the full pipeline result before saving. */
const normaliseResult = (result) => {
  const continuityClaims = Array.isArray(result.continuityReport?.claims)
    ? result.continuityReport.claims.map(normaliseClaim)
    : []

  const continuityOverallRisk = closestEnum(
    result.continuityReport?.overallRisk,
    VALID_RISK,
    'low'
  )

  const continuitySummary = safeStr(result.continuityReport?.summary, '')

  const shots = Array.isArray(result.storyboard?.shots)
    ? result.storyboard.shots.map(normaliseShot)
    : []

  return { continuityClaims, continuityOverallRisk, continuitySummary, shots }
}

module.exports = {
  safeStr,
  closestEnum,
  normaliseClaim,
  normaliseShot,
  normaliseResult,
}
