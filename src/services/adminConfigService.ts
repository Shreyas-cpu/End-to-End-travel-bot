import fs from "fs";
import path from "path";

export interface AdminConfig {
  flightProvider: "mock" | "amadeus";
  amadeusApiKey?: string;
  amadeusApiSecret?: string;

  hotelProvider: "mock" | "booking_com";
  bookingComApiKey?: string;
  bookingComAffiliateId?: string;

  paymentsProvider: "mock" | "booking_com_payments";
  bookingComPaymentsApiKey?: string;
  paymentsEnvironment: "sandbox" | "live";

  llmProvider: "rule_engine" | "gemini";
  geminiApiKey?: string;
  geminiModel?: string;

  cabProvider: "mock" | "standard" | "uber";
  updatedAt: string;
}

export class AdminConfigService {
  private configPath: string;
  private currentConfig: AdminConfig;

  constructor() {
    this.configPath = path.join(process.cwd(), "data", "admin_config.json");
    this.currentConfig = this.loadConfig();
    this.syncEnvironmentVariables();
  }

  private loadConfig(): AdminConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, "utf-8");
        return JSON.parse(raw);
      } catch (err) {
        console.warn("[AdminConfigService] Error reading config file, using environment defaults:", err);
      }
    }

    return {
      flightProvider: "amadeus",
      amadeusApiKey: process.env.AMADEUS_API_KEY || "",
      amadeusApiSecret: process.env.AMADEUS_API_SECRET || "",
      hotelProvider: "booking_com",
      bookingComApiKey: process.env.BOOKING_COM_API_KEY || "",
      bookingComAffiliateId: process.env.BOOKING_COM_AFFILIATE_ID || "",
      paymentsProvider: "booking_com_payments",
      bookingComPaymentsApiKey: process.env.BOOKING_COM_PAYMENTS_API_KEY || "",
      paymentsEnvironment: (process.env.PAYMENTS_ENV as any) || "sandbox",
      llmProvider: (process.env.LLM_PROVIDER as any) || "gemini",
      geminiApiKey: process.env.GEMINI_API_KEY || "",
      geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      cabProvider: "standard",
      updatedAt: new Date().toISOString()
    };
  }

  private syncEnvironmentVariables() {
    process.env.FLIGHT_PROVIDER = this.currentConfig.flightProvider || "amadeus";
    process.env.AMADEUS_API_KEY = this.currentConfig.amadeusApiKey || "";
    process.env.AMADEUS_API_SECRET = this.currentConfig.amadeusApiSecret || "";

    process.env.HOTEL_PROVIDER = this.currentConfig.hotelProvider || "booking_com";
    process.env.BOOKING_COM_API_KEY = this.currentConfig.bookingComApiKey || "";
    process.env.BOOKING_COM_AFFILIATE_ID = this.currentConfig.bookingComAffiliateId || "";

    process.env.PAYMENTS_PROVIDER = this.currentConfig.paymentsProvider || "booking_com_payments";
    process.env.BOOKING_COM_PAYMENTS_API_KEY = this.currentConfig.bookingComPaymentsApiKey || "";
    process.env.PAYMENTS_ENV = this.currentConfig.paymentsEnvironment || "sandbox";

    process.env.LLM_PROVIDER = this.currentConfig.llmProvider || "gemini";
    process.env.GEMINI_API_KEY = this.currentConfig.geminiApiKey || "";
    process.env.GEMINI_MODEL = this.currentConfig.geminiModel || "gemini-2.5-flash";
    process.env.CAB_PROVIDER = this.currentConfig.cabProvider || "standard";
  }

  getConfig(): AdminConfig {
    this.currentConfig = this.loadConfig();
    this.syncEnvironmentVariables();
    return { ...this.currentConfig };
  }

  getMaskedConfig(): Record<string, any> {
    const mask = (val?: string) => {
      if (!val || val.length === 0) return "";
      if (val.length <= 6) return "••••••";
      return val.substring(0, 3) + "••••••••" + val.substring(val.length - 3);
    };

    return {
      flightProvider: this.currentConfig.flightProvider,
      amadeusApiKey: mask(this.currentConfig.amadeusApiKey),
      amadeusApiSecret: mask(this.currentConfig.amadeusApiSecret),
      hasAmadeusKey: Boolean(this.currentConfig.amadeusApiKey && this.currentConfig.amadeusApiKey.length > 5 && !this.currentConfig.amadeusApiKey.includes("xxxx")),
      hasAmadeusSecret: Boolean(this.currentConfig.amadeusApiSecret && this.currentConfig.amadeusApiSecret.length > 5 && !this.currentConfig.amadeusApiSecret.includes("xxxx")),

      hotelProvider: this.currentConfig.hotelProvider,
      bookingComApiKey: mask(this.currentConfig.bookingComApiKey),
      bookingComAffiliateId: this.currentConfig.bookingComAffiliateId || "",
      hasBookingKey: Boolean(this.currentConfig.bookingComApiKey && this.currentConfig.bookingComApiKey.length > 5 && !this.currentConfig.bookingComApiKey.includes("xxxx")),

      paymentsProvider: this.currentConfig.paymentsProvider,
      bookingComPaymentsApiKey: mask(this.currentConfig.bookingComPaymentsApiKey),
      paymentsEnvironment: this.currentConfig.paymentsEnvironment,
      hasPaymentsKey: Boolean(this.currentConfig.bookingComPaymentsApiKey && this.currentConfig.bookingComPaymentsApiKey.length > 5 && !this.currentConfig.bookingComPaymentsApiKey.includes("xxxx")),

      llmProvider: this.currentConfig.llmProvider,
      geminiApiKey: mask(this.currentConfig.geminiApiKey),
      geminiModel: this.currentConfig.geminiModel,
      hasGeminiKey: Boolean(this.currentConfig.geminiApiKey && this.currentConfig.geminiApiKey.length > 5 && !this.currentConfig.geminiApiKey.includes("xxxx")),

      cabProvider: this.currentConfig.cabProvider,
      updatedAt: this.currentConfig.updatedAt
    };
  }

  saveConfig(updates: Partial<AdminConfig>): AdminConfig {
    const updated: AdminConfig = {
      ...this.currentConfig,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // If masked placeholder was posted back, preserve existing key
    if (updates.amadeusApiKey && updates.amadeusApiKey.includes("••••")) {
      updated.amadeusApiKey = this.currentConfig.amadeusApiKey;
    }
    if (updates.amadeusApiSecret && updates.amadeusApiSecret.includes("••••")) {
      updated.amadeusApiSecret = this.currentConfig.amadeusApiSecret;
    }
    if (updates.bookingComApiKey && updates.bookingComApiKey.includes("••••")) {
      updated.bookingComApiKey = this.currentConfig.bookingComApiKey;
    }
    if (updates.bookingComPaymentsApiKey && updates.bookingComPaymentsApiKey.includes("••••")) {
      updated.bookingComPaymentsApiKey = this.currentConfig.bookingComPaymentsApiKey;
    }
    if (updates.geminiApiKey && updates.geminiApiKey.includes("••••")) {
      updated.geminiApiKey = this.currentConfig.geminiApiKey;
    }

    this.currentConfig = updated;
    this.syncEnvironmentVariables();

    // Persist to data directory
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), "utf-8");

    return this.currentConfig;
  }

  /**
   * Diagnostic connection test for each integration
   */
  async testConnection(provider: "gemini" | "amadeus" | "booking_com" | "booking_com_payments"): Promise<{
    provider: string;
    success: boolean;
    status: string;
    message: string;
    latencyMs: number;
  }> {
    const start = Date.now();

    if (provider === "gemini") {
      const key = this.currentConfig.geminiApiKey;
      if (!key || key.trim() === "" || key.includes("xxxx")) {
        return {
          provider: "Google Gemini 2.5 Flash",
          success: false,
          status: "Error: No API Key Inserted",
          message: "No Gemini API Key found. Please add your GEMINI_API_KEY in the API section of the Admin Panel, or contact your system administrator.",
          latencyMs: Date.now() - start
        };
      }

      try {
        const probeRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.currentConfig.geminiModel || 'gemini-2.5-flash'}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
        });

        if (probeRes.ok) {
          return {
            provider: "Google Gemini 2.5 Flash",
            success: true,
            status: "Connected & Active",
            message: "Google Gemini API key verified successfully. Ready for live queries.",
            latencyMs: Date.now() - start
          };
        } else {
          const err = await probeRes.text();
          return {
            provider: "Google Gemini 2.5 Flash",
            success: false,
            status: "Authentication Failed",
            message: `Gemini API rejected key (${probeRes.status}): ${err.substring(0, 150)}`,
            latencyMs: Date.now() - start
          };
        }
      } catch (err: any) {
        return {
          provider: "Google Gemini 2.5 Flash",
          success: false,
          status: "Connection Failed",
          message: `Network error reaching Google Gemini: ${err.message}`,
          latencyMs: Date.now() - start
        };
      }
    }

    if (provider === "amadeus") {
      if (this.currentConfig.flightProvider === "mock") {
        return {
          provider: "Amadeus Mock Flight Adapter",
          success: true,
          status: "Active (Mock Testing Mode)",
          message: "Mock flight offers engine active with 4 cabin classes and departure period filters. No API key required.",
          latencyMs: Date.now() - start + 2
        };
      }

      const key = this.currentConfig.amadeusApiKey;
      const secret = this.currentConfig.amadeusApiSecret;

      if (!key || key.trim() === "" || key.includes("xxxx") || !secret || secret.trim() === "" || secret.includes("xxxx")) {
        return {
          provider: "Amadeus Flight Offers v2",
          success: false,
          status: "Error: No API Key Inserted",
          message: "Amadeus API Key and API Secret are missing. Please enter both credentials above, or switch to Mock Mode for testing.",
          latencyMs: Date.now() - start
        };
      }

      try {
        const tokenUrl = process.env.AMADEUS_TOKEN_URL || "https://test.api.amadeus.com/v1/security/oauth2/token";
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", key);
        params.append("client_secret", secret);

        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString()
        });

        if (res.ok) {
          return {
            provider: "Amadeus Flight Offers v2",
            success: true,
            status: "Connected & Active",
            message: "Amadeus OAuth2 authentication verified successfully.",
            latencyMs: Date.now() - start
          };
        } else {
          const errText = await res.text();
          return {
            provider: "Amadeus Flight Offers v2",
            success: false,
            status: "Authentication Failed",
            message: `Amadeus OAuth2 rejected credentials (${res.status}): ${errText.substring(0, 150)}`,
            latencyMs: Date.now() - start
          };
        }
      } catch (err: any) {
        return {
          provider: "Amadeus Flight Offers v2",
          success: false,
          status: "Connection Failed",
          message: `Network error connecting to Amadeus: ${err.message}`,
          latencyMs: Date.now() - start
        };
      }
    }

    if (provider === "booking_com") {
      if (this.currentConfig.hotelProvider === "mock") {
        return {
          provider: "Booking.com Demand v3 Mock",
          success: true,
          status: "Active (Mock Testing Mode)",
          message: "Mock accommodation engine active with photo carousels, airport default, and price sorting. No API key required.",
          latencyMs: Date.now() - start + 2
        };
      }

      const key = this.currentConfig.bookingComApiKey;

      if (!key || key.trim() === "" || key.includes("xxxx")) {
        return {
          provider: "Booking.com Demand API v3",
          success: false,
          status: "Error: No API Key Inserted",
          message: "Booking.com Demand API Key is missing. Please enter your API Key above, or switch to Mock Mode for testing.",
          latencyMs: Date.now() - start
        };
      }

      try {
        const baseUrl = process.env.BOOKING_COM_BASE_URL || "https://demandapi.booking.com/3.2";
        const res = await fetch(`${baseUrl}/accommodations/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${key}`,
            "X-Affiliate-Id": this.currentConfig.bookingComAffiliateId || ""
          },
          body: JSON.stringify({
            booker: { country: "US", platform: "desktop" },
            checkin: "2026-10-15",
            checkout: "2026-10-19",
            guests: { number_of_adults: 2, number_of_rooms: 1 },
            city: "Paris"
          })
        });

        if (res.ok) {
          return {
            provider: "Booking.com Demand API v3",
            success: true,
            status: "Connected & Active",
            message: "Booking.com Demand API connection established and verified.",
            latencyMs: Date.now() - start
          };
        } else {
          const errText = await res.text();
          return {
            provider: "Booking.com Demand API v3",
            success: false,
            status: "API Authentication Failed",
            message: `Booking.com API responded with (${res.status}): ${errText.substring(0, 150)}`,
            latencyMs: Date.now() - start
          };
        }
      } catch (err: any) {
        return {
          provider: "Booking.com Demand API v3",
          success: false,
          status: "Connection Failed",
          message: `Network error connecting to Booking.com: ${err.message}`,
          latencyMs: Date.now() - start
        };
      }
    }

    if (provider === "booking_com_payments") {
      if (this.currentConfig.paymentsProvider === "mock") {
        return {
          provider: "Booking.com Payments Mock",
          success: true,
          status: "Active (Mock Testing Mode)",
          message: "Mock payment session generator active for testing. Instant simulated checkout without API key.",
          latencyMs: Date.now() - start + 2
        };
      }

      const key = this.currentConfig.bookingComPaymentsApiKey;
      const env = this.currentConfig.paymentsEnvironment || "sandbox";

      if (!key || key.trim() === "" || key.includes("xxxx")) {
        return {
          provider: "Booking.com Payments API",
          success: false,
          status: "Error: No API Key Inserted",
          message: "Booking.com Payments API Key is missing. Please enter your API Key above, or switch to Mock Mode for testing.",
          latencyMs: Date.now() - start
        };
      }

      return {
        provider: "Booking.com Payments API",
        success: true,
        status: `Active (${env.toUpperCase()})`,
        message: `Booking.com Payments API key loaded for ${env} transactions.`,
        latencyMs: Date.now() - start + 5
      };
    }

    if (provider === "cab" || provider === "standard") {
      return {
        provider: "Ground Transport Transfers",
        success: true,
        status: "Active (4 Vehicle Classes)",
        message: "Bidirectional transfer routing (Standard, Executive, Electric, Van).",
        latencyMs: Date.now() - start + 2
      };
    }

    return {
      provider,
      success: false,
      status: "Unknown",
      message: "Provider not recognized",
      latencyMs: Date.now() - start
    };
  }
}

export const adminConfigService = new AdminConfigService();
