require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME }).then(async () => {
  const types = await mongoose.connection.collection('cartypes').find({}).toArray();
  const typeIds = types.map(t => t._id);
  await mongoose.connection.collection('drivers').updateOne(
    { approvalStatus: 'approved' },
    { $set: { carTypeExperience: typeIds, 'location.coordinates': [75.87195989251666, 22.717587961123773] } }
  );
  console.log('Driver updated');
  process.exit(0);
});
