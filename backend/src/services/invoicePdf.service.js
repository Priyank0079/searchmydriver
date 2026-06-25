import PDFDocument from 'pdfkit';
import Booking from '../models/booking.model.js';
import { ApiError } from '../utils/apiError.js';
import { SERVICE_TYPE_LABELS } from '../constants/serviceTypes.js';

const PALETTE = {
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  accent: '#FBBF24', // SpareDriver Yellow
  danger: '#DC2626',
  success: '#16A34A',
};

function fmtDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN');
  } catch {
    return '—';
  }
}

function formatCurrency(val) {
  if (val == null) return '—';
  return `Rs. ${Number(val).toFixed(2)}`;
}

export async function buildBookingInvoicePdf(bookingId, { res } = {}) {
  const booking = await Booking.findById(bookingId)
    .populate('userId', 'name phone email')
    .populate('driverId', 'name phone')
    .lean();

  if (!booking) throw new ApiError(404, 'Booking not found');

  const invoiceNumber = booking.invoiceNumber || booking.bookingNumber || bookingId;
  const createdAt = booking.timeline?.completedAt || booking.timeline?.createdAt || booking.createdAt;
  const dateStr = fmtDateTime(createdAt);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Invoice ${invoiceNumber}`,
      Author: 'SpareDriver',
      Subject: `Invoice for Trip ${invoiceNumber}`,
    },
  });

  if (res) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoiceNumber}.pdf"`);
    doc.pipe(res);
  }

  // Header
  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor(PALETTE.text)
    .text('SPAREDRIVER', 50, 50);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(PALETTE.muted)
    .text('Your Car, Our Professional Driver.', 50, 80);

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(PALETTE.text)
    .text('INVOICE', 400, 50, { align: 'right' });
    
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(PALETTE.muted)
    .text(`Invoice #: ${invoiceNumber}`, 400, 75, { align: 'right' })
    .text(`Date: ${dateStr}`, 400, 90, { align: 'right' });

  doc.moveDown(3);

  // Bill To & Driver
  const yDetails = doc.y;
  
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PALETTE.text)
    .text('Billed To:', 50, yDetails);
  
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(PALETTE.muted)
    .text(booking.userId?.name || 'Customer', 50, yDetails + 15)
    .text(booking.userId?.phone ? `+91 ${booking.userId.phone}` : '', 50, yDetails + 30)
    .text(booking.userId?.email || '', 50, yDetails + 45);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PALETTE.text)
    .text('Trip Details:', 300, yDetails);

  const serviceName = SERVICE_TYPE_LABELS[booking.serviceType] || booking.serviceType;
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(PALETTE.muted)
    .text(`Service: ${serviceName}`, 300, yDetails + 15)
    .text(`Driver: ${booking.driverId?.name || 'Unassigned'}`, 300, yDetails + 30)
    .text(`Pickup: ${booking.pickup?.address || '—'}`, 300, yDetails + 45, { width: 250, ellipsis: true });

  doc.y = yDetails + 75;

  // Fare Breakdown Table
  doc.moveDown(2);
  const tableTop = doc.y;
  const col1 = 50;
  const col2 = 400;

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(PALETTE.text)
    .text('Description', col1, tableTop)
    .text('Amount', col2, tableTop, { width: 100, align: 'right' });

  doc
    .moveTo(50, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .lineWidth(1)
    .strokeColor(PALETTE.border)
    .stroke();

  let yRow = tableTop + 25;

  const addRow = (label, amount, isBold = false) => {
    doc
      .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10)
      .fillColor(isBold ? PALETTE.text : PALETTE.muted)
      .text(label, col1, yRow)
      .text(formatCurrency(amount), col2, yRow, { width: 100, align: 'right' });
    yRow += 20;
  };

  const base = booking.fareSnapshot?.baseFare || 0;
  const extras = booking.fareSnapshot?.extras || 0;
  const serviceCharge = booking.fareSnapshot?.serviceCharge || 0;
  const gst = booking.fareSnapshot?.gst || 0;
  const discount = booking.fareSnapshot?.discount || 0;
  const initialTotal = booking.fareSnapshot?.total || 0;

  addRow('Base Fare', base);
  if (extras > 0) addRow('Driver Allowance (Food/Stay)', extras);
  if (serviceCharge > 0) addRow('Service Charge', serviceCharge);
  if (gst > 0) addRow('GST (18%)', gst);
  if (discount > 0) addRow('Discount', -discount);

  // Extensions
  const extensions = (booking.extensions || []).filter(e => e.status === 'accepted');
  let extTotal = 0;
  if (extensions.length > 0) {
    extensions.forEach((ext, i) => {
      const amt = Number(ext.fareDelta) || 0;
      extTotal += amt;
      addRow(`Trip Extension ${i + 1}`, amt);
    });
  }

  const finalTotal = initialTotal + extTotal;

  doc
    .moveTo(50, yRow + 5)
    .lineTo(550, yRow + 5)
    .lineWidth(1)
    .strokeColor(PALETTE.border)
    .stroke();

  yRow += 15;
  
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(PALETTE.text)
    .text('Total', col1, yRow)
    .text(formatCurrency(finalTotal), col2, yRow, { width: 100, align: 'right' });

  // Footer
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(PALETTE.muted)
    .text('Thank you for choosing SpareDriver.', 50, doc.page.height - 100, { align: 'center', width: 500 })
    .text('For support, contact support@sparedriver.com', 50, doc.page.height - 85, { align: 'center', width: 500 });

  doc.end();
  return doc;
}
