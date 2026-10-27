
# PROJECT: Add an AI-Powered Portuguese Speaking Analysis Feature to the Existing Shadow Application

## 1. CRITICAL INSTRUCTION: DO NOT MODIFY THE EXISTING SHADOWING FEATURE

I have an existing Next.js application called **Shadow**, designed for language shadowing practice.

The existing shadowing functionality is complete, works perfectly, and must remain unchanged.

**THIS IS A STRICT REQUIREMENT.**

Do not rewrite, refactor, restructure, optimize, or otherwise modify the existing shadowing implementation unless an absolutely unavoidable integration issue requires a minimal change.

Specifically:

- Do not modify the existing shadowing practice page or its behavior.
- Do not modify the existing audio playback functionality.
- Do not modify the existing phrase-splitting logic.
- Do not modify the existing microphone detection or silence detection functionality.
- Do not modify the existing automatic advancement or manual mode.
- Do not modify the existing transcription and timestamp functionality.
- Do not modify the existing IndexedDB lesson storage behavior.
- Do not change the existing lesson creation workflow.
- Do not modify the existing "Refresh transcript & phrase breaks" functionality.
- Do not replace existing components or dependencies unnecessarily.
- Do not introduce changes that could break existing saved lessons.

**The goal is to ADD a completely separate feature alongside the existing shadowing functionality.**

Both features must coexist independently.

You may make minimal, additive changes to the main page to introduce navigation to the new feature.

Prefer creating new routes, components, utilities, API endpoints, and storage structures rather than modifying existing ones.

Before implementing anything, inspect the existing project architecture and identify how to integrate the new functionality without disrupting the original application.

---

# 2. NEW FEATURE OVERVIEW

## Feature Name: Speak & Improve

Create a new feature called **Speak & Improve**.

This feature will help intermediate Portuguese learners improve their spoken Portuguese through AI-powered transcription, corrections, explanations, and vocabulary development.

The core workflow is:

1. The user records themselves speaking Portuguese or uploads an existing audio recording.
2. The application transcribes the audio using OpenAI Whisper.
3. The original transcription is displayed to the user.
4. The transcription is sent to an OpenAI text model for linguistic analysis.
5. The AI identifies grammar mistakes, unnatural expressions, vocabulary issues, tense problems, and other opportunities for improvement.
6. The application generates a corrected version that preserves the user's intended meaning.
7. The user is taken to a dedicated analysis page.
8. The analysis page displays the original transcription alongside the corrected version.
9. Corrections are highlighted and annotated.
10. Detailed explanations describe what was wrong, why it was wrong, and how to improve.
11. The user can review vocabulary suggestions and more sophisticated ways to express their ideas.
12. The analysis session can be saved and revisited later.

The experience should feel like receiving detailed, personalized feedback from a native Brazilian Portuguese tutor.

This is NOT a shadowing exercise.

It is a separate speaking-analysis and language-improvement feature.

---

# 3. NAVIGATION AND APPLICATION STRUCTURE

## Main Page

The current main page provides the ability to upload audio or video for shadowing.

Add a simple navigation system that allows the user to choose between:

**Tab 1: Shadowing**
- Existing functionality.
- Must remain exactly as it is.

**Tab 2: Speak & Improve**
- New speaking-analysis feature.
- Separate workflow.

The navigation should be visually consistent with the application's existing design.

Do not redesign the entire homepage.

Only introduce the minimum UI changes needed to access the new feature.

## New Routes

Create dedicated routes for the new feature.

Suggested structure:

`/speak`

The recording and audio-upload interface.

`/speak/analysis/[id]`

The dedicated analysis page displaying the original transcription, corrected transcription, annotations, explanations, and vocabulary.

`/speak/history`

Previously saved speaking-analysis sessions.

You may adjust these routes if the existing project architecture suggests a cleaner implementation.

However, do not interfere with the existing `/practice` route.

---

# 4. RECORDING AND AUDIO UPLOAD

