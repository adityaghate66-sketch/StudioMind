const { generate } = require('../../services/gemini/textGeneration')
const { verifyClaim } = require('../../services/parallel/verifyClaim')
const continuityExtractionPrompt = require('../../prompts/continuityExtractionPrompt')
const continuitySynthesisPrompt = require('../../prompts/continuitySynthesisPrompt')
const continuityExtractionSchema = require('../../schemas/continuityExtraction')
const continuitySynthesisSchema = require('../../schemas/continuitySynthesis')

/**
 * Continuity & Legal Risk agent.
 * 1. Gemini extracts checkable claims from the scene.
 * 2. Parallel Search API verifies each claim.
 * 3. Gemini synthesizes verdicts per claim.
 *
 * @param {string} sceneText - The screenplay scene text.
 * @param {AbortSignal} [signal] - AbortSignal for cancellation.
 * @returns {Promise<Object>} - { claims: [...], overallRisk, summary }
 */
const runContinuityAgent = async (sceneText, signal) => {
  // Step 1: Extract claims
  const extractPrompt = continuityExtractionPrompt(sceneText)
  const claims = await generate({
    prompt: extractPrompt,
    expectJson: true,
    schema: continuityExtractionSchema,
  })

  if (!Array.isArray(claims) || claims.length === 0) {
    return {
      claims: [],
      overallRisk: 'low',
      summary: 'No checkable claims found in the scene.',
    }
  }

  // Step 2: Verify each claim via Parallel API (sequential to avoid 429s)
  const verificationResults = []
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i]
    try {
      const result = await verifyClaim({
          objective: `Verify the following claim: "${claim.claim}"`,
          searchQueries: [claim.claim, claim.context || claim.claim],
          maxResults: 5,
          excerpts: 3,
          signal,
        })
      verificationResults.push(result)
    } catch (err) {
      console.error(`Parallel verification failed for claim "${claim.claim}":`, err.message)
      verificationResults.push({ status: 'verification_failed', error: err.message })
    }
    // Brief delay between requests to respect rate limits
    if (i < claims.length - 1) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  // Step 3: Synthesize verdicts
  const synthPrompt = continuitySynthesisPrompt(sceneText, claims, verificationResults)
  const report = await generate({
    prompt: synthPrompt,
    expectJson: true,
    schema: continuitySynthesisSchema,
  })

  return report
}

module.exports = runContinuityAgent
