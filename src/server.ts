import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { travelOrchestrator } from './services/orchestrator';
import { userProfileService } from './services/userProfileService';
import { travelRAGService } from './services/ragService';

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
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    framework: 'Travel Booking AI Assistant Framework (MVP)',
    providers: {
      hotels: {
        provider: process.env.HOTEL_PROVIDER || 'mock',
        target: 'Booking.com Demand API v3',
        status: process.env.BOOKING_COM_API_KEY ? 'Live API Configured' : 'Mock Framework Active (Plug & Play)'
      },
      flights: {
        provider: process.env.FLIGHT_PROVIDER || 'mock',
        target: 'Amadeus Flight Offers v2',
        status: process.env.AMADEUS_API_KEY ? 'Live API Configured' : 'Mock Framework Active (Plug & Play)'
      },
      cabs: {
        provider: process.env.CAB_PROVIDER || 'mock',
        target: 'Aggregator / Uber Transfers',
        status: 'Mock Framework Active'
      },
      ticketing: {
        engine: 'PDFKit Native Generator',
        status: 'Active'
      },
      llm: {
        provider: process.env.LLM_PROVIDER || 'rule_engine',
        status: (process.env.LLM_PROVIDER === 'gemini' || !!process.env.GEMINI_API_KEY)
          ? 'Google Gemini 2.5 Flash Connected & Active'
          : 'Deterministic Rule Engine Active'
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
 * Start listening
 */
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Travel Booking AI Framework Server running on:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Hotel Engine: Booking.com Demand API (${process.env.HOTEL_PROVIDER || 'mock'})`);
  console.log(`   Flight Engine: Amadeus Offers (${process.env.FLIGHT_PROVIDER || 'mock'})`);
  console.log(`=======================================================`);
});
