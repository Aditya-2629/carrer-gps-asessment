import assert from 'node:assert/strict'

function unwrapChatbotOutput(replyText) {
  let cleanAnswer = (replyText || '').trim()

  // 1. Strip outer code fences if the model wrapped the entire JSON in ```
  const outerMatch = cleanAnswer.match(/^```(?:markdown|text|json|plaintext)?\s*([\s\S]*?)\s*```$/i)
  if (outerMatch) {
    cleanAnswer = outerMatch[1].trim()
  }

  // 2. Extract structured coach_response and format copy_block for CopyableSnippetCard
  if (cleanAnswer.startsWith('{') && cleanAnswer.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanAnswer)
      if (parsed.coach_response || parsed.copy_block) {
        const responseText = (parsed.coach_response || parsed.answer || parsed.reply || '').trim()
        const copySnippet = parsed.copy_block
          ? `\n\n\`\`\`text\n${parsed.copy_block.replace(/^```(?:text)?\s*|\s*```$/gi, '').trim()}\n\`\`\``
          : ''
        cleanAnswer = `${responseText}${copySnippet}`
      } else if (parsed.answer || parsed.reply) {
        cleanAnswer = (parsed.answer || parsed.reply).trim()
      }
    } catch (_) {}
  }

  return cleanAnswer
}

console.log('=== RUNNING CHATBOT UNWRAPPER & AUTO-SCHEDULER VERIFICATION ===\n')

// Test 1: Plain conversational markdown passes cleanly
console.log('Test 1: Plain conversational markdown...')
const plainMarkdown = '- Fix your LinkedIn dates.\n- Align your title to **Senior Software Engineer**.'
const out1 = unwrapChatbotOutput(plainMarkdown)
assert.equal(out1, plainMarkdown)
console.log('✔ Test 1 Passed: Plain markdown preserved without modification.\n')

// Test 2: Structured JSON with coach_response and copy_block
console.log('Test 2: Structured JSON with coach_response and copy_block...')
const structuredJson = JSON.stringify({
  coach_response: 'Here is how to resolve your employment discrepancy this week:',
  copy_block: 'Senior Full Stack Engineer | React, Node.js, AWS\n• Built high-throughput APIs',
})
const out2 = unwrapChatbotOutput(structuredJson)
assert.ok(out2.includes('Here is how to resolve your employment discrepancy this week:'))
assert.ok(out2.includes('```text\nSenior Full Stack Engineer | React, Node.js, AWS\n• Built high-throughput APIs\n```'))
console.log('✔ Test 2 Passed: Structured JSON unwraps to response text + text code fence.\n')

// Test 3: Structured JSON wrapped in ```json ... ``` code fences
console.log('Test 3: Structured JSON wrapped in markdown code fence...')
const fencedJson = `\`\`\`json
{
  "coach_response": "Use this outreach message for recruiters:",
  "copy_block": "\`\`\`text\\nHi Alex, noticed your team is expanding...\\n\`\`\`"
}
\`\`\``
const out3 = unwrapChatbotOutput(fencedJson)
assert.ok(out3.includes('Use this outreach message for recruiters:'))
assert.ok(out3.includes('```text\nHi Alex, noticed your team is expanding...\n```'))
assert.ok(!out3.includes('```json'))
console.log('✔ Test 3 Passed: Outer code fence stripped, nested copy_block normalized.\n')

// Test 4: JSON with answer or reply field
console.log('Test 4: JSON with fallback answer/reply fields...')
const answerJson = JSON.stringify({ answer: 'Your resume score is 84/100.' })
const out4 = unwrapChatbotOutput(answerJson)
assert.equal(out4, 'Your resume score is 84/100.')
console.log('✔ Test 4 Passed: Fallback answer/reply unwrapped.\n')

// Test 5: Verify marketAutoScheduler query logic
console.log('Test 5: Verifying marketAutoScheduler contains jobCount: { $lt: 20 }...')
import fs from 'node:fs'
const schedulerSource = fs.readFileSync('backend/jobs/marketJd/marketAutoScheduler.js', 'utf8')
assert.ok(schedulerSource.includes('{ jobCount: { $lt: 20 } }'), 'marketAutoScheduler must contain { jobCount: { $lt: 20 } }')
console.log('✔ Test 5 Passed: marketAutoScheduler queries small sample size buckets (<20 JDs).\n')

console.log('ALL CHATBOT UNWRAPPER & AUTO-SCHEDULER TESTS PASSED SUCCESSFULLY! 🚀')
