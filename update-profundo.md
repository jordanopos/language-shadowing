# UPDATE: Improve the Quality and Depth of AI Portuguese Corrections

## IMPORTANT: This Is an Update to the Existing Speak & Improve Feature

The Speak & Improve feature is already implemented.

Do not rebuild it.

Do not modify the original Shadowing feature.

Do not redesign the existing interface or change the recording, transcription, storage, or navigation workflows unless absolutely necessary.

**This update focuses specifically on improving the quality, depth, and sophistication of the AI's Portuguese corrections and explanations.**

The current AI correction system is too conservative.

It primarily fixes obvious grammatical mistakes, translates English words into Portuguese, and makes small adjustments.

However, I want the AI to behave more like an experienced native Brazilian Portuguese tutor who understands context, nuance, idiomatic expressions, and the speaker's intended meaning.

The goal is not merely to produce grammatically correct Portuguese.

**The goal is to teach the learner how to express their original ideas naturally, precisely, and fluently in Brazilian Portuguese.**

---

# 1. THE MAIN PROBLEM

Consider this example.

Original:

"Eu acho que os fundadores também tinham razão."

Current AI correction:

"Eu acho que os fundadores também tinham razão."

Technically, this sentence is grammatically correct.

However, consider the surrounding context.

The speaker is discussing whether the founders of a fictional society had legitimate reasons for establishing restrictive rules.

They are not necessarily claiming that the founders were correct.

A more nuanced expression might be:

"Eu acho que os fundadores também tinham seus motivos."

This distinction is extremely valuable for language learning.

The AI should recognize opportunities like this.

It should explain:

"Ter razão" means to be right or correct.

"Ter seus motivos" means to have reasons for acting in a certain way, without necessarily implying that those actions were justified.

In this context, "tinham seus motivos" may better express the speaker's uncertainty about whether the founders were justified.

**This is the level of analysis I want throughout the entire transcription.**

However, the AI must not assume that the learner intended the more nuanced meaning. It should distinguish between a correction and a possible alternative interpretation.

---

# 2. IMPLEMENT THREE LEVELS OF CORRECTION

The AI must analyze the transcript at three distinct levels.

## LEVEL 1: GRAMMATICAL CORRECTIONS

Correct genuine language errors.

Examples:

Original:
"Os fundadores tinha razão."

Corrected:
"Os fundadores tinham razão."

Explanation:
The subject "os fundadores" is plural, so the verb must be conjugated in the plural.

Other examples include:

- Incorrect verb conjugations
- Incorrect verb tenses
- Gender agreement
- Number agreement
- Incorrect articles
- Incorrect prepositions
- Incorrect sentence structure

These are genuine grammatical corrections.

Label them:

`grammar_error`

## LEVEL 2: NATURALNESS AND IDIOMATIC PORTUGUESE

Identify sentences that are grammatically acceptable or understandable but sound unnatural, overly literal, repetitive, or awkward to a native Brazilian Portuguese speaker.

Example:

Original:
"Eles seguiam as regras estritamente, muito estritamente."

Improved:
"Eles seguiam as regras rigorosamente."

Alternative:
"Eles seguiam as regras à risca."

Explanation:
"Rigorosamente" is a natural adverb in this context.

"Seguir as regras à risca" is an idiomatic expression meaning to follow the rules exactly.

Another example:

Original:
"Esse controle de conhecimento era uma farsa."

Improved:
"Esse controle da informação era uma farsa."

Explanation:
"Controle da informação" is a more established and natural expression when discussing censorship, propaganda, or institutional restrictions on access to information.

Label these:

`naturalness_improvement`

These suggestions should be actively identified even when the original sentence is technically understandable.

## LEVEL 3: NUANCE, PRECISION, AND NATIVE-LEVEL EXPRESSION

This is the most important improvement.

The AI should examine what the speaker is trying to communicate and suggest expressions that capture the intended meaning more precisely.

Example:

Original:
"Os fundadores também tinham razão."

