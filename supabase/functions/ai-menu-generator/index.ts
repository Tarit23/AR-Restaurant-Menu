// =====================================================
// AI MENU GENERATOR EDGE FUNCTION
// supabase/functions/ai-menu-generator/index.ts
// Uses Gemini 2.0 Flash to parse PDF/Image/Text menus
// =====================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY secret is not set in Supabase project.')
    }

    // Parse input body
    const body = await req.json()
    const { fileBase64, mimeType, rawText } = body

    if (!fileBase64 && !rawText) {
      throw new Error('Missing input data. Provide either fileBase64 or rawText.')
    }

    let contents = []
    const systemPrompt = `You are an expert restaurant consultant and menu data parser. 
Analyze the provided menu data (which could be an image, PDF, or raw text transcript).
Extract all menu categories, dishes, prices, descriptions, ingredients, and estimated calories.
Clean up typographical errors, expand shorthand terms, and translate if needed.
Format the output as a strict JSON object with a single key "items", containing a list of parsed dishes.

JSON Schema:
{
  "items": [
    {
      "name": "String (Name of the dish)",
      "price": Number (Price in INR, e.g. 299 or 450.50. If price is missing, estimate a reasonable default based on similar items, or use 150)",
      "category": "String (E.g. Starters, Mains, Desserts, Beverages. Clean up and unify categories)",
      "description": "String (Engaging 1-2 sentence description. If missing, write a mouth-watering description)",
      "ingredients": "String (Comma-separated key ingredients, e.g. 'Wheat flour, Paneer, Butter, Green chilies')",
      "calories": Number (Estimated calorie count as integer, e.g. 350. Estimate logically if not specified)"
    }
  ]
}

Return ONLY the raw JSON output. Do not wrap in markdown or add notes.`

    if (rawText) {
      contents = [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: `Here is the menu text data:\n\n${rawText}` }
          ]
        }
      ]
    } else {
      contents = [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: fileBase64
              }
            }
          ]
        }
      ]
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API Error: ${res.status} - ${errText}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()

    if (!text) {
      throw new Error('Gemini API returned an empty response.')
    }

    // Parse text to verify it is valid JSON
    let parsedData
    try {
      parsedData = JSON.parse(text)
    } catch (jsonErr) {
      console.warn('Gemini response was not valid JSON, raw text was:', text)
      // Attempt to extract JSON from markdown wraps
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        parsedData = JSON.parse(match[0])
      } else {
        throw new Error('Failed to parse Gemini response as JSON: ' + jsonErr.message)
      }
    }

    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('AI Menu parsing failed:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