The new Speak & Improve page must allow two input methods.

## Method A: Record Audio

The user should be able to record themselves speaking directly inside the browser.

Requirements:

- Request microphone permission.
- Start recording.
- Pause and resume recording when supported.
- Stop recording.
- Display recording duration.
- Provide a visual recording indicator.
- Allow playback before submission.
- Allow the user to discard and rerecord.
- Submit the recording for transcription and analysis.

Use browser-native recording capabilities such as MediaRecorder where appropriate.

Make sure the recording format is compatible with the transcription endpoint.

Handle browser compatibility issues gracefully.

Do not reuse or modify the existing shadowing microphone detection logic.

The new recording implementation must be independent.

## Method B: Upload Audio

Allow users to upload existing audio files.

Support common audio formats accepted by OpenAI's transcription endpoint.

Display:

- Filename
- File size
- Audio duration when available
- Playback controls
- Remove/replace file option

Validate supported file types and file size before submission.

The user should be able to listen to the audio before requesting analysis.

---

# 5. TRANSCRIPTION USING OPENAI WHISPER

The application already uses OpenAI's audio transcription API with `whisper-1`.

For this feature, create a separate server-side transcription workflow.

Do not modify the existing shadowing transcription implementation.

You may reuse existing noninvasive utilities if they are already safely shared, but avoid changing their behavior.

## Transcription Requirements

- Transcribe Portuguese speech.
- Support Brazilian Portuguese.
- Handle occasional English words and code-switching.
- Preserve the speaker's original wording as accurately as possible.
- Preserve grammatical mistakes.
- Preserve incomplete or awkward sentences.
- Do not intentionally correct the speaker's grammar during transcription.
- Do not translate English words into Portuguese during transcription.
- Do not invent words to make sentences grammatically correct.

**IMPORTANT: The transcription must represent what the user actually said, including mistakes.**

For example:

Audio:

"Os fundadores também tinha razão, né? Mas minha opinião é muito biased."

Original transcription:

"Os fundadores também tinha razão, né? Mas minha opinião é muito biased."

Do NOT automatically transform the transcription into:

"Os fundadores também tinham razão, mas minha opinião é tendenciosa."

That correction belongs in the AI analysis stage.

## Editable Transcription

After transcription, show the original transcription in an editable text area.

The user must be able to:

- Review the transcription.
- Fix words Whisper misheard.
- Restore English words that were incorrectly translated.
- Correct transcription inaccuracies.
- Add missing punctuation.
- Confirm the transcription before analysis.

This step is important because transcription errors should not be confused with the user's actual Portuguese mistakes.

Include a button:

**Analyze My Portuguese**

Only after the user confirms the transcription should it be submitted for linguistic analysis.

Also provide an optional text-only input mode so the user can paste dictated Portuguese without recording audio.

---

# 6. AI-POWERED PORTUGUESE ANALYSIS

Once the user confirms the transcription, send it to an OpenAI text model using a new server-side API endpoint.

The OpenAI API key must remain server-side.

Never expose the API key in browser code.

The AI should act as an expert Brazilian Portuguese language tutor specializing in helping intermediate English-speaking learners improve their spoken Portuguese.

## Learning Objectives

The user is approximately B1–B2 in Portuguese.

The AI should help them improve:

- Grammar
- Verb conjugation
- Verb tense selection
- Subject-verb agreement
- Gender agreement
- Prepositions
- Articles
- Sentence structure
- Natural Brazilian Portuguese phrasing
- Vocabulary selection
- Idiomatic expressions
- Cohesion and argumentation
- Expressing complex ideas
- Code-switching between English and Portuguese
- Register and formality
- Fluency and naturalness

The analysis should be detailed and educational.

Do not simply return a corrected paragraph.

Explain WHY the changes are necessary.

---

# 7. SYSTEM PROMPT FOR THE PORTUGUESE TUTOR

Use the following as the foundation of the OpenAI analysis prompt.

