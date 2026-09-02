/**
 * Build the prompt for extracting checkable claims from a scene.
 * @param {string} sceneText - The screenplay scene text.
 * @returns {string} - The full prompt.
 */
const continuityExtractionPrompt = (sceneText) => `
You are a continuity and legal-risk analyst for a film production.

Analyze the following scene and extract every checkable claim — statements that reference real-world facts that could be verified or challenged.

SCENE:
${sceneText}

WHAT COUNTS AS A CHECKABLE CLAIM:
- Real location names (e.g., "Eiffel Tower", "Times Square")
- Historical facts or dates (e.g., "during the 1969 moon landing")
- Technical details (e.g., "a Glock 19 fires 9mm rounds")
- Real brand names (e.g., "a Coca-Cola bottle")
- References to living people or public figures
- Scientific claims (e.g., "sound travels at 343 m/s")

WHAT DOES NOT COUNT:
- Fictional character names or actions
- Obvious creative descriptions ("the golden light of sunset")
- Dialogue that is clearly fictional opinion

OUTPUT FORMAT:
Return a JSON array of claim objects. Each claim object must have:
- "claim": the exact claim text from the scene
- "context": the sentence or line where it appears
- "type": one of "historical", "technical", "location", "brand", "legal_risk", "other"

Return ONLY the JSON array, nothing else.
`

module.exports = continuityExtractionPrompt
