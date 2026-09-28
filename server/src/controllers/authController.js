const OTP = require("../models/OTP");
const User = require("../models/User");
const jwt = require("jsonwebtoken");


// ==========================================
// NORMALIZE PHONE NUMBER
// ==========================================

const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) {
    return null;
  }

  let phone = phoneNumber.replace(/\D/g, "");

  // Convert +91XXXXXXXXXX → XXXXXXXXXX
  if (phone.length === 12 && phone.startsWith("91")) {
    phone = phone.slice(2);
  }

  // Only accept Indian 10-digit numbers
  if (phone.length !== 10) {
    return null;
  }

  return phone;
};


// ==========================================
// SEND OTP
// ==========================================

const sendOTP = async (req, res) => {
  try {
    const phoneNumber = normalizePhoneNumber(
      req.body.phoneNumber
    );

    if (!phoneNumber) {
      return res.status(400).json({
        message: "Enter a valid 10-digit phone number"
      });
    }


    // Delete previous OTPs for this number
    await OTP.deleteMany({
      phoneNumber
    });


    // Generate 6-digit OTP
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();


    // OTP expires in 5 minutes
    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );


    await OTP.create({
      phoneNumber,
      otp,
      expiresAt
    });


    // TEMPORARY FOR DEVELOPMENT
    console.log(
      `OTP for ${phoneNumber}: ${otp}`
    );


    res.status(200).json({
      message: "OTP sent successfully"
    });

  } catch (error) {
    console.error(
      "Send OTP error:",
      error
    );

    res.status(500).json({
      message: "Failed to send OTP"
    });
  }
};


// ==========================================
// VERIFY OTP
// ==========================================

const verifyOTP = async (req, res) => {
  try {
    const phoneNumber = normalizePhoneNumber(
      req.body.phoneNumber
    );

    const { otp } = req.body;


    if (!phoneNumber || !otp) {
      return res.status(400).json({
        message:
          "Phone number and OTP are required"
      });
    }


    // Find latest OTP
    const otpRecord = await OTP.findOne({
      phoneNumber
    }).sort({
      createdAt: -1
    });


    if (!otpRecord) {
      return res.status(400).json({
        message: "OTP not found"
      });
    }


    // Check expiry
    if (
      new Date() >
      otpRecord.expiresAt
    ) {

      await OTP.deleteOne({
        _id: otpRecord._id
      });

      return res.status(400).json({
        message: "OTP has expired"
      });
    }


    // Check OTP
    if (otpRecord.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP"
      });
    }

    await OTP.deleteOne({
      _id: otpRecord._id
    });


    // ======================================
    // OTP IS VALID
    // ======================================

    let user = await User.findOne({
      phoneNumber
    });


    // Create account if first login
    if (!user) {
      user = await User.create({
        phoneNumber,
        emailId:
          `${phoneNumber}@phonemail.com`
      });
    }


    // ======================================
    // DELETE USED OTP
    // ======================================

    await OTP.deleteOne({
      _id: otpRecord._id
    });


    // ======================================
    // CREATE JWT
    // ======================================

    const token = jwt.sign(
      {
        userId: user._id,
        phoneNumber: user.phoneNumber
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );


    // ======================================
    // RESPONSE
    // ======================================

    return res.status(200).json({
      message:
        "OTP verified successfully",

      token,

      user: {
        id: user._id,
        phoneNumber:
          user.phoneNumber,
        emailId:
          user.emailId,
        name:
          user.name || "",
        profilePicture:
          user.profilePicture || ""
      }
    });

  } catch (error) {
    console.error(
      "Verify OTP error:",
      error
    );

    res.status(500).json({
      message: "Failed to verify OTP"
    });
  }
};


module.exports = { sendOTP, verifyOTP };