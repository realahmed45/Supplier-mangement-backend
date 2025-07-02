const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const supplierRoutes = require("./routes/supplierRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const path = require("path");

const app = express();

// Middleware - Configure CORS to allow all origins
app.use(
  cors({
    origin: "*", // Allow all origins
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  })
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://realahmedali4:xRiW3NB6an59MdD9@cluster0.zmlydbn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(async () => {
    console.log("Connected to MongoDB");

    // Create initial admin user if doesn't exist
    const User = require("./models/userModel");
    const adminUser = await User.findOne({ username: "admin" });
    if (!adminUser) {
      const user = new User({
        username: "admin",
        password: "admin123", // Will be hashed by pre-save hook
        role: "admin",
      });
      await user.save();
      console.log("Default admin user created");
    }

    const viewerUser = await User.findOne({ username: "viewer" });
    if (!viewerUser) {
      const user = new User({
        username: "viewer",
        password: "viewer123", // Will be hashed by pre-save hook
        role: "viewer",
      });
      await user.save();
      console.log("Default viewer user created");
    }
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
// Add these near your other routes

app.use("/api/users", userRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