You are an expert Brazilian Portuguese language tutor helping an intermediate English-speaking learner improve their spoken Portuguese.

The learner is approximately B1–B2.

They will provide transcriptions of spontaneous spoken Portuguese.

Their speech may contain:

- Grammatical mistakes
- Incorrect verb conjugations
- Incorrect verb tenses
- Gender agreement mistakes
- Incorrect prepositions
- Unnatural sentence constructions
- English words inserted into Portuguese sentences
- Literal translations from English
- Repetitions
- Hesitations
- Informal conversational expressions

Your task is to provide a thorough, accurate, constructive analysis of their Portuguese.

### Rule 1: Preserve Meaning

Never change the speaker's intended meaning.

Correct how they express their ideas, not the ideas themselves.

Do not introduce new arguments, opinions, or factual claims.

If the speaker's intended meaning is genuinely ambiguous, explain the ambiguity instead of inventing an interpretation.

### Rule 2: Preserve Natural Spoken Portuguese

The user is practicing conversational Brazilian Portuguese.

Do not automatically convert their speech into formal academic writing.

Preserve appropriate conversational expressions such as:

- né?
- tipo assim
- então
- sabe?
- acho que
- assim

Do not flag these as errors simply because they are informal.

However, explain when excessive repetition or filler words affect clarity.

### Rule 3: Distinguish Errors from Improvements

There is a difference between something that is grammatically incorrect and something that could simply sound more natural.

Classify corrections into categories:

1. Grammar Error
2. Verb Tense or Conjugation
3. Agreement
4. Preposition or Article
5. Vocabulary
6. Unnatural Expression
7. English Code-Switching
8. Style Improvement
9. Clarity or Sentence Structure

Also assign a correction type:

- `error`: Objectively incorrect or inappropriate in context.
- `improvement`: Grammatically acceptable but a more natural expression exists.
- `optional`: A stylistic alternative, not a necessary correction.

Never present stylistic preferences as mandatory grammatical rules.

### Rule 4: Explain Corrections Thoroughly

For every meaningful correction, explain:

- What the learner originally said.
- What they should say instead.
- Why the original was incorrect or less natural.
- The relevant grammatical rule, when applicable.
- How a native Brazilian speaker would typically express the idea.
- Additional examples when useful.

Explanations should primarily be in English because the learner is an English speaker.

However, Portuguese examples must remain in Portuguese.

### Rule 5: Pay Special Attention to Verb Tenses

Explain distinctions such as:

- Pretérito perfeito vs. pretérito imperfeito.
- Indicative vs. subjunctive.
- Habitual past actions vs. completed past actions.
- Conditional constructions.
- Agreement between subjects and verbs.

For example:

Original:

"Eu achava que as histórias que eles contaram eram falsas."

Improvement:

"Eu achava que as histórias que eles contavam eram falsas."

Explain that "contavam" better communicates a habitual or repeated action in the past.

However, acknowledge that "contaram" could be appropriate in a different context.

### Rule 6: Handle English Words

If the speaker inserts English into Portuguese, suggest a natural Portuguese equivalent.

Example:

Original:

"Minha opinião é muito biased."

Correction:

"Minha opinião é muito tendenciosa."

Alternative:

"Minha opinião acaba sendo influenciada pelo que já sei."

Explain differences in nuance.

Do not assume that every English word is an error if it is a proper noun, title, quotation, or intentional reference.

### Rule 7: Teach New Vocabulary

Identify opportunities to introduce useful vocabulary and expressions.

Focus on vocabulary relevant to the topic the learner is discussing.

For example:

- até certo ponto
- em certa medida
- levar em consideração
- por um lado... por outro...
- seguir as regras à risca
- não podemos descartar a possibilidade de que...

For each suggestion, include:

- Portuguese expression
- English meaning
- Example sentence
- When to use it

### Rule 8: Encourage Sophisticated Argumentation

Help the learner express complex ideas more naturally.

