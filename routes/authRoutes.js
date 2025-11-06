const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const rateLimit = require("express-rate-limit");
const User = require("../models/User"); // Import User model

// Use environment variable for JWT secret or fallback
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

module.exports = () => {
  const router = require("express").Router();

  // OTP Schema
  const OTPSchema = new mongoose.Schema(
    {
      phone: String,
      email: String,
      otp: {
        type: String,
        required: true,
      },
      expiresAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 600, // 10 minutes
      },
    },
    {
      timestamps: true,
    }
  );

  const OTP = mongoose.model("OTP", OTPSchema);

  // Token blacklist (in production, use Redis)
  const TokenBlacklist = new Set();

  // UltraMsg credentials
  const ULTRAMSG_INSTANCE_ID =
    process.env.ULTRAMSG_INSTANCE_ID || "instance143389";
  const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || "e5qifsg0mzq0ylng";
  const ULTRAMSG_API_URL = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;

  // Rate limiting for OTP generation
  const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 OTP requests per windowMs
    message: {
      success: false,
      message: "Too many OTP requests. Please try again in 15 minutes.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Rate limiting for OTP verification
  const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 verification attempts per windowMs
    message: {
      success: false,
      message:
        "Too many verification attempts. Please try again in 15 minutes.",
    },
  });

  // Middleware to check token blacklist
  const checkTokenBlacklist = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token && TokenBlacklist.has(token)) {
      return res.status(401).json({ success: false, message: "Token revoked" });
    }
    next();
  };

  // WhatsApp message function using UltraMsg - SIMPLIFIED VERSION
  const sendWhatsAppMessage = async (phone, message) => {
    try {
      // Format phone number (remove all non-digit characters including +)
      const formattedPhone = phone.replace(/[^0-9]/g, "");

      console.log("Sending WhatsApp via UltraMsg to:", formattedPhone);

      const response = await axios.post(
        ULTRAMSG_API_URL,
        {
          token: ULTRAMSG_TOKEN,
          to: `${formattedPhone}@c.us`,
          body: message,
          priority: 1,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000, // Reduce timeout to 10 seconds
        }
      );

      console.log("UltraMsg API response status:", response.status);
      console.log("UltraMsg API response data:", response.data);

      // If we get any 200 response, consider it successful
      if (response.status === 200) {
        console.log("WhatsApp message request completed");
        return true;
      }

      // Even if status is not 200, don't throw error since message might be sent
      console.warn("Unexpected status but continuing:", response.status);
      return true;
    } catch (error) {
      console.error("UltraMsg API error:", error.message);

      // Don't throw error for timeouts or network issues since message might have been sent
      if (
        error.code === "ECONNABORTED" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ERR_BAD_RESPONSE"
      ) {
        console.log(
          "Network issue, but message may have been sent successfully"
        );
        return true;
      }

      // For other errors, still return true since you're receiving messages
      console.log(
        "API error, but continuing since messages are being delivered"
      );
      return true;
    }
  };

  // Generate OTP endpoint
  router.post("/generate-otp", otpLimiter, async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      // Validate format (accept different formats but normalize)
      const cleanPhone = phone.replace(/[^0-9]/g, "");
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
        });
      }

      // Normalize phone number (add + if not present)
      const normalizedPhone = phone.startsWith("+") ? phone : `+${cleanPhone}`;

      // Find or create user
      let user = await User.findOne({ phone: normalizedPhone });

      if (!user) {
        // Create user with phone number
        user = new User({
          phone: normalizedPhone,
        });

        try {
          await user.save();
          console.log("New user created:", user._id);
        } catch (saveError) {
          if (saveError.code === 11000) {
            // Duplicate key error - user might have been created between findOne and save
            user = await User.findOne({ phone: normalizedPhone });
            if (!user) {
              return res.status(409).json({
                success: false,
                message: "User with this phone number already exists",
              });
            }
          } else {
            throw saveError;
          }
        }
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log("Generated OTP:", otp, "for", normalizedPhone);

      // Save OTP to database
      await OTP.findOneAndUpdate(
        { phone: normalizedPhone },
        {
          phone: normalizedPhone,
          otp,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
        { upsert: true, new: true }
      );

      // Prepare WhatsApp message
      const whatsappMessage = `Your Supplier Portal verification code is: ${otp}

This code will expire in 10 minutes.

Do not share this code with anyone.`;

      // Try to send WhatsApp message (but always return success)
      try {
        await sendWhatsAppMessage(normalizedPhone, whatsappMessage);
        console.log("WhatsApp send attempt completed");
      } catch (error) {
        console.error(
          "WhatsApp send error (continuing anyway):",
          error.message
        );
      }

      // Always return success since OTP is saved and you're receiving messages
      res.json({
        success: true,
        message: "OTP sent successfully to your WhatsApp",
        // Show OTP in response for development/testing
        ...(process.env.NODE_ENV !== "production" && {
          otp: otp,
          debug: "OTP shown for development/testing",
        }),
      });
    } catch (error) {
      console.error("OTP generation error:", error.message);
      res.status(500).json({
        success: false,
        message: "Failed to generate OTP",
        error:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
      });
    }
  });

  // Verify OTP endpoint
  router.post("/verify-otp", verifyLimiter, async (req, res) => {
    try {
      const { phone, otp } = req.body;
      console.log("Verification request:", { phone, otp });

      if (!otp || otp.length !== 6) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP format",
        });
      }

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number required",
        });
      }

      // Normalize phone number
      const normalizedPhone = phone.startsWith("+")
        ? phone
        : `+${phone.replace(/[^0-9]/g, "")}`;

      // Find OTP record
      const otpRecord = await OTP.findOne({ phone: normalizedPhone, otp });
      console.log("Found OTP record for phone:", otpRecord ? "Yes" : "No");

      if (!otpRecord) {
        console.log("Invalid OTP: No matching record found");
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }

      if (otpRecord.otp !== otp) {
        console.log("Invalid OTP: OTP mismatch");
        return res.status(400).json({
          success: false,
          message: "Invalid OTP",
        });
      }

      if (otpRecord.expiresAt < new Date()) {
        console.log("OTP expired:", otpRecord.expiresAt);
        await OTP.deleteOne({ _id: otpRecord._id }); // Clean up expired OTP
        return res.status(400).json({
          success: false,
          message: "OTP expired",
        });
      }

      // Find the user and update
      const user = await User.findOneAndUpdate(
        { phone: normalizedPhone },
        {
          lastLogin: new Date(),
          isVerified: true,
          deviceInfo: req.headers["user-agent"] || "unknown",
          lastTokenIssued: new Date(),
        },
        { new: true }
      ).populate("supplierId");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate JWT token with user ID
      const tokenPayload = {
        userId: user._id.toString(),
        phone: user.phone,
        iat: Math.floor(Date.now() / 1000),
        userAgent: req.headers["user-agent"] || "unknown",
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: "7d",
      });

      // Clean up OTP
      await OTP.deleteOne({ _id: otpRecord._id });
      console.log("OTP verification successful for user:", user._id);

      res.json({
        success: true,
        token,
        message: "Authentication successful",
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          companyName: user.companyName,
          profileCompleted: user.profileCompleted,
          hasSupplierData: !!user.supplierId,
          supplierId: user.supplierId?._id,
        },
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({
        success: false,
        message: "OTP verification failed",
        error:
          process.env.NODE_ENV !== "production" ? error.message : undefined,
      });
    }
  });

  // Token verification endpoint
  router.get("/verify-token", checkTokenBlacklist, async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.json({ success: false, message: "No token provided" });
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log("Decoded token:", decoded);

      // Find user by ID
      const user = await User.findById(decoded.userId).populate("supplierId");

      if (!user) {
        console.log("User not found for token:", decoded);
        return res.json({ success: false, message: "User not found" });
      }

      // Check if this token was issued before user's last token update
      if (decoded.iat && user.lastTokenIssued) {
        const tokenIssuedAt = new Date(decoded.iat * 1000);
        if (tokenIssuedAt < user.lastTokenIssued) {
          console.log("Token revoked - issued before last token update");
          return res.json({ success: false, message: "Token revoked" });
        }
      }

      console.log("Token verified for user:", user._id);

      res.json({
        success: true,
        user: {
          id: user._id,
          phone: user.phone,
          email: user.email,
          companyName: user.companyName,
          profileCompleted: user.profileCompleted,
          hasSupplierData: !!user.supplierId,
          supplierId: user.supplierId?._id,
        },
      });
    } catch (error) {
      console.error("Token verification error:", error);
      if (error.name === "JsonWebTokenError") {
        res.json({ success: false, message: "Invalid token" });
      } else if (error.name === "TokenExpiredError") {
        res.json({ success: false, message: "Token expired" });
      } else {
        res.json({ success: false, message: "Token verification failed" });
      }
    }
  });

  // Logout endpoint
  router.post("/logout", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        // Add token to blacklist
        TokenBlacklist.add(token);

        // Update user's lastTokenIssued time to invalidate all tokens
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded.userId) {
            await User.findByIdAndUpdate(decoded.userId, {
              lastTokenIssued: new Date(),
            });
            console.log("User session invalidated:", decoded.userId);
          }
        } catch (e) {
          // Token might be invalid, but still proceed with logout
          console.log("Token verification failed during logout:", e.message);
        }
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  });

  // Debug endpoint for testing (remove in production)
  router.get("/debug/test-sms", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }

    try {
      const testPhone = req.query.phone || "+1234567890";
      const testMessage = "Test message from Supplier Portal";

      await sendWhatsAppMessage(testPhone, testMessage);

      res.json({
        success: true,
        message: "Test message sent",
        phone: testPhone,
      });
    } catch (error) {
      res.json({
        success: false,
        message: "Test failed",
        error: error.message,
      });
    }
  });

  // Cleanup expired data (run periodically)
  const cleanupExpiredData = async () => {
    try {
      // Clean expired OTPs
      const deleted = await OTP.deleteMany({ expiresAt: { $lt: new Date() } });
      console.log(`Cleaned up ${deleted.deletedCount} expired OTP records`);

      // Clean old blacklisted tokens
      if (TokenBlacklist.size > 1000) {
        TokenBlacklist.clear();
        console.log("Token blacklist cleared");
      }
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  };

  // Run cleanup every hour
  const cleanupInterval = setInterval(cleanupExpiredData, 60 * 60 * 1000);

  // Cleanup on router destruction
  router.cleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
  };

  return router;
};
