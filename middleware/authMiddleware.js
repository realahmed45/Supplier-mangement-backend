const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

const JWT_SECRET = "your_jwt_secret_key_here";

exports.authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Failed to authenticate token" });
    }

    try {
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Error finding user" });
    }
  });
};

// Modified to handle multiple roles
exports.checkRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Insufficient permissions" });
  }
  next();
};
