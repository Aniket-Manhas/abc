require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('Admin@123', salt);

    // Verify hash works BEFORE saving
    const verifyOk = await bcrypt.compare('Admin@123', hash);
    console.log('Hash verification test:', verifyOk ? 'PASS' : 'FAIL');

    // Use direct collection update to bypass any middleware
    const col = mongoose.connection.collection('users');
    const existing = await col.findOne({ email: 'admin@sahyatri.com' });

    if (existing) {
      await col.updateOne(
        { email: 'admin@sahyatri.com' },
        { $set: { password: hash, role: 'admin', name: 'Station Admin' } }
      );
      console.log('Admin password updated directly in DB');
    } else {
      await col.insertOne({
        name: 'Station Admin',
        email: 'admin@sahyatri.com',
        password: hash,
        role: 'admin',
        phone: '',
        preferences: { accessibilityMode: 'none', avoidStairs: false, preferLift: false, language: 'en', highContrast: false, largeText: false },
        lastLocation: { nodeId: null, lat: null, lng: null, updatedAt: null },
        isActive: true,
        createdAt: new Date()
      });
      console.log('Admin user created directly in DB');
    }

    // Verify final state
    const adminUser = await col.findOne({ email: 'admin@sahyatri.com' });
    const finalVerify = await bcrypt.compare('Admin@123', adminUser.password);
    console.log('Final verification - Admin@123 matches stored hash:', finalVerify ? 'YES' : 'NO');
    console.log('Admin role:', adminUser.role);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seed();
