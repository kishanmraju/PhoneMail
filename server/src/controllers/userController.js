const User = require("../models/User");


// ==========================================
// GET MY PROFILE
// ==========================================

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      user
    });

  } catch (error) {
    console.error("Get user error:", error);

    res.status(500).json({
      message: "Failed to fetch user"
    });
  }
};


// ==========================================
// UPDATE MY PROFILE
// ==========================================

const updateMe = async (req, res) => {
  try {
    const { name } = req.body;

    if (name === undefined) {
      return res.status(400).json({
        message: "Name is required"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        name: name.trim()
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user
    });

  } catch (error) {
    console.error("Update user error:", error);

    res.status(500).json({
      message: "Failed to update profile"
    });
  }
};


// ==========================================
// SEARCH USER
// ==========================================

const searchUser = async (req, res) => {
  try {
    let { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required"
      });
    }

    // Remove spaces and common formatting
    phoneNumber = phoneNumber.replace(/\D/g, "");

    // If user enters +91XXXXXXXXXX,
    // this converts it to XXXXXXXXXX
    if (phoneNumber.length === 12 && phoneNumber.startsWith("91")) {
      phoneNumber = phoneNumber.slice(2);
    }

    if (phoneNumber.length !== 10) {
      return res.status(400).json({
        message: "Enter a valid 10-digit phone number"
      });
    }

    const user = await User.findOne(
      {
        phoneNumber
      },
      {
        phoneNumber: 1,
        emailId: 1,
        name: 1,
        profilePicture: 1
      }
    );

    if (!user) {
      return res.status(404).json({
        message: "PhoneMail user not found"
      });
    }

    res.status(200).json({
      user
    });

  } catch (error) {
    console.error("Search user error:", error);

    res.status(500).json({
      message: "Failed to search user"
    });
  }
};


module.exports = { getMe, updateMe, searchUser };