import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { BookingDetails } from '../providers/types';

export class PDFTicketGenerator {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'public', 'tickets');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a professional, beautifully styled PDF voucher for confirmed bookings
   */
  async generateTicket(booking: BookingDetails): Promise<string> {
    const filename = `Ticket_${booking.bookingReference}.pdf`;
    const filePath = path.join(this.outputDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Travel Voucher - ${booking.bookingReference}`,
          Author: 'Travel Booking AI Assistant Framework',
          Subject: 'Official Travel Confirmation & Itinerary'
        }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // --- Color Palette ---
      const primaryColor = '#1A365D'; // Deep Royal Navy
      const accentColor = '#2563EB';  // Vivid Sapphire Blue
      const successColor = '#059669'; // Emerald
      const darkText = '#1F2937';
      const lightText = '#6B7280';
      const cardBg = '#F8FAFC';
      const borderColor = '#E2E8F0';

      // --- Header Banner ---
      doc.rect(40, 40, 515, 75).fill(primaryColor);

      doc.fillColor('#FFFFFF')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('TRAVEL ITINERARY & E-TICKET', 60, 55);

      doc.fontSize(10)
         .font('Helvetica')
         .text('AI Travel Assistant Booking Framework', 60, 80);

      // Booking Reference Box
      doc.rect(400, 50, 140, 55).fill('#FFFFFF');
      doc.fillColor(lightText)
         .fontSize(8)
         .font('Helvetica-Bold')
         .text('BOOKING REFERENCE', 410, 60);

      doc.fillColor(accentColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(booking.bookingReference, 410, 75);

      let currentY = 130;

      // --- Status & Passenger Info Row ---
      doc.rect(40, currentY, 515, 50).fill(cardBg).stroke(borderColor);
      
      doc.fillColor(lightText).fontSize(8).font('Helvetica-Bold').text('PASSENGER NAME', 55, currentY + 12);
      doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold').text(booking.passengerName, 55, currentY + 25);

      doc.fillColor(lightText).fontSize(8).font('Helvetica-Bold').text('EMAIL ADDRESS', 230, currentY + 12);
      doc.fillColor(darkText).fontSize(10).font('Helvetica').text(booking.passengerEmail, 230, currentY + 26);

      doc.fillColor(lightText).fontSize(8).font('Helvetica-Bold').text('BOOKING STATUS', 410, currentY + 12);
      doc.fillColor(successColor).fontSize(11).font('Helvetica-Bold').text('● CONFIRMED & READY', 410, currentY + 25);

      currentY += 65;

      // --- Section 1: Flight Details ---
      if (booking.flight) {
        doc.rect(40, currentY, 515, 115).fill(cardBg).stroke(borderColor);
        
        // Header badge
        doc.rect(40, currentY, 515, 24).fill('#EBF5FF');
        doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold').text('✈  FLIGHT RESERVATION', 55, currentY + 7);
        doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(`${booking.flight.airline} (${booking.flight.flightNumber})`, 380, currentY + 7);

        const fY = currentY + 34;
        
        // Origin -> Destination
        doc.fillColor(darkText).fontSize(16).font('Helvetica-Bold').text(booking.flight.originAirport, 55, fY);
        doc.fillColor(lightText).fontSize(9).font('Helvetica').text(booking.flight.origin, 55, fY + 20);
        doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(`Dep: ${booking.flight.departureTime}`, 55, fY + 35);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(booking.flight.departureDate, 55, fY + 48);

        // Flight route arrow
        doc.fillColor(accentColor).fontSize(14).font('Helvetica-Bold').text('──────── ✈ ────────', 200, fY + 8);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`${booking.flight.duration} • Non-stop`, 235, fY + 28);

        // Destination
        doc.fillColor(darkText).fontSize(16).font('Helvetica-Bold').text(booking.flight.destinationAirport, 380, fY);
        doc.fillColor(lightText).fontSize(9).font('Helvetica').text(booking.flight.destination, 380, fY + 20);
        doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(`Arr: ${booking.flight.arrivalTime}`, 380, fY + 35);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(booking.flight.arrivalDate, 380, fY + 48);

        // Class & Fare
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Class: ${booking.flight.cabinClass}`, 55, fY + 65);
        doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(`Fare: $${booking.flight.price} USD`, 380, fY + 65);

        currentY += 130;
      }

      // --- Section 2: Hotel Details ---
      if (booking.hotel) {
        doc.rect(40, currentY, 515, 110).fill(cardBg).stroke(borderColor);
        
        doc.rect(40, currentY, 515, 24).fill('#FEF3C7');
        doc.fillColor('#92400E').fontSize(10).font('Helvetica-Bold').text('🏨  HOTEL ACCOMMODATION (Booking.com Partner)', 55, currentY + 7);
        doc.fillColor('#92400E').fontSize(9).font('Helvetica-Bold').text(`★ ${booking.hotel.starRating} Stars (${booking.hotel.reviewScore}/10)`, 400, currentY + 7);

        const hY = currentY + 34;
        doc.fillColor(darkText).fontSize(12).font('Helvetica-Bold').text(booking.hotel.name, 55, hY);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(booking.hotel.address, 55, hY + 16);
        doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold').text(`Room: ${booking.hotel.roomType}`, 55, hY + 32);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Bed: ${booking.hotel.bedConfig} • Breakfast Included: ${booking.hotel.breakfastIncluded ? 'Yes' : 'No'}`, 55, hY + 46);

        doc.fillColor(lightText).fontSize(8).font('Helvetica-Bold').text('STAY DURATION', 410, hY);
        doc.fillColor(darkText).fontSize(10).font('Helvetica-Bold').text(`${booking.hotel.totalNights} Nights`, 410, hY + 14);
        doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold').text(`$${booking.hotel.totalPrice} USD`, 410, hY + 32);
        doc.fillColor(successColor).fontSize(7).font('Helvetica-Bold').text('Free Cancellation', 410, hY + 48);

        currentY += 125;
      }

      // --- Section 3: Transfer Details ---
      if (booking.cab) {
        doc.rect(40, currentY, 515, 80).fill(cardBg).stroke(borderColor);
        
        doc.rect(40, currentY, 515, 24).fill('#EDE9FE');
        doc.fillColor('#5B21B6').fontSize(10).font('Helvetica-Bold').text('🚕  AIRPORT TRANSFER / CAB RESERVATION', 55, currentY + 7);
        doc.fillColor('#5B21B6').fontSize(9).font('Helvetica-Bold').text(`Driver Rating: ★ ${booking.cab.driverRating}`, 400, currentY + 7);

        const cY = currentY + 34;
        doc.fillColor(darkText).fontSize(10).font('Helvetica-Bold').text(booking.cab.vehicleType, 55, cY);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Model: ${booking.cab.vehicleModel} • Max ${booking.cab.capacity} Passengers / ${booking.cab.luggageCount} Bags`, 55, cY + 14);
        doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Pickup: ${booking.cab.pickupLocation} ➔ ${booking.cab.dropoffLocation}`, 55, cY + 28);

        doc.fillColor(darkText).fontSize(11).font('Helvetica-Bold').text(`$${booking.cab.price} USD`, 410, cY + 14);

        currentY += 95;
      }

      // --- Section 4: Cost Breakdown & Billing ---
      doc.rect(40, currentY, 515, 80).fill('#F1F5F9').stroke(borderColor);
      
      doc.fillColor(darkText).fontSize(10).font('Helvetica-Bold').text('PAYMENT & SUMMARY', 55, currentY + 12);
      doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Subtotal: $${booking.subtotal.toFixed(2)}`, 55, currentY + 30);
      doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Taxes & Mandatory Fees (12%): $${booking.taxesAndFees.toFixed(2)}`, 55, currentY + 44);
      doc.fillColor(lightText).fontSize(8).font('Helvetica').text(`Order Token: ${booking.orderToken}`, 55, currentY + 58);

      doc.fillColor(lightText).fontSize(9).font('Helvetica-Bold').text('TOTAL AMOUNT PAID', 380, currentY + 18);
      doc.fillColor(accentColor).fontSize(18).font('Helvetica-Bold').text(`$${booking.totalCost.toFixed(2)} USD`, 380, currentY + 35);
      doc.fillColor(successColor).fontSize(8).font('Helvetica-Bold').text('✔ Verified Framework Checkout', 380, currentY + 58);

      currentY += 95;

      // --- Footer ---
      doc.fillColor(lightText)
         .fontSize(7)
         .font('Helvetica')
         .text('This document serves as an electronic confirmation. For customer support or flight boarding assistance, present this voucher alongside a valid government-issued photo ID at airport and hotel check-in desks.', 40, currentY, { width: 515, align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        resolve(`/tickets/${filename}`);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    });
  }
}

export const pdfTicketGenerator = new PDFTicketGenerator();