Suggested alternative:
"Os fundadores também tinham seus motivos."

Explanation:
"Tinham razão" suggests that the founders were correct.

"Tinham seus motivos" acknowledges that they may have had reasons for their actions without necessarily agreeing with those actions.

This distinction is useful when expressing uncertainty or considering multiple perspectives.

Another example:

Original:
"Eu achava que era a verdade também."

Improved:
"Eu também achava que havia alguma verdade por trás daquilo tudo."

Explanation:
"Havia alguma verdade por trás daquilo tudo" communicates that the speaker suspected that at least part of the official narrative might be true.

It expresses partial belief rather than complete acceptance.

This is especially appropriate when the speaker is discussing conflicting interpretations.

Label these:

`nuance_improvement`

**IMPORTANT:** Level 3 suggestions are optional improvements, not objective corrections.

If the intended meaning is uncertain, explicitly explain how the suggested expression changes the nuance.

Do not silently replace the learner's opinion with an interpretation invented by the AI.

---

# 3. CHANGE HOW THE AI APPROACHES THE TRANSCRIPTION

The AI should not analyze sentences in isolation.

Before making corrections, it must understand the entire transcription.

It should internally consider:

1. What topic is the speaker discussing?
2. What argument is the speaker making?
3. What opinions are they expressing?
4. Where are they expressing uncertainty?
5. Where are they expressing agreement or disagreement?
6. Are they contrasting two different ideas?
7. Are they describing habitual past actions or completed events?
8. Are they using expressions translated literally from English?
9. Could a more idiomatic Brazilian Portuguese expression communicate the same idea?
10. Are there subtle differences in meaning that would help the learner express themselves more precisely?

Use this understanding to guide the corrections.

For example:

Original:

"Mas eu acho que foi uma mistura entre os dois, controle de poder e para protegê-los."

Basic correction:

"Mas eu acho que foi uma mistura dos dois: controle do poder e proteção."

Better correction:

"No fim das contas, acho que era uma mistura das duas coisas: tanto uma forma de manter o poder quanto uma maneira de proteger os habitantes."

Why this is better:

- "No fim das contas" creates a natural transition to a conclusion.
- "Uma mistura das duas coisas" is more natural in this context.
- "Tanto... quanto..." clearly connects the two competing explanations.
- "Uma forma de manter o poder" is more idiomatic.
- "Uma maneira de proteger os habitantes" makes the second idea clearer.

The AI should recognize these opportunities throughout the transcript.

---

# 4. GENERATE TWO DIFFERENT CORRECTED VERSIONS

Instead of generating only one corrected transcription, generate TWO.

## Version A: Minimal Corrections

This version should:

- Correct genuine grammatical errors.
- Correct clear vocabulary mistakes.
- Fix incorrect verb conjugations.
- Preserve the original sentence structure whenever possible.
- Preserve the speaker's conversational style.
- Avoid unnecessary rewriting.

Example:

Original:
"Os fundadores também tinha razão."

Minimal correction:
"Os fundadores também tinham razão."

## Version B: Natural Native Brazilian Portuguese

This version should:

- Include all necessary grammatical corrections.
- Improve unnatural expressions.
- Replace awkward literal translations.
- Improve sentence flow.
- Use more idiomatic Brazilian Portuguese.
- Suggest contextually appropriate vocabulary.
- Improve clarity and precision.
- Preserve the speaker's personality and conversational tone.
- Preserve the speaker's intended arguments and opinions.
- Avoid unnecessarily formal or academic language.

Example:

Original:
"Eu acho que os fundadores também tinha razão."

Natural version:
"Eu acho que os fundadores também tinham seus motivos."

This more nuanced version is appropriate only if the surrounding context supports that interpretation.

If the intended meaning is ambiguous, keep "tinham razão" in the main natural version and present "tinham seus motivos" as an optional alternative.

### IMPORTANT UI REQUIREMENT

Allow the user to switch between:

**Minimal Corrections**

and

**Natural Brazilian Portuguese**

