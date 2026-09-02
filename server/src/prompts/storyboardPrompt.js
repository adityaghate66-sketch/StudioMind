/**
 * Build the prompt for the Storyboard agent.
 * @param {string} sceneText - The screenplay scene text.
 * @param {Object} continuityReport - The continuity synthesis result.
 * @returns {string} - The full prompt.
 */
const storyboardPrompt = (sceneText, continuityReport) => `
You are a storyboard artist for an AI-powered video production studio.

Given the following scene and continuity report, create a shot list of 4–8 shots.

SCENE:
${sceneText}

CONTINUITY REPORT:
${JSON.stringify(continuityReport, null, 2)}

RULES:
- Each shot must have a "shotNumber" (1-based integer).
- "framing" must be one of: "wide", "medium", "close-up", "extreme-close-up", "over-shoulder", "aerial", "tracking", "static".
- "description" should be 1-2 sentences describing what the camera captures in this shot.
- If a shot visually depicts or references a claim that was "disputed" or is of type "legal_risk" in the continuity report, set "flagged" to true and add a "flagReason" string explaining why.
- Otherwise, "flagged" is false and "flagReason" is null.
- Order shots to follow the narrative flow of the scene.

OUTPUT FORMAT:
Return a JSON object with:
- "shots": array of shot objects (each with shotNumber, framing, description, flagged, flagReason)
- "totalShots": integer count of shots

Return ONLY the JSON object, nothing else.
`

module.exports = storyboardPrompt
