const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticateJWT, checkRole } = require("../middleware/authMiddleware");

const JWT_SECRET = "your_jwt_secret_key_here"; // replace with env in prod

// Register route
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "Username already exists" });

    const user = new User({ username, password, role });
    await user.save();

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login route
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user
router.get("/me", authenticateJWT, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    role: req.user.role,
  });
});

// ✅ Single GET all users route (protected, only admins)
router.get("/", authenticateJWT, checkRole(["admin"]), async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch(
  "/:id",
  authenticateJWT,
  checkRole(["admin"]),
  async (req, res) => {
    try {
      const { username, newPassword, adminPassword } = req.body;

      // Verify admin's own password first
      const admin = await User.findById(req.user.id);
      const isMatch = await admin.comparePassword(adminPassword);
      if (!isMatch)
        return res.status(401).json({ message: "Invalid admin password" });

      const updateData = {};
      if (username) updateData.username = username;
      if (newPassword) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(newPassword, salt);
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select("-password");
      if (!updatedUser)
        return res.status(404).json({ message: "User not found" });

      res.json(updatedUser);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

module.exports = router;
