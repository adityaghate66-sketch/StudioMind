const { generate } = require('../../services/gemini/textGeneration')
const { verifyClaim } = require('../../services/parallel/verifyClaim')
const continuityExtractionPrompt = require('../../prompts/continuityExtractionPrompt')
const continuitySynthesisPrompt = require('../../prompts/continuitySynthesisPrompt')

/**
 * Continuity & Legal Risk agent.
 * 1. Gemini extracts checkable claims from the scene.
 * 2. Parallel Search API verifies each claim.
 * 3. Gemini synthesizes verdicts per claim.
 *
 * @param {string} sceneText - The screenplay scene text.
 * @returns {Promise<Object>} - { claims: [...], overallRisk, summary }
 */
const runContinuityAgent = async (sceneText) => {
  // Step 1: Extract claims
  const extractPrompt = continuityExtractionPrompt(sceneText)
  const claims = await generate({ prompt: extractPrompt, expectJson: true })

  if (!Array.isArray(claims) || claims.length === 0) {
    return {
      claims: [],
      overallRisk: 'low',
      summary: 'No checkable claims found in the scene.',
    }
  }

  // Step 2: Verify each claim via Parallel API
  const verificationResults = await Promise.all(
    claims.map(async (claim) => {
      try {
        const result = await verifyClaim({
          objective: `Verify the following claim: "${claim.claim}"`,
          searchQueries: [claim.claim, claim.context || claim.claim],
          maxResults: 5,
          excerpts: 3,
        })
        return result
      } catch (err) {
        console.error(`Parallel verification failed for claim "${claim.claim}":`, err.message)
        return { status: 'verification_failed', error: err.message }
      }
    })
  )

  // Step 3: Synthesize verdicts
  const synthPrompt = continuitySynthesisPrompt(sceneText, claims, verificationResults)
  const report = await generate({ prompt: synthPrompt, expectJson: true })

  return report
}

module.exports = runContinuityAgent