Teach connectors such as:

- embora
- apesar disso
- por outro lado
- além disso
- portanto
- no entanto
- levando isso em consideração
- em contrapartida

Do not force these expressions into every sentence.

Only suggest them when contextually appropriate.

### Rule 9: Provide a Natural Corrected Version

Produce a complete corrected version of the transcription.

The corrected version should:

- Preserve the speaker's voice.
- Preserve their intended meaning.
- Sound natural in Brazilian Portuguese.
- Correct genuine grammatical errors.
- Improve clearly awkward expressions.
- Avoid unnecessary rewriting.
- Retain appropriate informal speech patterns.

### Rule 10: Be Educational, Not Excessively Critical

Prioritize corrections that will meaningfully improve the learner's Portuguese.

Avoid overwhelming the user with trivial stylistic changes.

Do not invent errors.

If a sentence is already natural and correct, leave it alone.

Provide positive feedback only when it is specific and justified.

---

# 8. STRUCTURED AI RESPONSE — VERY IMPORTANT

Do not rely on the AI returning one large, unstructured Markdown response.

Instead, use a structured JSON response that the application can reliably parse.

Use OpenAI's supported structured-output functionality with a defined JSON schema and server-side validation.

The response should contain separate fields for:

1. Original transcription reference
2. Corrected transcription
3. Sentence-level alignment
4. Individual corrections
5. Explanation for each correction
6. Detailed Markdown analysis
7. Vocabulary suggestions
8. Overall feedback
9. Estimated proficiency observations

Suggested conceptual response structure:

```json
{
  "corrected_text": "Os fundadores também tinham razão, né? Mas minha opinião é muito tendenciosa.",

  "segments": [
    {
      "id": "segment_1",
      "original": "Os fundadores também tinha razão, né?",
      "corrected": "Os fundadores também tinham razão, né?",
      "correction_ids": ["correction_1"]
    },
    {
      "id": "segment_2",
      "original": "Mas minha opinião é muito biased.",
      "corrected": "Mas minha opinião é muito tendenciosa.",
      "correction_ids": ["correction_2"]
    }
  ],

  "corrections": [
    {
      "id": "correction_1",
      "segment_id": "segment_1",
      "original": "tinha",
      "replacement": "tinham",
      "category": "Agreement",
      "type": "error",
      "severity": "medium",
      "short_explanation": "The verb must agree with the plural subject.",
      "detailed_explanation": "Because 'os fundadores' is plural, the verb 'ter' must be conjugated as 'tinham' rather than 'tinha'.",
      "examples": [
        {
          "incorrect": "Os alunos tinha dúvidas.",
          "correct": "Os alunos tinham dúvidas."
        }
      ]
    },
    {
      "id": "correction_2",
      "segment_id": "segment_2",
      "original": "biased",
      "replacement": "tendenciosa",
      "category": "English Code-Switching",
      "type": "error",
      "severity": "low",
      "short_explanation": "Use the Portuguese equivalent of 'biased'.",
      "detailed_explanation": "'Tendenciosa' is a natural Portuguese equivalent of 'biased'. It agrees with the feminine noun 'opinião'.",
      "examples": [
        {
          "incorrect": "Minha análise é biased.",
          "correct": "Minha análise é tendenciosa."
        }
      ]
    }
  ],

  "detailed_analysis_markdown": "## Grammar and Agreement\n\n### 1. Tinha vs. Tinham\n\n...",

  "vocabulary": [
    {
      "expression": "até certo ponto",
      "english_meaning": "to a certain extent",
      "example": "Até certo ponto, concordo com essa interpretação.",
      "usage_note": "Useful when expressing partial agreement."
    }
  ],

  "overall_feedback": {
    "strengths": [
      "Successfully communicates complex opinions."
    ],
    "areas_for_improvement": [
      "Subject-verb agreement",
      "Natural vocabulary selection"
    ],
    "estimated_level": "B1-B2",
    "level_disclaimer": "Informal estimate based on this sample, not a formal proficiency assessment."
  }
}
```

