export class GeminiService {
  private apiKey: string | undefined;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = 'gemini-2.5-flash';
  }

  public isEnabled(): boolean {
    const key = process.env.GEMINI_API_KEY || this.apiKey;
    return !!key && key.trim().length > 10;
  }

  /**
   * Use Google Gemini to extract destination, origin, dates, and guests
   */
  async extractTravelEntities(userInput: string): Promise<{
    destination?: string;
    origin?: string;
    startDate?: string;
    endDate?: string;
    guests?: number;
  }> {
    if (!this.isEnabled()) return {};

    try {
      const apiKey = process.env.GEMINI_API_KEY || this.apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an AI Travel Assistant entity extractor. Extract the travel details from this user query: "${userInput}".
Return valid JSON ONLY matching this format:
{
  "destination": "Destination City",
  "origin": "Origin City or null",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "guests": 2
}`
                }
              ]
            }
          ],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(cleanText);
        }
      } else {
        const errData: any = await response.json().catch(() => ({}));
        console.warn('[Gemini Service] Error response:', errData);
      }
    } catch (err) {
      console.warn('[Gemini Service] Network error:', err);
    }

    return {};
  }

  /**
   * Generate dynamic conversational travel commentary via Gemini
   */
  async generateAssistantResponse(step: string, context: any, defaultMessage: string): Promise<string> {
    if (!this.isEnabled()) return defaultMessage;

    try {
      const apiKey = process.env.GEMINI_API_KEY || this.apiKey;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are SkyVoyage AI, a luxury conversational travel concierge.
Give a friendly, concise, welcoming response introducing these travel options (keep under 3 sentences).
Use bold markdown for key names and places.
Current booking step: ${step}
Context data: ${JSON.stringify(context)}`
                }
              ]
            }
          ]
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return text;
        }
      }
    } catch (err) {
      console.warn('[Gemini Service] Dynamic commentary error:', err);
    }

    return defaultMessage;
  }
}

export const geminiService = new GeminiService();
