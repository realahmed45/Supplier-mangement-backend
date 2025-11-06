const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    sparse: true, // Allows multiple null values but unique non-null values
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  deviceInfo: {
    type: String,
    default: "",
  },
  lastTokenIssued: {
    type: Date,
    default: null,
  },
  // Profile information
  profilePicture: {
    type: String,
    default: "",
  },
  companyName: {
    type: String,
    default: "",
  },
  contactPerson: {
    type: String,
    default: "",
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: { type: String, default: "Indonesia" },
  },
  website: String,
  taxId: String,

  // Business Information
  businessType: [
    {
      type: String,
      enum: ["Manufacturer", "Wholesaler", "Distributor", "Importer", "Other"],
    },
  ],
  yearsInBusiness: Number,

  // Supplier Information - Reference to supplier document
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    default: null,
  },

  // Status
  profileCompleted: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better performance
userSchema.index({ phone: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