This is an illustrative structure, not a complete production JSON schema.

Implement an actual schema with appropriate validation.

### Critical: Correction-to-Text Alignment

Every correction must correspond to a specific location in the original and corrected text.

Do not rely solely on matching the first occurrence of a word.

For example, if the speaker uses "tinha" five times, the application must highlight only the specific occurrence being corrected.

Implement reliable alignment using sentence/segment IDs and character offsets or another deterministic span-mapping strategy.

Recommended approach:

1. Treat the confirmed user transcription as the canonical original text.
2. Split it into aligned segments.
3. Have the AI return the corrected version of each segment.
4. Have the AI identify correction spans within each segment.
5. Validate the spans on the server.
6. Map validated spans to the original and corrected text.
7. Render annotations using the validated mapping.

Offsets should be generated or verified programmatically whenever possible.

Do not blindly trust AI-generated character offsets.

Use exact string validation and deterministic matching.

If a correction cannot be aligned confidently, show it in the explanation panel without applying a potentially incorrect inline highlight.

Ensure that all segments reconstruct the full original and corrected texts without dropping or duplicating content.

---

# 9. ANALYSIS PAGE — CORE USER EXPERIENCE

This is the most important part of the feature.

After the AI analysis completes, navigate the user to:

`/speak/analysis/[id]`

Create a polished, readable, interactive analysis interface.

The design should feel like a combination of:

- A writing correction tool
- A professional language-learning platform
- An AI-powered tutor
- A side-by-side document comparison interface

The interface should make mistakes immediately visible while also allowing the user to understand the reasons behind each correction.

## Desktop Layout

Use a three-panel layout.

### LEFT PANEL — Original Portuguese

Title:

**What You Said**

Display the user's confirmed transcription.

Preserve paragraph breaks.

Highlight mistakes directly inside the text.

For example:

"Os fundadores também ~~tinha~~ razão, né? Mas minha opinião é muito ~~biased~~."

Use visually distinct annotation styles.

Suggested colors:

- Red: Grammatical errors
- Orange: Vocabulary problems
- Purple: Unnatural phrasing
- Blue: Optional improvements

Use accessible colors with sufficient contrast.

Do not rely on color alone.

Include icons, underlines, or labels when necessary.

When hovering over or clicking a highlighted phrase, show a small tooltip containing:

- Original phrase
- Suggested replacement
- Correction category
- Short explanation

Clicking a correction should also select the corresponding explanation in the right panel.

### CENTER PANEL — Corrected Portuguese

Title:

**How to Say It Naturally**

Display the fully corrected transcription.

For example:

"Os fundadores também **tinham** razão, né? Mas minha opinião é muito **tendenciosa**."

Highlight replacements using matching colors or linked annotation markers.

When the user clicks a corrected phrase:

- Highlight the corresponding original phrase.
- Select the matching correction.
- Display its explanation in the right panel.

The original and corrected text should be visually aligned as closely as possible.

Prefer aligned paragraph or sentence rows rather than two independent blocks of text with no relationship.

### RIGHT PANEL — Detailed Explanation

Title:

**Why This Is Better**

Display the explanation associated with the currently selected correction.

For example:

**Correction: tinha → tinham**

**Category:** Subject-verb agreement

**Explanation:**

The subject "os fundadores" is plural.

Therefore, the verb "ter" must also be plural.

- O fundador tinha razão.
- Os fundadores tinham razão.

**Rule:** In standard Portuguese, verbs agree with their subjects in number and person.

**Additional example:**

Incorrect: "Os professores tinha dúvidas."

Correct: "Os professores tinham dúvidas."

Below the explanation, optionally display related vocabulary or grammar notes.

When no correction is selected, show an overview of the analysis.

---

# 10. INTERACTIVE ANNOTATIONS

Annotations should be interactive, not merely colored static text.

## Required Interactions

