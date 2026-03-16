const mongoose = require("mongoose");
const User = require("./models/userModel");

const MONGO_URI = "mongodb+srv://chatbiz50_db_user:dtorU38nkLmTNdy8@cluster0.ehikyfh.mongodb.net/?appName=Cluster0";

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB for seeding.");

    // Check if the user already exists
    const existingUser = await User.findOne({ username: "user" });
    if (existingUser) {
      console.log("Admin user already exists. Updating password and role...");
      existingUser.password = "user12";
      existingUser.role = "admin";
      await existingUser.save();
      console.log("Admin user updated successfully.");
    } else {
      console.log("Creating new admin user...");
      const newAdmin = new User({
        username: "user",
        password: "user12",
        role: "admin",
      });
      await newAdmin.save();
      console.log("Admin user created successfully.");
    }

  } catch (err) {
    console.error("Error seeding admin user:", err);
  } finally {
    mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
};

seedAdmin();
