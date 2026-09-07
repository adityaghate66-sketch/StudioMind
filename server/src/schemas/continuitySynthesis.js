/**
 * Response schema for Continuity agent step 3 — verdict synthesis.
 *
 * Gemini is constrained to return a report object. Enum values must match
 * server/src/models/PipelineRun.js exactly:
 *   verdict:     confirmed | disputed | unverifiable
 *   confidence:  high | medium | low
 *   overallRisk: low | medium | high
 */
module.exports = {
  type: 'object',
  properties: {
    claims: {
      type: 'array',
      description: 'A verdict object per extracted claim, in claim order.',
      items: {
        type: 'object',
        properties: {
          claim: {
            type: 'string',
            description: 'The original claim text.',
          },
          type: {
            type: 'string',
            description: 'Category of the claim.',
            enum: ['historical', 'technical', 'location', 'brand', 'legal_risk', 'other'],
          },
          verdict: {
            type: 'string',
            enum: ['confirmed', 'disputed', 'unverifiable'],
          },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
          },
          summary: {
            type: 'string',
            description: 'A 1-2 sentence producer-facing explanation of what the verification found.',
          },
          sources: {
            type: 'array',
            description: 'Source URLs or citations from the verification data.',
            items: { type: 'string' },
          },
        },
        required: ['claim', 'type', 'verdict', 'confidence', 'summary', 'sources'],
      },
    },
    overallRisk: {
      type: 'string',
      description: 'Overall continuity/legal risk across the scene.',
      enum: ['low', 'medium', 'high'],
    },
    summary: {
      type: 'string',
      description: 'A 2-3 sentence overall producer-facing summary.',
    },
  },
  required: ['claims', 'overallRisk', 'summary'],
}