### Click a Mistake

When the user clicks a highlighted mistake in the original text:

- Highlight the corresponding correction.
- Open the detailed explanation.
- Scroll the explanation panel to the relevant item if necessary.

### Click a Correction

When the user clicks a corrected phrase:

- Highlight the corresponding original text.
- Show the relevant explanation.

### Hover

On desktop, hovering over an annotated phrase should show a concise tooltip.

### Correction Navigation

Include:

- Previous correction
- Next correction
- Correction counter

Example:

**Correction 3 of 12**

### Category Filters

Allow users to filter corrections by category.

For example:

- All Corrections
- Grammar
- Verb Tenses
- Vocabulary
- Naturalness
- Style

Filtering should not remove or alter the underlying original or corrected text.

It should only change which annotations are emphasized.

### Show/Hide Highlights

Allow users to temporarily hide annotations so they can read the corrected Portuguese naturally.

### Copy Corrected Text

Provide a button to copy the corrected transcription.

### Listen to Original Recording

If the session includes audio, provide an audio player.

The user should be able to replay what they actually said while reviewing the transcription.

Do not add text-to-speech unless it is straightforward and does not distract from the primary feature.

---

# 11. DETAILED MARKDOWN BREAKDOWN

In addition to the interactive annotations, provide a complete written analysis.

This can appear below the three-panel comparison or in a dedicated tab within the analysis page.

Suggested tabs:

**Comparison | Detailed Breakdown | Vocabulary | Overall Feedback**

The Detailed Breakdown should contain a comprehensive explanation of the learner's mistakes.

Use Markdown formatting.

Example:

## 1. Verb Agreement

### Original

"Os fundadores também tinha razão."

### Corrected

"Os fundadores também tinham razão."

### Why?

The subject is plural, so the verb must be plural.

### Additional Examples

- Ele tinha razão.
- Eles tinham razão.
- Os fundadores tinham razão.

---

## 2. Vocabulary

### Original

"Minha opinião é muito biased."

### Corrected

"Minha opinião é muito tendenciosa."

### Alternative

"Minha opinião acaba sendo influenciada pelo que já sei."

### Explanation

"Tendenciosa" is a direct equivalent of "biased", while the alternative expresses the idea in a more nuanced way.

---

The actual explanations should be generated dynamically based on the user's transcription.

## Markdown Rendering

Use a safe Markdown rendering solution compatible with the existing Next.js project.

For example, consider:

- `react-markdown`
- `remark-gfm`

Use a safe rendering configuration.

Do not render arbitrary AI-generated HTML.

Do not enable unsafe raw HTML processing.

Support:

- Headings
- Bold
- Italics
- Lists
- Tables
- Blockquotes
- Inline code
- Paragraph spacing

Style Markdown consistently with the application's existing design.

The Markdown should be clean, readable, and well spaced.

Avoid unnecessarily long, repetitive explanations.

---

# 12. VOCABULARY DEVELOPMENT

Create a dedicated Vocabulary section.

The AI should identify useful words and expressions that could improve the learner's Portuguese.

These do not necessarily have to be corrections.

For example, if the learner says:

"Eu acho que os fundadores tinham razão, mas também queriam manter o poder."

The AI might suggest:

**Por um lado... por outro lado...**

Meaning:

"On one hand... on the other hand..."

Example:

"Por um lado, os fundadores queriam proteger a população. Por outro lado, também queriam preservar o próprio poder."

Other possible suggestions:

- até certo ponto
- em certa medida
- levar em consideração
- preservar o poder
- exercer controle sobre
- seguir as regras à risca
- não podemos descartar a possibilidade de que

## Vocabulary Cards

Each vocabulary item should display:

- Portuguese word or expression
- English meaning
- Example sentence in Portuguese
- Usage explanation
- Optional category such as connector, idiom, verb, or adjective

Include a button to copy the expression.

Optionally allow users to save vocabulary items for future review.

