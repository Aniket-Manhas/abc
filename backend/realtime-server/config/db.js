const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.warn(
        `⚠️  MONGODB_URI not set. Running without database (in-memory state only).`,
      );
      return false;
    }
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`⚠️  MongoDB Connection Error: ${error.message}`);
    console.warn(`⚠️  Continuing without database. Running in fallback mode.`);
    return false;
  }
};

module.exports = connectDB;
