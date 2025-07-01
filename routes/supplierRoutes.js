const express = require("express");
const router = express.Router();
const Supplier = require("../models/supplierModel");
const multer = require("multer");

// Configure multer for memory storage (base64)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Helper function to convert buffer to base64
const bufferToBase64 = (buffer, mimetype) => {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
};

// Create/Update supplier profile
router.post("/", upload.single("profilePicture"), async (req, res) => {
  try {
    const supplierData = {
      ...req.body,
      address: req.body.address ? JSON.parse(req.body.address) : undefined,
      status: "Pending",
    };

    // Convert uploaded image to base64
    if (req.file) {
      supplierData.profilePicture = bufferToBase64(
        req.file.buffer,
        req.file.mimetype
      );
    }

    let supplier = await Supplier.findOne({ email: supplierData.email });
    if (supplier) {
      supplier = await Supplier.findOneAndUpdate(
        { email: supplierData.email },
        supplierData,
        { new: true }
      );
    } else {
      supplier = new Supplier(supplierData);
      await supplier.save();
    }

    res.status(201).json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Business Details Routes
router.patch("/:id/business", async (req, res) => {
  try {
    const { id } = req.params;
    const businessData = req.body;

    const validBusinessTypes = [
      "Manufacturer",
      "Wholesaler",
      "Distributor",
      "Other",
    ];
    const validPaymentTerms = ["Net 30", "Net 60", "Advance Payment", "Other"];

    if (
      businessData.businessType &&
      !validBusinessTypes.includes(businessData.businessType)
    ) {
      return res.status(400).json({ message: "Invalid business type" });
    }

    if (
      businessData.paymentTerms &&
      !validPaymentTerms.includes(businessData.paymentTerms)
    ) {
      return res.status(400).json({ message: "Invalid payment terms" });
    }

    // Parse arrays safely
    const updateData = {
      ...businessData,
      certifications: Array.isArray(businessData.certifications)
        ? businessData.certifications
        : JSON.parse(businessData.certifications || "[]"),
      products: Array.isArray(businessData.products)
        ? businessData.products
        : JSON.parse(businessData.products || "[]"),
      warehouses: Array.isArray(businessData.warehouses)
        ? businessData.warehouses
        : JSON.parse(businessData.warehouses || "[]"),
      shippingMethods: Array.isArray(businessData.shippingMethods)
        ? businessData.shippingMethods
        : JSON.parse(businessData.shippingMethods || "[]"),
      deliveryAreas: Array.isArray(businessData.deliveryAreas)
        ? businessData.deliveryAreas
        : JSON.parse(businessData.deliveryAreas || "[]"),
    };

    const updatedSupplier = await Supplier.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(updatedSupplier);
  } catch (error) {
    console.error("Error updating business details:", error);
    res.status(400).json({
      message: error.message,
      details: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
});

// Get all suppliers
router.get("/", async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single supplier
router.get("/:id", async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update supplier (with optional image upload)
router.patch("/:id", upload.single("profilePicture"), async (req, res) => {
  try {
    const supplierData = req.body;

    // Convert new uploaded image to base64
    if (req.file) {
      supplierData.profilePicture = bufferToBase64(
        req.file.buffer,
        req.file.mimetype
      );
    }

    // Parse JSON strings
    if (typeof supplierData.products === "string") {
      supplierData.products = JSON.parse(supplierData.products);
    }
    if (typeof supplierData.warehouses === "string") {
      supplierData.warehouses = JSON.parse(supplierData.warehouses);
    }
    if (typeof supplierData.address === "string") {
      supplierData.address = JSON.parse(supplierData.address);
    }

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      supplierData,
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update supplier status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete supplier
router.delete("/:id", async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    res.json({ message: "Supplier deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
