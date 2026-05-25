const mongoose = require("mongoose");

async function connectDatabase() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn("MONGO_URI not set. Running with in-memory map state only.");
    return;
  }

  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGO_DB_NAME || "indoor_navigation",
  });
  console.log("MongoDB connected");
}

module.exports = { connectDatabase };
