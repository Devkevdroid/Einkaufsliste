// Edge Function "import-recipe": lädt eine HelloFresh-Rezeptseite und liefert das Rezept als JSON.
// Nötig, weil der Browser HelloFresh wegen CORS nicht direkt abrufen darf.
// Nur für angemeldete Nutzer und nur für HelloFresh-Adressen (kein offener Proxy).

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import { parseRecipePage, RecipeParseError } from './parse.ts'

const ALLOWED_HOST = /^(www\.)?hellofresh\.(de|at|ch|com|nl|be|lu|fr|it|dk|se|no|es|ie|co\.uk|com\.au|ca|co\.nz)$/

function error(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    if (req.method !== 'POST') return error('Nur POST erlaubt.', 405)

    let input: unknown
    try {
      input = (await req.json())?.url
    } catch {
      return error('Ungültige Anfrage.', 400)
    }
    const match = typeof input === 'string' ? input.match(/https?:\/\/\S+/) : null
    if (!match) return error('Bitte einen Link zu einem HelloFresh-Rezept einfügen.', 400)

    let url: URL
    try {
      url = new URL(match[0])
    } catch {
      return error('Das ist kein gültiger Link.', 400)
    }
    if (!ALLOWED_HOST.test(url.hostname)) {
      return error('Im Moment werden nur Rezepte von HelloFresh unterstützt.', 400)
    }

    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
          'accept-language': 'de-DE,de;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      return error('HelloFresh ist gerade nicht erreichbar. Bitte später erneut versuchen.', 502)
    }
    if (!ALLOWED_HOST.test(new URL(response.url).hostname)) {
      return error('Der Link leitet auf eine andere Seite weiter.', 400)
    }
    if (response.status === 404) return error('Dieses Rezept gibt es bei HelloFresh nicht (mehr).', 404)
    if (!response.ok) return error(`HelloFresh antwortet mit Fehler ${response.status}.`, 502)

    try {
      const recipe = parseRecipePage(await response.text(), url.toString())
      return Response.json({ recipe })
    } catch (e) {
      if (e instanceof RecipeParseError) return error(e.message, 422)
      console.error(e)
      return error('Das Rezept konnte nicht gelesen werden.', 500)
    }
  }),
}
