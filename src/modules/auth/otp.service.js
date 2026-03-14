const OTP = require("./otp.model");

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

/**
 * Generate and store an OTP for a phone number.
 * In production, integrate with an SMS provider (Twilio, MSG91, etc.).
 *
 * @param {string} phone - The user's phone number
 * @returns {Promise<string>} The generated OTP (for dev/testing only)
 */
const generateOtp = async (phone) => {
  // Remove any existing OTP for this phone
  await OTP.deleteMany({ phone });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const otp = await OTP.create({
    phone,
    otp: code,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    attempts: 0
  });

  // TODO: Send OTP via SMS provider
  // await smsProvider.send(phone, `Your OTP is ${code}`);

  return otp;
};

/**
 * Verify an OTP for a phone number.
 *
 * @param {string} phone - The user's phone number
 * @param {string} code  - The OTP code to verify
 * @returns {Promise<{ valid: boolean, message: string }>}
 */
const verifyOtp = async (phone, code) => {
  const record = await OTP.findOne({ phone }).sort({ createdAt: -1 });

  if (!record) {
    return { valid: false, message: "No OTP found. Please request a new one." };
  }

  if (record.expiresAt < new Date()) {
    await OTP.deleteOne({ _id: record._id });
    return { valid: false, message: "OTP has expired. Please request a new one." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await OTP.deleteOne({ _id: record._id });
    return { valid: false, message: "Too many attempts. Please request a new OTP." };
  }

  if (record.otp !== code) {
    record.attempts += 1;
    await record.save();
    return { valid: false, message: "Invalid OTP." };
  }

  // OTP is valid — clean up
  await OTP.deleteOne({ _id: record._id });
  return { valid: true, message: "OTP verified successfully." };
};

module.exports = {
  generateOtp,
  verifyOtp
};
