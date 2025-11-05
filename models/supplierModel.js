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

  // Product Information - Updated with category system
  products: [
    {
      category: {
        type: String,
        required: true,
      },
      subcategory: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      brandName: {
        type: String,
        required: true,
      },
      selectedSize: {
        type: String,
        required: true,
      },
      description: String,
      minOrderQuantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      unit: {
        type: String,
        enum: ["piece", "kg", "liter", "box", "pack"],
        required: true,
      },
      availableQuantity: String,
      leadTime: String,
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
