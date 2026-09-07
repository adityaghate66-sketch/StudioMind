/**
 * Response schema for Continuity agent step 1 — claim extraction.
 *
 * Gemini is constrained to return a JSON array of claim objects. Field enums
 * mirror server/src/prompts/continuityExtractionPrompt.js and the values stored
 * in server/src/models/PipelineRun.js.
 */
module.exports = {
  type: 'array',
  description: 'Checkable real-world claims extracted from the scene.',
  items: {
    type: 'object',
    properties: {
      claim: {
        type: 'string',
        description: 'The exact claim text from the scene.',
      },
      context: {
        type: 'string',
        description: 'The sentence or line from the scene where the claim appears.',
      },
      type: {
        type: 'string',
        description: 'Category of the claim.',
        enum: ['historical', 'technical', 'location', 'brand', 'legal_risk', 'other'],
      },
    },
    required: ['claim', 'context', 'type'],
  },
}