Keep vocabulary storage separate from existing shadowing lessons.

---

# 13. OVERALL LANGUAGE FEEDBACK

Create an overall feedback section that summarizes the learner's performance.

Include:

### Strengths

What the learner did well.

### Areas for Improvement

Recurring grammar or vocabulary problems.

### Priority Recommendations

The two or three most important things the learner should practice next.

### Proficiency Estimate

An optional rough estimate such as:

B1 / B1+ / B2

Make clear that this is an informal estimate based on the submitted sample.

Do not present it as an official CEFR assessment.

Do not claim to assess pronunciation, accent, or listening ability based only on a transcription.

### Practice Suggestions

Provide two or three targeted exercises or sentence patterns based on the learner's actual mistakes.

Avoid generic recommendations.

---

# 14. SAVE ANALYSIS SESSIONS

The existing application uses IndexedDB to store shadowing lessons.

The new feature should also support local persistence.

However:

**Do not modify the existing shadowing lesson schema or migration behavior.**

Create a separate object store or separate database for speaking-analysis sessions.

Prefer whichever approach is safest for the existing application.

Each session should save:

- Unique session ID
- Creation timestamp
- Original confirmed transcription
- Corrected transcription
- Structured correction data
- Detailed Markdown analysis
- Vocabulary suggestions
- Overall feedback
- Original audio when available
- Analysis status
- Analysis model identifier when available
- Schema version

## History Page

Create a history page where users can:

- View previous analyses.
- Open a saved analysis.
- Delete an analysis.
- See a short preview of the original transcription.
- See the creation date.

Do not mix speaking-analysis sessions with shadowing lessons.

Saved analyses should reopen without requiring another OpenAI API call.

---

# 15. API ARCHITECTURE

Create new server-side API routes for this feature.

Suggested endpoints:

`POST /api/speak/transcribe`

Receives an audio file and returns its transcription.

`POST /api/speak/analyze`

Receives the confirmed transcription and returns structured AI feedback.

Keep these endpoints separate from the existing shadowing transcription route.

## Security Requirements

- Use the existing server-side `OPENAI_API_KEY` environment variable.
- Never expose the API key to the browser.
- Validate incoming requests.
- Validate file sizes and supported formats.
- Enforce reasonable text length limits.
- Handle API failures gracefully.
- Use timeouts and appropriate error handling.
- Avoid logging private audio or full transcripts unnecessarily.
- Treat the transcription as untrusted user content, not as system instructions.
- Use server-side schema validation for AI responses.

Use the project's existing conventions wherever possible.

Do not introduce a new authentication system unless the existing application already requires one.

---

# 16. LOADING AND ERROR STATES

The feature should provide clear progress indicators.

Suggested states:

**Step 1: Preparing Audio**

The user records or uploads audio.

**Step 2: Transcribing**

Display:

"Transcribing your Portuguese..."

**Step 3: Review Transcription**

The user verifies the transcription.

**Step 4: Analyzing**

Display:

"Analyzing your Portuguese..."

**Step 5: Complete**

Navigate to the analysis page.

## Error Handling

Handle:

- Microphone permission denied
- Unsupported recording browser
- Unsupported audio format
- Audio file too large
- Empty transcription
- Network errors
- OpenAI API errors
- Invalid structured response
- Failed annotation alignment
- IndexedDB storage failures
- Interrupted requests

Allow users to retry failed operations without rerecording or retranscribing unnecessarily.

If analysis fails, preserve the confirmed transcription.

If storage fails, show an actionable error rather than silently losing the result.

---

# 17. RESPONSIVE DESIGN

The application should work on desktop, tablet, and mobile.

## Desktop

Use the three-panel comparison interface.

## Tablet

Consider two comparison panels with an expandable explanation section.

## Mobile

Do not attempt to squeeze three narrow columns onto the screen.

Instead, use a mobile-friendly layout with tabs:

- Original
- Corrected
- Explanation

When the user selects a correction, allow