const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { authenticateJWT, checkRole } = require("../middleware/authMiddleware");

// Get all users (admin only)
router.get("/", authenticateJWT, checkRole("admin"), async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user (admin only)
router.patch("/:id", authenticateJWT, checkRole("admin"), async (req, res) => {
  try {
    const { username, newPassword, adminPassword } = req.body;

    // Verify admin password first
    const admin = await User.findById(req.user.id);
    const isMatch = await admin.comparePassword(adminPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid admin password" });
    }

    const updateData = {};
    if (username) updateData.username = username;
    if (newPassword) {
      // Hash the new password before saving
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
module.exports = router;
