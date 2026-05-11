const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, default: '' },
  isEmailVerified: { type: Boolean, default: false },
  otp: { type: String, default: null },
  otpExpires: { type: Date, default: null },
  role: { type: String, enum: ['passenger', 'admin'], default: 'passenger' },
  preferences: {
    accessibilityMode: { type: String, enum: ['none', 'wheelchair', 'elderly', 'visually_impaired'], default: 'none' },
    avoidStairs: { type: Boolean, default: false },
    preferLift: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
    highContrast: { type: Boolean, default: false },
    largeText: { type: Boolean, default: false }
  },
  lastLocation: {
    nodeId: { type: String, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    updatedAt: { type: Date, default: null }
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
