import fs from "fs";
import path from "path";
import { CabinClass } from "../providers/types";

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  preferredCabin: CabinClass;
  preferredHotelArea: "Near Airport" | "City Center" | "Downtown" | "Historic" | "Suburbs";
  preferredDeparturePeriod: "morning" | "afternoon" | "evening" | "night";
  favoriteAirlines: string[];
  favoriteDestinations: string[];
  preferredAmenities: string[];
  bookingHistory: Array<{
    date: string;
    bookingReference: string;
    destination: string;
    flight?: string;
    cabin?: string;
    hotel?: string;
    totalCost: number;
  }>;
}

export class UserProfileService {
  private profilesDir: string;

  constructor() {
    this.profilesDir = path.join(process.cwd(), "data", "profiles");
    this.ensureDirectory();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(this.profilesDir)) {
        fs.mkdirSync(this.profilesDir, { recursive: true });
      }
    } catch {
      this.profilesDir = path.join("/tmp", "profiles");
      try {
        if (!fs.existsSync(this.profilesDir)) {
          fs.mkdirSync(this.profilesDir, { recursive: true });
        }
      } catch (e) {
        console.warn("[UserProfileService] Cannot create profiles directory:", e);
      }
    }
  }

  private getProfilePath(userId: string): string {
    const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(this.profilesDir, `${cleanId}.md`);
  }

  /**
   * Load or initialize a user profile from its markdown file
   */
  async getProfile(userId: string = "traveler_default"): Promise<UserProfile> {
    this.ensureDirectory();
    let filePath = this.getProfilePath(userId);
    const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const tmpFile = path.join("/tmp", `${cleanId}.md`);
    if (fs.existsSync(tmpFile)) {
      filePath = tmpFile;
    }

    if (!fs.existsSync(filePath)) {
      const defaultProfile: UserProfile = {
        userId,
        displayName: "Valued Traveler",
        email: "traveler@example.com",
        preferredCabin: "Economy",
        preferredHotelArea: "Near Airport",
        preferredDeparturePeriod: "morning",
        favoriteAirlines: ["Air France", "Delta Air Lines"],
        favoriteDestinations: ["Paris", "London"],
        preferredAmenities: ["Free WiFi", "Breakfast Included"],
        bookingHistory: []
      };

      await this.saveProfile(defaultProfile);
      return defaultProfile;
    }

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return this.parseFromMarkdown(content, userId);
    } catch (err) {
      console.warn(`[UserProfileService] Error reading profile for ${userId}:`, err);
      return {
        userId,
        displayName: "Valued Traveler",
        email: "traveler@example.com",
        preferredCabin: "Economy",
        preferredHotelArea: "Near Airport",
        preferredDeparturePeriod: "morning",
        favoriteAirlines: [],
        favoriteDestinations: [],
        preferredAmenities: [],
        bookingHistory: []
      };
    }
  }

  /**
   * Save or update a user profile as a structured markdown file
   */
  async saveProfile(profile: UserProfile): Promise<void> {
    this.ensureDirectory();
    const filePath = this.getProfilePath(profile.userId);
    const markdown = this.serializeToMarkdown(profile);
    try {
      fs.writeFileSync(filePath, markdown, "utf-8");
    } catch (err) {
      try {
        const cleanId = profile.userId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const tmpFile = path.join("/tmp", `${cleanId}.md`);
        fs.writeFileSync(tmpFile, markdown, "utf-8");
      } catch (e) {
        console.warn("[UserProfileService] Could not persist profile to disk:", e);
      }
    }
  }

  /**
   * Update specific preferences for a user
   */
  async updatePreferences(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const profile = await this.getProfile(userId);
    const updated: UserProfile = {
      ...profile,
      ...updates,
      userId
    };

    await this.saveProfile(updated);
    return updated;
  }

  /**
   * Record a completed booking into the user booking history and update preferences
   */
  async recordBooking(userId: string, booking: {
    bookingReference: string;
    destination: string;
    flight?: { airline: string; flightNumber: string; cabinClass: CabinClass };
    hotel?: { name: string; area?: string };
    totalCost: number;
  }): Promise<void> {
    const profile = await this.getProfile(userId);

    profile.bookingHistory.unshift({
      date: new Date().toISOString().split("T")[0],
      bookingReference: booking.bookingReference,
      destination: booking.destination,
      flight: booking.flight ? `${booking.flight.airline} (${booking.flight.flightNumber})` : undefined,
      cabin: booking.flight ? booking.flight.cabinClass : undefined,
      hotel: booking.hotel ? booking.hotel.name : undefined,
      totalCost: booking.totalCost
    });

    if (booking.flight?.cabinClass) {
      profile.preferredCabin = booking.flight.cabinClass;
    }

    if (booking.flight?.airline && !profile.favoriteAirlines.includes(booking.flight.airline)) {
      profile.favoriteAirlines.push(booking.flight.airline);
    }

    if (booking.destination && !profile.favoriteDestinations.includes(booking.destination)) {
      profile.favoriteDestinations.push(booking.destination);
    }

    if (booking.hotel?.area && ["Near Airport", "City Center", "Downtown", "Historic", "Suburbs"].includes(booking.hotel.area)) {
      profile.preferredHotelArea = booking.hotel.area as any;
    }

    await this.saveProfile(profile);
  }

  /**
   * Serialize profile to clean markdown format
   */
  serializeToMarkdown(profile: UserProfile): string {
    let md = `# Traveler Profile: ${profile.displayName}\n\n`;
    md += `> Persistent user preference file generated by Travel Booking AI Assistant.\n\n`;
    md += `## Personal Information\n`;
    md += `- **User ID**: \`${profile.userId}\`\n`;
    md += `- **Display Name**: ${profile.displayName}\n`;
    md += `- **Email**: ${profile.email}\n\n`;

    md += `## Travel Preferences\n`;
    md += `- **Preferred Cabin Class**: ${profile.preferredCabin}\n`;
    md += `- **Preferred Hotel Location**: ${profile.preferredHotelArea}\n`;
    md += `- **Preferred Departure Time**: ${profile.preferredDeparturePeriod}\n`;
    md += `- **Favorite Airlines**: ${profile.favoriteAirlines.length > 0 ? profile.favoriteAirlines.join(", ") : "None specified"}\n`;
    md += `- **Frequent Destinations**: ${profile.favoriteDestinations.length > 0 ? profile.favoriteDestinations.join(", ") : "None specified"}\n`;
    md += `- **Preferred Amenities**: ${profile.preferredAmenities.length > 0 ? profile.preferredAmenities.join(", ") : "Free WiFi"}\n\n`;

    md += `## Booking History\n`;
    if (profile.bookingHistory.length === 0) {
      md += `*No previous bookings recorded yet.*\n`;
    } else {
      md += `| Date | Reference | Destination | Flight & Cabin | Hotel | Total USD |\n`;
      md += `|---|---|---|---|---|---|\n`;
      for (const b of profile.bookingHistory) {
        md += `| ${b.date} | \`${b.bookingReference}\` | ${b.destination} | ${b.flight || "None"} (${b.cabin || "N/A"}) | ${b.hotel || "None"} | $${b.totalCost.toFixed(2)} |\n`;
      }
    }

    return md;
  }

  /**
   * Parse profile data from markdown file content
   */
  parseFromMarkdown(content: string, userId: string): UserProfile {
    const getValue = (pattern: RegExp, fallback: string = ""): string => {
      const match = content.match(pattern);
      return match ? match[1].trim() : fallback;
    };

    const displayName = getValue(/# Traveler Profile:\s*(.+)/, "Valued Traveler");
    const email = getValue(/\*\*Email\*\*:\s*([^\n\r]+)/, "traveler@example.com");
    const cabin = getValue(/\*\*Preferred Cabin Class\*\*:\s*([^\n\r]+)/, "Economy") as CabinClass;
    const hotelArea = getValue(/\*\*Preferred Hotel Location\*\*:\s*([^\n\r]+)/, "Near Airport") as any;
    const departurePeriod = getValue(/\*\*Preferred Departure Time\*\*:\s*([^\n\r]+)/, "morning") as any;

    const airlinesRaw = getValue(/\*\*Favorite Airlines\*\*:\s*([^\n\r]+)/, "");
    const favoriteAirlines = airlinesRaw && airlinesRaw !== "None specified" 
      ? airlinesRaw.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    const destinationsRaw = getValue(/\*\*Frequent Destinations\*\*:\s*([^\n\r]+)/, "");
    const favoriteDestinations = destinationsRaw && destinationsRaw !== "None specified"
      ? destinationsRaw.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    const amenitiesRaw = getValue(/\*\*Preferred Amenities\*\*:\s*([^\n\r]+)/, "");
    const preferredAmenities = amenitiesRaw && amenitiesRaw !== "None specified"
      ? amenitiesRaw.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    const bookingHistory: UserProfile["bookingHistory"] = [];
    const tableRegex = /\|\s*([^|]+)\s*\|\s*`?([^`|]+)`?\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*\$([0-9.]+)\s*\|/g;
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      if (match[1].includes("Date") || match[1].includes("---")) continue;
      bookingHistory.push({
        date: match[1].trim(),
        bookingReference: match[2].trim(),
        destination: match[3].trim(),
        flight: match[4].trim(),
        hotel: match[5].trim(),
        totalCost: parseFloat(match[6].trim()) || 0
      });
    }

    return {
      userId,
      displayName,
      email,
      preferredCabin: ["Economy", "Premium Economy", "Business", "First Class"].includes(cabin) ? cabin : "Economy",
      preferredHotelArea: ["Near Airport", "City Center", "Downtown", "Historic", "Suburbs"].includes(hotelArea) ? hotelArea : "Near Airport",
      preferredDeparturePeriod: ["morning", "afternoon", "evening", "night"].includes(departurePeriod) ? departurePeriod : "morning",
      favoriteAirlines,
      favoriteDestinations,
      preferredAmenities,
      bookingHistory
    };
  }
}

export const userProfileService = new UserProfileService();