The Natural Brazilian Portuguese version should be the default.

Both versions should remain available for comparison.

Do not remove the existing side-by-side comparison interface.

Extend it to support both versions.

---

# 5. ANNOTATE ALL THREE LEVELS OF IMPROVEMENT

The existing application already supports correction annotations.

Extend the annotation system to support:

- Grammar errors
- Naturalness improvements
- Nuance improvements

Suggested visual categories:

**Red:** Grammar error

**Orange:** Unnatural expression

**Purple:** Nuance or precision improvement

Use the application's existing annotation architecture whenever possible.

Do not replace working annotation functionality unnecessarily.

Every annotation must link to:

- The original expression.
- The suggested replacement.
- The correction category.
- A short explanation.
- A detailed explanation.
- An optional alternative expression.
- Examples when appropriate.

For example:

Original:
"tinham razão"

Suggested:
"tinham seus motivos"

Category:
Nuance Improvement

Explanation:
Both expressions are grammatically correct, but they communicate slightly different meanings.

"Ter razão" suggests that someone is right.

"Ter seus motivos" suggests that someone has reasons for acting in a certain way, without necessarily implying that their actions were correct.

In this discussion, the second expression may better communicate uncertainty about the founders' motivations.

This should appear as an optional improvement, not a mandatory correction.

---

# 6. IMPROVE THE DEPTH OF EXPLANATIONS

The existing explanations should become more educational.

For every significant correction or improvement, explain:

1. What the speaker originally said.
2. What a more natural expression would be.
3. Whether the original is actually incorrect.
4. Why the new expression is preferable in this context.
5. What difference in meaning or tone exists.
6. When the original expression would be appropriate.
7. One or two additional examples when useful.

For example:

### Original

"As histórias que eles contaram eram falsas."

### Suggested

"As histórias que eles contavam eram falsas."

### Explanation

Both "contaram" and "contavam" are grammatically valid.

However, they emphasize different aspects of the past.

"Contaram" uses the pretérito perfeito and presents the action as completed.

"Contavam" uses the pretérito imperfeito and can describe a repeated or habitual action in the past.

Because the speaker is discussing narratives that the authorities repeatedly communicated to the population, "contavam" is more appropriate.

### Examples

"Ontem, eles contaram uma história."

Yesterday, they told a story.

"Quando eu era criança, meus avós contavam histórias."

When I was a child, my grandparents used to tell stories.

### Key Takeaway

Use the pretérito imperfeito when describing repeated or habitual actions in the past.

This level of explanation should be the standard for meaningful corrections.

Do not generate lengthy explanations for trivial punctuation changes.

---

# 7. BE MORE PROACTIVE ABOUT VOCABULARY

The AI should actively identify opportunities to introduce natural Brazilian Portuguese expressions.

Do not limit vocabulary suggestions to words that were objectively incorrect.

For example:

Original:
"Eu acho que foi uma mistura dos dois."

Possible improvement:
"No fim das contas, acho que era uma mistura das duas coisas."

Useful expression:
"No fim das contas"

Meaning:
"At the end of the day / ultimately"

Another example:

Original:
"Eles seguiam as regras muito estritamente."

Improvement:
"Eles seguiam as regras à risca."

Useful expression:
"Seguir à risca"

Meaning:
"To follow something to the letter"

Another example:

Original:
"Eu acho que eles tinham razão, mas também queriam controlar as pessoas."

Possible improvement:
"Por um lado, eles tinham seus motivos. Por outro, também queriam manter o controle sobre a população."

Useful expression:
"Por um lado... por outro..."

Meaning:
"On one hand... on the other hand..."

Focus on vocabulary that the learner can realistically reuse in future conversations.

Do not introduce obscure or unnecessarily formal vocabulary.

---

# 8. IMPROVE COHESION AND FLOW

Analyze how sentences connect to one another.

The AI should identify opportunities to improve:

- Transitions
- Logical connections
- Repetition
- Argument structure
- Clarity
- Natural conversational rhythm

For example:

Original:

