import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import WebFaq from '../models/webFaq.model.js';

const INITIAL_FAQS = [
  {
    question: 'How do I book a driver?',
    answer: 'You can book a driver easily through our mobile app or website. Select your service type (hourly, monthly, or outstation), pick your vehicle type, choose a date/time, and we will assign a verified professional driver to you.',
    sortOrder: 0,
  },
  {
    question: 'Are your drivers verified?',
    answer: 'Yes, all our driver partners undergo strict background screening, identity verification, and driving test evaluations before they are onboarded onto our platform.',
    sortOrder: 1,
  },
  {
    question: 'What are the payment options?',
    answer: 'We accept all major credit/debit cards, UPI, net banking, and digital wallets. Payments can be processed securely through our platform.',
    sortOrder: 2,
  },
  {
    question: 'what is the salary of searchmydrivers driver partner per month',
    answer: 'Our driver partners earn competitive monthly payouts based on their completed bookings, working hours, and rating. Average earnings range from ₹18,000 to ₹35,000 per month depending on slab settings and performance bonuses.',
    sortOrder: 3,
  },
];

const seedFaqsIfNeeded = async () => {
  const count = await WebFaq.countDocuments();
  if (count === 0) {
    await WebFaq.create(INITIAL_FAQS);
    console.log('[seeder] Dynamic website FAQs seeded successfully');
  }
};

export const adminListFaqs = asyncHandler(async (req, res) => {
  await seedFaqsIfNeeded();
  const faqs = await WebFaq.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
  return res.status(200).json(new ApiResponse(200, faqs, 'FAQs fetched successfully'));
});

export const adminCreateFaq = asyncHandler(async (req, res) => {
  const { question, answer, sortOrder, isActive } = req.body;
  if (!question || !answer) {
    throw new ApiError(400, 'Question and Answer are required');
  }

  const faq = await WebFaq.create({
    question,
    answer,
    sortOrder: Number(sortOrder) || 0,
    isActive: isActive !== false,
  });

  return res.status(201).json(new ApiResponse(201, faq, 'FAQ created successfully'));
});

export const adminUpdateFaq = asyncHandler(async (req, res) => {
  const { question, answer, sortOrder, isActive } = req.body;
  const faq = await WebFaq.findById(req.params.id);
  if (!faq) {
    throw new ApiError(404, 'FAQ not found');
  }

  faq.question = question ?? faq.question;
  faq.answer = answer ?? faq.answer;
  faq.sortOrder = sortOrder !== undefined ? Number(sortOrder) : faq.sortOrder;
  faq.isActive = isActive !== undefined ? isActive : faq.isActive;

  await faq.save();

  return res.status(200).json(new ApiResponse(200, faq, 'FAQ updated successfully'));
});

export const adminDeleteFaq = asyncHandler(async (req, res) => {
  const faq = await WebFaq.findById(req.params.id);
  if (!faq) {
    throw new ApiError(404, 'FAQ not found');
  }

  await faq.deleteOne();
  return res.status(200).json(new ApiResponse(200, null, 'FAQ deleted successfully'));
});

export const listActiveFaqs = asyncHandler(async (req, res) => {
  await seedFaqsIfNeeded();
  const faqs = await WebFaq.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
  return res.status(200).json(new ApiResponse(200, faqs, 'Active FAQs fetched successfully'));
});
