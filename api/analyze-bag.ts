import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are the AI Visual Inspection Assistant for Cyan's Brooklynn Recycling Enterprise.
Your job is to analyze uploaded recycling bag images from warehouse workers and determine the contamination level and recyclability of the bag contents.
You must inspect the image carefully and identify:
1. Visible recyclable materials (plastic bottles, aluminum cans, cardboard, paper, glass containers)
2. Contamination indicators (food residue, liquids, biohazards, trash, organic waste, hazardous materials, excessive dirt or mold, mixed non-recyclables)
3. Bag condition (torn bag, leaking bag, overfilled bag, properly sealed bag)
4. Estimated quality rating — return ONE of: CLEAN, NEEDS_REVIEW, CONTAMINATED

Decision Rules:
CLEAN: Mostly recyclable materials, minimal contamination, safe for processing, no hazardous waste visible.
NEEDS_REVIEW: Some contamination visible, unclear contents, requires human verification, mixed recyclables/non-recyclables.
CONTAMINATED: Heavy trash contamination, food/liquid saturation, biohazard risk, hazardous materials present, unsafe for recycling stream.

Return JSON ONLY in this exact format:
{"result":"CLEAN","confidence":92,"estimated_recyclables":["plastic bottles","aluminum cans"],"contamination_detected":["minor food residue"],"bag_condition":"sealed","notes":"Bag appears mostly recyclable with minor contamination."}

Important: Do not invent materials not visible in the image. Confidence must be 0-100. Be conservative when contamination is unclear. Prioritize warehouse safety. If image quality is poor, return NEEDS_REVIEW. Never output markdown. Never explain outside the JSON response.`

export default async function handler(req: any, res: any) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Key must be set in Vercel environment variables (not VITE_ prefix)
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key not configured on server. Add OPENAI_API_KEY to Vercel environment variables.' })
  }

  const { imageBase64, imageUrl } = req.body ?? {}
  const imageData: string | undefined = imageBase64 ?? imageUrl

  if (!imageData) {
    return res.status(400).json({ error: 'imageBase64 or imageUrl is required' })
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 512,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageData, detail: 'low' } },
          ],
        },
      ],
    })

    const text = (completion.choices[0]?.message?.content ?? '').trim()

    // Strip accidental markdown code fences if model wraps output
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    const parsed = JSON.parse(clean)
    return res.status(200).json(parsed)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const isJsonError = msg.toLowerCase().includes('json') || msg.toLowerCase().includes('parse')
    return res.status(500).json({
      error: isJsonError
        ? 'AI returned unexpected format — try retaking the photo.'
        : msg,
    })
  }
}
