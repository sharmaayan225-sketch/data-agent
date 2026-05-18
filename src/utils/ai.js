// src/utils/ai.js
// Uses Groq API — completely free, no credit card needed
// Get your key at: console.groq.com → API Keys → Create Key

export async function callAI({ system, user, maxTokens = 4000 }) {
  const apiKey = import.meta.env.VITE_GROQ_KEY

  if (!apiKey || apiKey.includes('your_actual')) {
    throw new Error('Groq API key not set. Open .env and paste your key from console.groq.com')
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user }
      ]
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`Groq API error ${response.status}: ${err.error?.message || 'Unknown'}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export function safeParseJSON(str) {
  if (!str) return null
  try {
    const cleaned = str.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    return JSON.parse(cleaned)
  } catch { return null }
}