"Mas eu acho que foi uma mistura entre os dois. Controle de poder e para protegê-los."

Improved:

"No fim das contas, acho que era uma mistura das duas coisas: tanto uma forma de manter o poder quanto uma maneira de proteger os habitantes."

Explain why the improved version flows better.

However, do not automatically remove all repetitions, pauses, or informal expressions.

The user is practicing spoken Portuguese, not writing an academic essay.

---

# 9. DO NOT CONFUSE BETTER WRITING WITH BETTER SPEAKING

This is a speaking-practice application.

The natural version should sound like something an educated native Brazilian Portuguese speaker would actually say in conversation.

Avoid:

- Excessively formal constructions.
- Academic vocabulary when simple words are more natural.
- Removing every "né?"
- Removing every "acho que"
- Replacing natural speech with written prose.
- Overly elaborate sentences that would be difficult to produce spontaneously.

The goal is natural, fluent speech.

Not formal writing.

For example:

Original:
"Eu acho que eles queriam manter o poder, né?"

Do not unnecessarily replace it with:

"Considero plausível que as autoridades almejassem a perpetuação de sua hegemonia institucional."

A natural version might simply remain:

"Eu acho que eles queriam continuar no poder, né?"

---

# 10. UPDATE THE STRUCTURED AI RESPONSE

Maintain the existing structured JSON architecture.

Extend it to support the new correction levels.

Add fields where necessary for:

- `minimal_corrected_text`
- `natural_corrected_text`
- `grammar_corrections`
- `naturalness_improvements`
- `nuance_improvements`
- `alternative_expressions`
- `meaning_difference`
- `is_required_correction`
- `contextual_explanation`

These field names are suggestions.

Adapt them to the existing schema rather than unnecessarily replacing the entire response format.

Ensure all annotations remain correctly aligned with their corresponding text.

Because the application will now support two corrected versions, each annotation must clearly identify which version it belongs to.

Do not assume that offsets or spans from the minimal version will also be valid in the natural version.

Validate alignment independently for each version.

If an annotation cannot be aligned reliably, display it in the explanation panel rather than highlighting an incorrect text span.

---

# 11. QUALITY CONTROL REQUIREMENTS

Before returning the AI response, ensure that:

- All genuine grammatical errors have been corrected.
- Obvious literal translations have been identified.
- Awkward but understandable expressions have been considered.
- Opportunities for more idiomatic vocabulary have been identified.
- Important differences in nuance have been explained.
- The learner's intended meaning has been preserved.
- Optional improvements are not presented as mandatory corrections.
- The natural version sounds like authentic conversational Brazilian Portuguese.
- The minimal version stays close to the original transcription.
- Explanations are specific to the surrounding context.
- The AI has not invented mistakes.
- The AI has not introduced opinions that the speaker did not express.

Do not impose an arbitrary maximum of three or five corrections.

If the transcription contains fifteen meaningful opportunities for improvement, identify them.

However, avoid generating multiple redundant annotations for the same underlying issue.

Prioritize meaningful learning opportunities over sheer correction quantity.

---

# 12. EXAMPLE OF THE EXPECTED IMPROVEMENT

### ORIGINAL TRANSCRIPTION

"Inicialmente eu achava que esse controle de conhecimento foi uma farsa, né? Porque as histórias que eles contaram, achava que eram falsas. Mas to a certain degree, eu achava que era a verdade também. Os fundadores também tinha razão, né? Mas eu acho que foi uma mistura entre os dois, controle de poder e para protegê-los. Minha opinião é muito biased."

### MINIMAL CORRECTIONS

"Inicialmente, eu achava que esse controle de conhecimento era uma farsa, né? Porque eu achava que as histórias que eles contaram eram falsas. Mas, até certo ponto, eu achava que era verdade também. Os fundadores também tinham razão, né? Mas eu acho que foi uma mistura dos dois: controle do poder e proteção dos habitantes. Minha opinião é muito tendenciosa."

### NATURAL BRAZILIAN PORTUGUESE

