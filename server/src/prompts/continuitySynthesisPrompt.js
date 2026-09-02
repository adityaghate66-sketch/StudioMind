/**
 * Build the prompt for synthesizing verification verdicts.
 * @param {string} sceneText - The original scene text.
 * @param {Array} claims - Extracted claims array.
 * @param {Array} verificationResults - Parallel API results per claim.
 * @returns {string} - The full prompt.
 */
const continuitySynthesisPrompt = (sceneText, claims, verificationResults) => `
You are a continuity and legal-risk synthesizer for a film production.

Given the original scene, the extracted claims, and the web verification results for each claim, produce a producer-facing continuity report.

SCENE:
${sceneText}

CLAIMS AND VERIFICATION RESULTS:
${JSON.stringify(
  claims.map((claim, i) => ({
    ...claim,
    verification: verificationResults[i] || { status: 'no_verification_data' },
  })),
  null,
  2
)}

For each claim, produce a verdict object with:
- "claim": the original claim text
- "type": the claim category (historical/technical/location/brand/legal_risk/other)
- "verdict": one of "confirmed", "disputed", "unverifiable"
- "confidence": "high", "medium", or "low"
- "summary": a 1-2 sentence producer-facing explanation of what the verification found
- "sources": array of source URLs or citations from the verification data (if available)

RULES:
- If verification data confirms the claim, verdict = "confirmed"
- If verification data contradicts the claim, verdict = "disputed"
- If there is insufficient data to judge, verdict = "unverifiable"
- Be conservative: when in doubt, mark as "unverifiable"
- The summary should be written for a film producer, not a lawyer — clear, practical, no jargon

OUTPUT FORMAT:
Return a JSON object with:
- "claims": array of verdict objects
- "overallRisk": "low", "medium", or "high" (based on number of disputed/legal_risk claims)
- "summary": a 2-3 sentence overall producer-facing summary

Return ONLY the JSON object, nothing else.
`

module.exports = continuitySynthesisPrompt
