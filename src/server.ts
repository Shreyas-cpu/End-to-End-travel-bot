import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { travelOrchestrator } from './services/orchestrator';
import { userProfileService } from './services/userProfileService';
import { travelRAGService } from './services/ragService';
import { adminConfigService } from './services/adminConfigService';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend assets & generated PDF tickets
app.use(express.static(path.join(process.cwd(), 'public')));

/**
 * Health check & Provider diagnostics
 */
app.get('/api/health', (req: Request, res: Response) => {
  const cfg = adminConfigService.getConfig();
  const hasAmadeus = Boolean(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_KEY.trim() !== '' && !process.env.AMADEUS_API_KEY.includes('xxxx'));
  const hasBooking = Boolean(process.env.BOOKING_COM_API_KEY && process.env.BOOKING_COM_API_KEY.trim() !== '' && !process.env.BOOKING_COM_API_KEY.includes('xxxx'));
  const hasPayments = Boolean(process.env.BOOKING_COM_PAYMENTS_API_KEY && process.env.BOOKING_COM_PAYMENTS_API_KEY.trim() !== '' && !process.env.BOOKING_COM_PAYMENTS_API_KEY.includes('xxxx'));
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && !process.env.GEMINI_API_KEY.includes('xxxx'));

  const flightMode = cfg.flightProvider === 'mock' ? 'mock' : 'live';
  const hotelMode = cfg.hotelProvider === 'mock' ? 'mock' : 'live';
  const paymentsMode = cfg.paymentsProvider === 'mock' ? 'mock' : 'live';

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    framework: 'Travel Booking AI Assistant Framework',
    providers: {
      hotels: {
        provider: cfg.hotelProvider,
        target: hotelMode === 'mock' ? 'Booking.com Demand v3 Mock (Testing)' : 'Booking.com Demand API v3',
        mode: hotelMode,
        configured: hotelMode === 'mock' || hasBooking,
        status: hotelMode === 'mock' ? 'Mock Mode Active (Testing)' : (hasBooking ? 'Live API Configured' : 'Error: No API Key Inserted')
      },
      flights: {
        provider: cfg.flightProvider,
        target: flightMode === 'mock' ? 'Amadeus Mock Flight Adapter (Testing)' : 'Amadeus Flight Offers v2',
        mode: flightMode,
        configured: flightMode === 'mock' || hasAmadeus,
        status: flightMode === 'mock' ? 'Mock Mode Active (Testing)' : (hasAmadeus ? 'Live API Configured' : 'Error: No API Key Inserted')
      },
      payments: {
        provider: cfg.paymentsProvider,
        target: paymentsMode === 'mock' ? 'Booking.com Payments Mock (Testing)' : 'Booking.com Payments API',
        mode: paymentsMode,
        configured: paymentsMode === 'mock' || hasPayments,
        status: paymentsMode === 'mock' ? 'Mock Mode Active (Testing)' : (hasPayments ? 'Live API Configured' : 'Error: No API Key Inserted')
      },
      cabs: {
        provider: cfg.cabProvider || 'standard',
        target: 'Ground Transfer Dispatch',
        mode: cfg.cabProvider === 'mock' ? 'mock' : 'live',
        status: 'Active'
      },
      ticketing: {
        engine: 'PDFKit Native Generator',
        status: 'Active'
      },
      llm: {
        provider: cfg.llmProvider,
        configured: cfg.llmProvider === 'rule_engine' || hasGemini,
        status: cfg.llmProvider === 'rule_engine' ? 'Deterministic Rule Engine Active' : (hasGemini ? 'Google Gemini 2.5 Flash Connected & Active' : 'Error: No API Key Inserted (Add in Admin Panel API section or contact admin)')
      }
    }
  });
});


/**
 * Main conversational webhook endpoint
 */
app.post('/api/chat/message', async (req: Request, res: Response) => {
  try {
    const { sessionId, message, actionPayload } = req.body;
    const response = await travelOrchestrator.processMessage(sessionId, message, actionPayload);
    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error in travel orchestrator', details: error.message });
  }
});

/**
 * Retrieve session conversation history
 */
app.get('/api/chat/history/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      session,
      messages: session.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata ? JSON.parse(m.metadata) : null,
        createdAt: m.createdAt
      }))
    });
  } catch (error: any) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * Retrieve Confirmed Booking by Reference
 */
app.get('/api/booking/:ref', async (req: Request, res: Response) => {
  try {
    const { ref } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { bookingReference: ref }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      booking: {
        ...booking,
        flight: booking.flightDetails ? JSON.parse(booking.flightDetails) : null,
        hotel: booking.hotelDetails ? JSON.parse(booking.hotelDetails) : null,
        cab: booking.cabDetails ? JSON.parse(booking.cabDetails) : null
      }
    });
  } catch (error: any) {
    console.error('Booking fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch booking', details: error.message });
  }
});

/**
 * Retrieve User Profile (Parsed JSON and Markdown format)
 */
app.get('/api/user/profile/:userId?', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || 'traveler_default';
    const profile = await userProfileService.getProfile(userId);
    const markdown = userProfileService.serializeToMarkdown(profile);

    res.json({
      success: true,
      profile,
      markdown
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', details: err.message });
  }
});

/**
 * Update User Profile Preferences
 */
app.post('/api/user/profile/:userId?', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId || 'traveler_default';
    const updates = req.body;
    const updated = await userProfileService.updatePreferences(userId, updates);
    const markdown = userProfileService.serializeToMarkdown(updated);

    res.json({
      success: true,
      profile: updated,
      markdown
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile preferences', details: err.message });
  }
});

/**
 * Travel Knowledge Base RAG Search & Guardrail Test Endpoint
 */
app.get('/api/rag/search', (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const guardrail = travelRAGService.isTravelRelated(query);
  const chunks = travelRAGService.retrieve(query, 3);
  const answer = travelRAGService.answerTravelInquiry(query);

  res.json({
    query,
    guardrail,
    chunks,
    answer
  });
});

/**
 * Retrieve Admin Configuration (Masked)
 */
app.get('/api/admin/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    config: adminConfigService.getMaskedConfig()
  });
});

/**
 * Update Admin Configuration
 */
app.post('/api/admin/config', (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const updated = adminConfigService.saveConfig(updates);
    res.json({
      success: true,
      message: 'Admin configuration updated successfully',
      config: adminConfigService.getMaskedConfig()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update admin configuration', details: err.message });
  }
});

/**
 * Test Provider Connectivity
 */
app.post('/api/admin/test-connection', async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    const result = await adminConfigService.testConnection(provider);
    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Connection test failed', details: err.message });
  }
});

/**
 * Start listening
 */
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Travel Booking AI Assistant Server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Hotel Engine: Booking.com Demand API v3 (Live)`);
  console.log(`   Flight Engine: Amadeus Flight Offers v2 (Live)`);
  console.log(`   Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`=======================================================`);
});
