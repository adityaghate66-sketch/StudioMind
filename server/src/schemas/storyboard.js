/**
 * Response schema for the Storyboard agent.
 *
 * Gemini is constrained to return a shot-list object. The framing enum must
 * match server/src/models/PipelineRun.js exactly:
 *   framing: wide | medium | close-up | extreme-close-up | over-shoulder |
 *            aerial | tracking | static
 */
module.exports = {
  type: 'object',
  properties: {
    shots: {
      type: 'array',
      description: 'The shot list, ordered to follow the narrative flow of the scene (4-8 shots).',
      items: {
        type: 'object',
        properties: {
          shotNumber: {
            type: 'integer',
            description: '1-based shot number.',
          },
          framing: {
            type: 'string',
            enum: [
              'wide',
              'medium',
              'close-up',
              'extreme-close-up',
              'over-shoulder',
              'aerial',
              'tracking',
              'static',
            ],
          },
          description: {
            type: 'string',
            description: '1-2 sentences describing what the camera captures in this shot.',
          },
          flagged: {
            type: 'boolean',
            description: 'True if this shot depicts a disputed or legal-risk claim.',
          },
          flagReason: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Why the shot is flagged; null when flagged is false.',
          },
        },
        required: ['shotNumber', 'framing', 'description', 'flagged', 'flagReason'],
      },
    },
    totalShots: {
      type: 'integer',
      description: 'Total number of shots.',
    },
  },
  required: ['shots', 'totalShots'],
}
