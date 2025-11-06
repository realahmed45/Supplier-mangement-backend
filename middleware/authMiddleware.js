const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

// Log JWT secret for debugging (first 10 chars only)
console.log(
  "Auth middleware JWT_SECRET (first 10 chars):",
  JWT_SECRET.substring(0, 10) + "..."
);

exports.authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Auth header:", authHeader ? "Present" : "Missing");

    const token = authHeader?.split(" ")[1];
    console.log("Token extracted:", token ? "Yes" : "No");

    if (!token) {
      console.log("No token provided in request");
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    console.log("Verifying token with JWT_SECRET...");
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Token decoded successfully, userId:", decoded.userId);

    // Find user
    const user = await User.findById(decoded.userId).populate("supplierId");
    console.log("User found:", user ? "Yes" : "No");

    if (!user) {
      console.log("User not found for decoded userId:", decoded.userId);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if token was issued before user's last token update (only if explicitly revoked)
    if (decoded.iat && user.lastTokenIssued) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      console.log("Token issued at:", tokenIssuedAt);
      console.log("User last token issued:", user.lastTokenIssued);

      // Only revoke if the difference is more than 1 minute (to avoid timing issues)
      const timeDifferenceMs =
        user.lastTokenIssued.getTime() - tokenIssuedAt.getTime();
      if (timeDifferenceMs > 60000) {
        // 1 minute buffer
        console.log(
          "Token revoked - issued before last token update with significant time difference"
        );
        return res.status(401).json({
          success: false,
          message: "Token revoked",
        });
      }
    }

    console.log("Authentication successful for user:", user._id);
    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error.name, error.message);

    if (error.name === "JsonWebTokenError") {
      console.log("JWT Error - Invalid token format or signature");
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    } else if (error.name === "TokenExpiredError") {
      console.log("JWT Error - Token expired");
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    console.log("Unknown authentication error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// Optional middleware to get user if token exists (doesn't fail if no token)
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).populate("supplierId");

    if (user) {
      // Check token validity
      if (decoded.iat && user.lastTokenIssued) {
        const tokenIssuedAt = new Date(decoded.iat * 1000);
        if (tokenIssuedAt >= user.lastTokenIssued) {
          req.user = user;
        } else {
          req.user = null;
        }
      } else {
        req.user = user;
      }
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
