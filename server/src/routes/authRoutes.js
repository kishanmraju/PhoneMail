const express = require("express");

const {
  verifyMsg91Token
} = require("../controllers/authController");

const router = express.Router();

router.post(
  "/verify-msg91-token",
  verifyMsg91Token
);

module.exports = router;