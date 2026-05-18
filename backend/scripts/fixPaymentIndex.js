/**
 * One-time fix for E11000 on payments.razorpayPaymentId empty strings.
 * Run: node scripts/fixPaymentIndex.js (from backend folder)
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('payments');

  const unset = await col.updateMany(
    { $or: [{ razorpayPaymentId: '' }, { razorpayPaymentId: null }] },
    { $unset: { razorpayPaymentId: '', razorpaySignature: '' } },
  );
  console.log('Unset empty razorpayPaymentId on', unset.modifiedCount, 'documents');

  try {
    await col.dropIndex('razorpayPaymentId_1');
    console.log('Dropped old razorpayPaymentId_1 index');
  } catch (e) {
    console.log('Index drop skipped:', e.message);
  }

  await col.createIndex(
    { razorpayPaymentId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        razorpayPaymentId: { $exists: true, $type: 'string', $gt: '' },
      },
    },
  );
  console.log('Created partial unique index on razorpayPaymentId');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
