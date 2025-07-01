const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema({
  // Profile Information
  profilePicture: {
    type: String,
    default: "",
  },
  companyName: {
    type: String,
    required: true,
  },
  contactPerson: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  website: String,
  taxId: String,

  // Business Information
  businessType: {
    type: String,
    enum: ["Manufacturer", "Wholesaler", "Distributor", "Other"],
  },
  yearsInBusiness: Number,
  certifications: [String],

  // Product Information
  products: [
    {
      name: String,
      category: String,
      description: String,
      minOrderQuantity: Number,
      price: Number,
      unit: String,
      availableQuantity: Number,
      leadTime: String, // e.g., "2-4 weeks"
    },
  ],

  // Warehouse Information
  warehouses: [
    {
      location: String,
      size: Number, // in sq ft
      capacity: Number, // in units
      handlingCapacity: Number, // units per day
    },
  ],

  // Logistics
  shippingMethods: [String],
  deliveryAreas: [String],

  // Payment Terms
  paymentTerms: {
    type: String,
    enum: ["Net 30", "Net 60", "Advance Payment", "Other"],
  },
  preferredCurrency: String,

  // Status
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

supplierSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Supplier", supplierSchema);
