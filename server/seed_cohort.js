const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const { ensureCaregiverDemoCohort } = require('./services/demoCohortService');

dotenv.config();

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reminiscence';

const main = async () => {
  await mongoose.connect(mongoUri);

  const caregivers = await User.find({ role: 'caregiver' }).select('_id name email').lean();
  if (!caregivers.length) {
    throw new Error('No caregiver users found. Create/login a caregiver first.');
  }

  let totalCreated = 0;

  for (const caregiver of caregivers) {
    const result = await ensureCaregiverDemoCohort({
      _id: caregiver._id,
      name: caregiver.name || 'Caregiver'
    });

    totalCreated += (result.created || []).length;
    console.log(`[cohort] ${caregiver.name || caregiver.email}: existing=${(result.existing || []).length} created=${(result.created || []).length}`);
    for (const patient of result.created || []) {
      console.log(`  + ${patient.name} (${patient.currentState})`);
    }
  }

  console.log(`[cohort] done. total created=${totalCreated}`);
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
