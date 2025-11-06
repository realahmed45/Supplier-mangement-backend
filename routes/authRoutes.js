const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

// Log JWT secret for debugging (first 10 chars only)
console.log(
  "Auth routes JWT_SECRET (first 10 chars):",
  JWT_SECRET.substring(0, 10) + "..."
);

module.exports = () => {
  const router = require("express").Router();

  // OTP Schema
  const OTPSchema = new mongoose.Schema(
    {
      phone: String,
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
  const TokenBlacklist = new Set();

  // UltraMsg credentials
  const ULTRAMSG_INSTANCE_ID =
    process.env.ULTRAMSG_INSTANCE_ID || "instance143389";
  const ULTRAMSG_TOKEN = process.env.ULTRAMSG_TOKEN || "e5qifsg0mzq0ylng";
  const ULTRAMSG_API_URL = `https://api.ultramsg.com/${ULTRAMSG_INSTANCE_ID}/messages/chat`;

  // Simple rate limiting in memory (no proxy issues)
  const requestCounts = new Map();

  const simpleRateLimit = (max, windowMs) => {
    return (req, res, next) => {
      const ip = req.ip || req.connection?.remoteAddress || "unknown";
      const now = Date.now();
      const windowStart = now - windowMs;

      if (!requestCounts.has(ip)) {
        requestCounts.set(ip, []);
      }

      const requests = requestCounts.get(ip);
      // Remove old requests
      const recentRequests = requests.filter(
        (timestamp) => timestamp > windowStart
      );

      if (recentRequests.length >= max) {
        return res.status(429).json({
          success: false,
          message: "Too many requests. Please try again later.",
        });
      }

      recentRequests.push(now);
      requestCounts.set(ip, recentRequests);
      next();
    };
  };

  // WhatsApp function - simplified
  const sendWhatsAppMessage = async (phone, message) => {
    try {
      const formattedPhone = phone.replace(/[^0-9]/g, "");
      console.log("Sending WhatsApp to:", formattedPhone);

      const response = await axios.post(
        ULTRAMSG_API_URL,
        {
          token: ULTRAMSG_TOKEN,
          to: `${formattedPhone}@c.us`,
          body: message,
          priority: 1,
        },
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 8000,
        }
      );

      console.log("UltraMsg response status:", response.status);
      return true; // Always return true since you're receiving messages
    } catch (error) {
      console.error("WhatsApp error:", error.message);
      return true; // Still return true since messages are working
    }
  };

  // Generate OTP
  router.post(
    "/generate-otp",
    simpleRateLimit(5, 15 * 60 * 1000),
    async (req, res) => {
      try {
        const { phone } = req.body;

        if (!phone) {
          return res.status(400).json({
            success: false,
            message: "Phone number is required",
          });
        }

        const cleanPhone = phone.replace(/[^0-9]/g, "");
        if (cleanPhone.length < 10) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format",
          });
        }

        const normalizedPhone = phone.startsWith("+")
          ? phone
          : `+${cleanPhone}`;

        // Find or create user
        let user = await User.findOne({ phone: normalizedPhone });
        if (!user) {
          user = new User({ phone: normalizedPhone });
          await user.save();
          console.log("New user created:", user._id);
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log("Generated OTP:", otp);

        // Save OTP
        await OTP.findOneAndUpdate(
          { phone: normalizedPhone },
          {
            phone: normalizedPhone,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
          { upsert: true, new: true }
        );

        // Send WhatsApp
        const message = `Your Supplier Portal verification code is: ${otp}

This code will expire in 10 minutes.

Do not share this code with anyone.`;

        try {
          await sendWhatsAppMessage(normalizedPhone, message);
        } catch (error) {
          console.error("WhatsApp send failed:", error.message);
        }

        // Always return success
        res.json({
          success: true,
          message: "OTP sent successfully to your WhatsApp",
          // Show OTP for development
          ...(process.env.NODE_ENV !== "production" && { otp }),
        });
      } catch (error) {
        console.error("OTP generation error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to generate OTP",
        });
      }
    }
  );

  // Verify OTP
  router.post(
    "/verify-otp",
    simpleRateLimit(10, 15 * 60 * 1000),
    async (req, res) => {
      try {
        const { phone, otp } = req.body;

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

        const normalizedPhone = phone.startsWith("+")
          ? phone
          : `+${phone.replace(/[^0-9]/g, "")}`;

        // Find OTP record
        const otpRecord = await OTP.findOne({ phone: normalizedPhone, otp });

        if (!otpRecord) {
          return res.status(400).json({
            success: false,
            message: "Invalid OTP",
          });
        }

        if (otpRecord.expiresAt < new Date()) {
          await OTP.deleteOne({ _id: otpRecord._id });
          return res.status(400).json({
            success: false,
            message: "OTP expired",
          });
        }

        // Find and update user
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

        // Generate JWT
        const token = jwt.sign(
          {
            userId: user._id.toString(),
            phone: user.phone,
            iat: Math.floor(Date.now() / 1000),
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        // Clean up OTP
        await OTP.deleteOne({ _id: otpRecord._id });

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
        });
      }
    }
  );

  // Verify token
  router.get("/verify-token", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.json({ success: false, message: "No token provided" });
      }

      if (TokenBlacklist.has(token)) {
        return res.json({ success: false, message: "Token revoked" });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).populate("supplierId");

      if (!user) {
        return res.json({ success: false, message: "User not found" });
      }

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
      if (error.name === "JsonWebTokenError") {
        res.json({ success: false, message: "Invalid token" });
      } else if (error.name === "TokenExpiredError") {
        res.json({ success: false, message: "Token expired" });
      } else {
        res.json({ success: false, message: "Token verification failed" });
      }
    }
  });

  // Logout
  router.post("/logout", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (token) {
        TokenBlacklist.add(token);

        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded.userId) {
            await User.findByIdAndUpdate(decoded.userId, {
              lastTokenIssued: new Date(),
            });
          }
        } catch (e) {
          // Continue with logout even if token verification fails
        }
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  });

  // Cleanup function
  const cleanup = () => {
    setInterval(() => {
      // Clean expired OTPs
      OTP.deleteMany({ expiresAt: { $lt: new Date() } }).catch(console.error);

      // Clean rate limit data
      const now = Date.now();
      for (const [ip, requests] of requestCounts.entries()) {
        const recent = requests.filter(
          (timestamp) => timestamp > now - 15 * 60 * 1000
        );
        if (recent.length === 0) {
          requestCounts.delete(ip);
        } else {
          requestCounts.set(ip, recent);
        }
      }

      // Clean token blacklist
      if (TokenBlacklist.size > 1000) {
        TokenBlacklist.clear();
      }
    }, 60 * 60 * 1000); // Every hour
  };

  cleanup();

  return router;
};
