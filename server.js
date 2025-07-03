const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const supplierRoutes = require("./routes/supplierRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const path = require("path");

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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

    // Create initial users if they don't exist
    const User = require("./models/userModel");
    const roles = ["admin", "viewer", "user"];

    for (const role of roles) {
      const user = await User.findOne({ username: role });
      if (!user) {
        const newUser = new User({
          username: role,
          password: `${role}123`, // Will be hashed by pre-save hook
          role: role,
        });
        await newUser.save();
        console.log(`Default ${role} user created`);
      }
    }
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/suppliers", supplierRoutes);
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
