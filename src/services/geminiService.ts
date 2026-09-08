export class GeminiService {
  private apiKey: string | undefined;
  private model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = 'gemini-2.5-flash';
  }

  public isEnabled(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.trim().length > 10 && !key.includes('xxxx');
  }

  public hasApiKey(): boolean {
    return this.isEnabled();
  }

  public getMissingKeyReply(): string {
    return `⚠️ **Google Gemini API Key Not Configured**\n\nTo ask questions and receive dynamic AI answers powered by the Gemini model, please add your **GEMINI_API_KEY** in the **API section** of the **[Admin Panel](/admin.html)**, or contact your system administrator.\n\n*(In the meantime, you can continue booking flights, hotels, and cabs using our automated system!)*`;
  }

  public getMissingKeyCard(): any {
    return {
      type: 'error' as const,
      data: {
        title: 'Gemini AI API Key Required',
        provider: 'Google Gemini 2.5 Flash',
        message: 'To answer custom questions and provide AI conversational intelligence, please add your Gemini API Key in the API section of the Admin Panel or contact the administrator.',
        missingKey: 'GEMINI_API_KEY',
        actionLabel: 'Open Admin Panel API Section',
        actionUrl: '/admin.html'
      }
    };
  }

  /**
   * Answer traveler's custom question using Gemini, or instruct them to add the API key in the Admin Panel / contact admin
   */
  async answerUserQuestion(question: string, context?: any): Promise<{
    reply: string;
    hasKey: boolean;
    errorCard?: any;
  }> {
    if (!this.isEnabled()) {
      return {
        reply: this.getMissingKeyReply(),
        hasKey: false,
        errorCard: this.getMissingKeyCard()
      };
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY || this.apiKey;
      const model = process.env.GEMINI_MODEL || this.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      let contextInfo = '';
      if (context) {
        if (context.currentStep) contextInfo += `\nCurrent Booking Stage: ${context.currentStep}`;
        if (context.destination) contextInfo += `\nDestination: ${context.destination}`;
        if (context.ragContext && context.ragContext.length > 0) {
          contextInfo += `\nTravel Guidelines & Reference Context:\n` + 
            context.ragContext.map((c: any) => `- ${c.title}: ${c.content}`).join('\n');
        }
      }

      const prompt = `You are SkyVoyage AI, a luxury travel concierge and smart booking assistant powered by Google Gemini.
A traveler has asked you this question: "${question}".
${contextInfo}

Please provide a helpful, clear, and concise answer (under 4 sentences).
Use markdown formatting with bold text for key names, regulations, or places.
Remind the traveler that they can proceed to book flights, hotels, or cabs with you anytime.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return { reply: text, hasKey: true };
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn('[Gemini Service] Error response when answering question:', errData);
      }
    } catch (err) {
      console.warn('[Gemini Service] Network error when answering question:', err);
    }

    return {
      reply: `I received your travel inquiry: *"${question}"*. However, the Gemini model is currently unable to reach the Google AI network. Please verify your API key in the **[Admin Panel](/admin.html)** or try again shortly.`,
      hasKey: true
    };
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
      const model = process.env.GEMINI_MODEL || this.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
      const model = process.env.GEMINI_MODEL || this.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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