"Inicialmente, eu achava que esse controle da informação era uma farsa, né? Porque eu achava que as histórias que eles contavam eram falsas.

Mas, até certo ponto, eu também achava que havia alguma verdade por trás daquilo tudo.

Então, eu achava que os fundadores também tinham seus motivos para criar aquelas regras.

No fim das contas, acho que era uma mistura das duas coisas: tanto uma forma de manter o poder quanto uma maneira de proteger os habitantes.

Mas acho que minha opinião é um pouco tendenciosa."

The natural version demonstrates the desired quality of contextual rewriting.

However, when the original meaning is ambiguous, the application should identify potentially meaning-changing alternatives rather than silently substituting them.

### EXAMPLE ANNOTATIONS

**Correction 1**

Original: "controle de conhecimento"

Replacement: "controle da informação"

Category: Naturalness

Explanation: "Controle da informação" is more idiomatic when discussing censorship and restrictions on what a population is allowed to know.

**Correction 2**

Original: "foi uma farsa"

Replacement: "era uma farsa"

Category: Verb Tense

Explanation: "Era" better describes an ongoing belief held in the past.

**Correction 3**

Original: "contaram"

Replacement: "contavam"

Category: Verb Tense / Contextual Improvement

Explanation: "Contavam" better expresses repeated narratives communicated by the authorities.

**Correction 4**

Original: "era a verdade também"

Replacement: "havia alguma verdade por trás daquilo tudo"

Category: Nuance

Explanation: The new expression communicates partial belief rather than complete acceptance.

**Correction 5**

Original: "tinham razão"

Alternative: "tinham seus motivos"

Category: Nuance

Explanation: "Ter razão" means being right. "Ter seus motivos" means having reasons for one's actions without necessarily being right.

**Correction 6**

Original: "uma mistura entre os dois"

Replacement: "uma mistura das duas coisas"

Category: Naturalness

Explanation: The replacement sounds more natural when referring back to two competing explanations.

**Correction 7**

Original: "controle de poder e para protegê-los"

Replacement: "tanto uma forma de manter o poder quanto uma maneira de proteger os habitantes"

Category: Clarity and Sentence Structure

Explanation: The parallel construction "tanto... quanto..." makes the two ideas easier to understand.

---

# 13. IMPLEMENTATION REQUIREMENTS

This is an enhancement to an existing feature.

Do not rebuild the application.

Do not change the original Shadowing functionality.

Preserve:

- Existing audio recording.
- Existing audio uploads.
- Existing Whisper transcription.
- Existing editable transcription.
- Existing analysis history.
- Existing IndexedDB storage behavior.
- Existing navigation.
- Existing annotation interactions.
- Existing Markdown rendering.

Only modify the components, prompts, response schemas, and analysis logic necessary to support the improved correction quality.

Maintain compatibility with previously saved analyses.

If the response schema changes, handle older saved analyses gracefully.

Do not require users to regenerate their previous analyses.

Test the updated annotation system with both minimal and natural corrected versions.

---

# 14. FINAL GOAL

I do not want an AI that simply checks whether my Portuguese is grammatically correct.

I want an AI that teaches me to think and express myself more naturally in Brazilian Portuguese.

It should understand what I am trying to communicate and help me find the words, expressions, sentence structures, and grammatical constructions that a native speaker would naturally use.

It should catch the small things that basic grammar correction misses.

For example:

"Tinham razão" versus "tinham seus motivos."

"Controle de conhecimento" versus "controle da informação."

"Estritamente" versus "rigorosamente" or "à risca."

"Era a verdade também" versus "havia alguma verdade por trás daquilo tudo."

These distinctions are central to the learning experience.

**The Natural Brazilian Portuguese version should be the default and should receive the same level of attention as the grammatical corrections.**

The result should feel like receiving thoughtful, contextual feedback from a highly skilled native Brazilian Portuguese tutor, not merely running a grammar checker.

Implement this improvement without breaking or unnecessarily modifying any existing application functionality.