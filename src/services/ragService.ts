import fs from "fs";
import path from "path";

export interface KnowledgeChunk {
  id: string;
  sourceFile: string;
  title: string;
  content: string;
  tags: string[];
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
  suggestedPrompt?: string;
}

export interface GuardrailOptions {
  /** True while the traveler is mid-booking, so replies like "from mumbai at 25 october" are trip details */
  inActiveBooking?: boolean;
}

export class TravelRAGService {
  private knowledgeDir: string;
  private chunks: KnowledgeChunk[] = [];
  private travelKeywords: Set<string>;
  private bannedKeywords: Set<string>;

  constructor() {
    this.knowledgeDir = path.join(process.cwd(), "data", "knowledge");
    this.travelKeywords = new Set([
      "flight", "flights", "airline", "airlines", "plane", "ticket", "tickets",
      "hotel", "hotels", "stay", "accommodation", "room", "suite", "check-in", "checkout",
      "cab", "cabs", "taxi", "transfer", "transfers", "ride", "airport", "terminal",
      "baggage", "luggage", "carry-on", "suitcase", "pack", "passport", "visa",
      "travel", "traveler", "trip", "tour", "tourism", "vacation", "holiday", "destination",
      "booking", "book", "reserve", "reservation", "cancel", "refund", "fare", "price",
      "paris", "london", "tokyo", "new york", "dubai", "rome", "bali", "singapore",
      "jfk", "cdg", "lhr", "hnd", "ord", "sfo", "lax",
      "business class", "first class", "economy", "premium economy"
    ]);

    this.bannedKeywords = new Set([
      "python", "javascript", "typescript", "c++", "java", "sql", "leetcode", "react",
      "algorithm", "function", "variable", "class", "compile", "execute", "bug", "syntax",
      "integral", "derivative", "calculus", "equation", "matrix", "algebra",
      "quantum", "physics", "chemistry", "biology", "medical", "prescription",
      "politics", "president", "election", "democrat", "republican", "parliament",
      "write code", "code for", "debug", "hack", "exploit", "reverse engineer"
    ]);

    this.loadKnowledgeBase();
  }

  private loadKnowledgeBase() {
    if (!fs.existsSync(this.knowledgeDir)) {
      return;
    }

    const files = fs.readdirSync(this.knowledgeDir).filter(f => f.endsWith(".md"));
    this.chunks = [];

    for (const file of files) {
      const filePath = path.join(this.knowledgeDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const sections = content.split(/\n(?=##?\s)/);

      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i].trim();
        if (!sec) continue;

        const titleMatch = sec.match(/^#+\s+(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : file.replace(".md", "");
        const words = sec.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length > 2);

        this.chunks.push({
          id: `${file}-${i}`,
          sourceFile: file,
          title,
          content: sec,
          tags: Array.from(new Set(words))
        });
      }
    }
  }

  /**
   * Domain Guardrail: Determines if the user input falls within the Travel & Booking domain
   */
  isTravelRelated(input: string, options: GuardrailOptions = {}): GuardrailResult {
    const clean = (input || "").toLowerCase().trim();
    if (!clean) {
      return { allowed: true };
    }

    // Always allow structural workflow triggers
    const workflowCommands = [
      "reset", "start over", "new trip", "confirm", "yes", "no", "skip", 
      "select", "help", "hello", "hi", "hey", "continue", "next", "ok", "okay", "done"
    ];
    if (workflowCommands.some(cmd => clean === cmd || clean.startsWith(cmd + " "))) {
      return { allowed: true };
    }

    // Check for explicit off-domain banned patterns
    const words = clean.replace(/[^a-z0-9]/g, " ").split(/\s+/);
    const hasBannedKeyword = words.some(w => this.bannedKeywords.has(w));

    // Check for software code snippets
    const looksLikeCode = clean.includes("def ") || clean.includes("function(") || 
                          clean.includes("console.log") || clean.includes("import ") || 
                          clean.includes("void main") || clean.includes("<html>");

    if (hasBannedKeyword || looksLikeCode) {
      return {
        allowed: false,
        reason: "Off-domain query detected. Antigravity Travel AI specializes exclusively in end-to-end travel booking, flight comparison, accommodation selection, airport transfers, and travel advisories.",
        suggestedPrompt: "✈️ I am your dedicated **Travel Booking AI Assistant**. I can assist you with flights, hotels, airport cabs, and travel guidelines (baggage, visas, airports). How may I help you with your journey today?"
      };
    }

    // Inside an active booking every remaining message is trip detail (cities, dates, guests)
    if (options.inActiveBooking) {
      return { allowed: true };
    }

    // Check for presence of travel terms, destinations or itinerary details (dates, routes)
    const hasTravelKeyword = words.some(w => this.travelKeywords.has(w));
    if (hasTravelKeyword || this.looksLikeItineraryDetail(clean) || words.length <= 4) {
      return { allowed: true };
    }

    // If long query contains zero travel relevance
    return {
      allowed: false,
      reason: "Query does not appear related to travel, flights, hotels, or ground transport.",
      suggestedPrompt: "🌐 Please ask me anything related to your travel plans — such as finding flights, booking hotels near the airport, organizing transfers, or checking baggage allowances!"
    };
  }

  /**
   * Recognise itinerary details that carry no explicit travel noun,
   * e.g. "from mumbai at 25 october" or "delhi to goa, 2 adults"
   */
  private looksLikeItineraryDetail(clean: string): boolean {
    const hasMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.test(clean);
    const hasDate = /\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b/.test(clean) ||
                    /\b\d{4}-\d{2}-\d{2}\b/.test(clean) ||
                    /\b(today|tomorrow|tonight|next week|next month|weekend)\b/.test(clean);
    const hasRoute = /\bfrom\s+[a-z]/.test(clean) || /\b[a-z]{3,}\s+to\s+[a-z]{3,}/.test(clean);
    const hasPartyOrStay = /\b\d+\s*(adults?|kids?|children|people|persons?|guests?|pax|nights?|days?)\b/.test(clean);

    return hasMonth || hasDate || hasRoute || hasPartyOrStay;
  }

  /**
   * Retrieve relevant knowledge chunks matching the traveler query
   */
  retrieve(query: string, limit: number = 2): KnowledgeChunk[] {
    const queryTokens = query.toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length > 2);
    if (queryTokens.length === 0) return [];

    const scored = this.chunks.map(chunk => {
      let score = 0;
      for (const token of queryTokens) {
        if (chunk.title.toLowerCase().includes(token)) score += 5;
        if (chunk.tags.includes(token)) score += 1;
      }
      return { chunk, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.chunk);
  }

  /**
   * Generate authoritative answer from knowledge base if traveler asks an informational query
   */
  answerTravelInquiry(query: string): string | null {
    const chunks = this.retrieve(query, 2);
    if (chunks.length === 0) return null;

    let response = `ℹ️ **Travel Advisory Information**:\n\n`;
    for (const chunk of chunks) {
      response += `${chunk.content}\n\n`;
    }
    response += `Would you like to proceed with booking your flight or hotel now?`;
    return response;
  }
}

export const travelRAGService = new TravelRAGService();
