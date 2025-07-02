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
  businessType: [
    {
      type: String,
      enum: ["Manufacturer", "Wholesaler", "Distributor", "Importer", "Other"],
    },
  ],
  yearsInBusiness: Number,

  // Product Information
  products: [
    {
      brandName: String,
      name: String,
      category: {
        type: String,
        enum: ["Cement", "Other"],
      },
      description: String,
      minOrderQuantity: Number,
      price: Number,
      unit: String,
      availableQuantity: {
        type: String,
        enum: ["1kg", "2kg", "5kg", "10kg", "20kg", "25kg", "40kg", "50kg"],
      },
      leadTime: String, // e.g., "2-4 weeks"
    },
  ],

  // Warehouse Information
  warehouses: [
    {
      warehouseName: String,
      location: String,
      handlingCapacity: Number, // units per day
    },
  ],

  // Logistics
  shippingMethods: [
    {
      type: String,
      enum: [
        "Air Freight",
        "Sea Freight",
        "Land Transport",
        "Express Delivery",
        "Standard Delivery",
      ],
    },
  ],
  deliveryAreas: [
    {
      type: String,
      enum: ["Seminyak", "Bali"],
    },
  ],

  // Payment Terms
  paymentTerms: [
    {
      type: String,
      enum: [
        "Net 30",
        "Net 60",
        "Advance Payment",
        "Cash on Delivery",
        "Other",
      ],
    },
  ],
  preferredCurrency: {
    type: String,
    default: "IDR",
  },

  // Document Verification
  documents: [
    {
      documentId: String,
      documentImage: String, // base64 string
      description: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

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
