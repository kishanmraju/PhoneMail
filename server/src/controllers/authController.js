const User = require("../models/User");
const jwt = require("jsonwebtoken");


// ==========================================
// NORMALIZE PHONE NUMBER
// ==========================================

const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) {
    return null;
  }

  let phone = String(phoneNumber).replace(
    /\D/g,
    ""
  );

  // Convert 91XXXXXXXXXX -> XXXXXXXXXX
  if (
    phone.length === 12 &&
    phone.startsWith("91")
  ) {
    phone = phone.slice(2);
  }

  // Only accept Indian 10-digit numbers
  if (phone.length !== 10) {
    return null;
  }

  return phone;
};


// ==========================================
// VERIFY MSG91 ACCESS TOKEN
// ==========================================

const verifyMsg91Token = async (
  req,
  res
) => {
  try {
    const phoneNumber =
      normalizePhoneNumber(
        req.body.phoneNumber
      );

    const accessToken =
      String(
        req.body.accessToken || ""
      ).trim();


    // ======================================
    // VALIDATION
    // ======================================

    if (!phoneNumber) {
      return res.status(400).json({
        message:
          "Valid phone number is required"
      });
    }

    if (!accessToken) {
      return res.status(400).json({
        message:
          "MSG91 access token is required"
      });
    }

    if (!process.env.MSG91_AUTHKEY) {
      console.error(
        "MSG91_AUTHKEY is missing from server .env"
      );

      return res.status(500).json({
        message:
          "MSG91 is not configured on server"
      });
    }


    // ======================================
    // VERIFY TOKEN WITH MSG91
    // ======================================

    const response =
      await fetch(
        "https://control.msg91.com/api/v5/widget/verifyAccessToken",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json"
          },

          body: JSON.stringify({
            authkey:
              process.env.MSG91_AUTHKEY,

            "access-token":
              accessToken
          })
        }
      );


    const data =
      await response.json();


    console.log(
      "MSG91 access token verification:",
      data
    );


    // ======================================
    // MSG91 REJECTED TOKEN
    // ======================================

    if (
      !response.ok ||
      data?.type === "error"
    ) {
      return res.status(401).json({
        message:
          data?.message ||
          "MSG91 access token verification failed"
      });
    }


    // ======================================
    // FIND USER
    // ======================================

    let user =
      await User.findOne({
        phoneNumber
      });


    // ======================================
    // CREATE ACCOUNT IF NEW
    // ======================================

    if (!user) {
      user =
        await User.create({
          phoneNumber,

          emailId:
            `${phoneNumber}@phonemail.com`
        });
    }


    // ======================================
    // CREATE PHONEMAIL JWT
    // ======================================

    const token =
      jwt.sign(
        {
          userId:
            user._id,

          phoneNumber:
            user.phoneNumber
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

        id:
          user._id,

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
      "MSG91 verification error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to verify MSG91 access token"
    });
  }
};


module.exports = {
  verifyMsg91Token
};