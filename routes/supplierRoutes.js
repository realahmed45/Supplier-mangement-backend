const express = require("express");
const router = express.Router();
const Supplier = require("../models/supplierModel");
const multer = require("multer");
const { authenticateJWT, checkRole } = require("../middleware/authMiddleware");

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

router.post("/", upload.single("profilePicture"), async (req, res) => {
  try {
    const supplierData = {
      ...req.body,
      address: req.body.address ? JSON.parse(req.body.address) : undefined,
      status: "Pending",
    };

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

// Business Details Routes - Admin only
router.patch(
  "/:id/business",

  async (req, res) => {
    try {
      const { id } = req.params;
      const businessData = req.body;

      const validBusinessTypes = [
        "Manufacturer",
        "Wholesaler",
        "Distributor",
        "Importer",
        "Other",
      ];
      const validPaymentTerms = [
        "Net 30",
        "Net 60",
        "Advance Payment",
        "Cash on Delivery",
        "Other",
      ];
      const validShippingMethods = [
        "Air Freight",
        "Sea Freight",
        "Land Transport",
        "Express Delivery",
        "Standard Delivery",
      ];
      const validDeliveryAreas = ["Seminyak", "Bali"];

      // Validate business types
      if (
        businessData.businessType &&
        Array.isArray(businessData.businessType)
      ) {
        const invalidTypes = businessData.businessType.filter(
          (type) => !validBusinessTypes.includes(type)
        );
        if (invalidTypes.length > 0) {
          return res.status(400).json({
            message: `Invalid business types: ${invalidTypes.join(", ")}`,
          });
        }
      }

      // Validate payment terms
      if (
        businessData.paymentTerms &&
        Array.isArray(businessData.paymentTerms)
      ) {
        const invalidTerms = businessData.paymentTerms.filter(
          (term) => !validPaymentTerms.includes(term)
        );
        if (invalidTerms.length > 0) {
          return res.status(400).json({
            message: `Invalid payment terms: ${invalidTerms.join(", ")}`,
          });
        }
      }

      // Validate shipping methods
      if (
        businessData.shippingMethods &&
        Array.isArray(businessData.shippingMethods)
      ) {
        const invalidMethods = businessData.shippingMethods.filter(
          (method) => !validShippingMethods.includes(method)
        );
        if (invalidMethods.length > 0) {
          return res.status(400).json({
            message: `Invalid shipping methods: ${invalidMethods.join(", ")}`,
          });
        }
      }

      // Validate delivery areas
      if (
        businessData.deliveryAreas &&
        Array.isArray(businessData.deliveryAreas)
      ) {
        const invalidAreas = businessData.deliveryAreas.filter(
          (area) => !validDeliveryAreas.includes(area)
        );
        if (invalidAreas.length > 0) {
          return res.status(400).json({
            message: `Invalid delivery areas: ${invalidAreas.join(", ")}`,
          });
        }
      }

      // Parse arrays safely
      const updateData = {
        ...businessData,
        businessType: Array.isArray(businessData.businessType)
          ? businessData.businessType
          : JSON.parse(businessData.businessType || "[]"),
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
        paymentTerms: Array.isArray(businessData.paymentTerms)
          ? businessData.paymentTerms
          : JSON.parse(businessData.paymentTerms || "[]"),
        documents: Array.isArray(businessData.documents)
          ? businessData.documents
          : JSON.parse(businessData.documents || "[]"),
        preferredCurrency: "IDR",
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
        details:
          process.env.NODE_ENV !== "production" ? error.stack : undefined,
      });
    }
  }
);

// Document upload route - Admin only
router.post(
  "/:id/documents",

  upload.single("documentImage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { documentId, description } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "Document image is required" });
      }

      const documentData = {
        documentId,
        documentImage: bufferToBase64(req.file.buffer, req.file.mimetype),
        description,
        uploadedAt: new Date(),
      };

      const supplier = await Supplier.findById(id);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      supplier.documents.push(documentData);
      await supplier.save();

      res.json(supplier);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Delete document route - Admin only
router.delete(
  "/:id/documents/:documentIndex",

  async (req, res) => {
    try {
      const { id, documentIndex } = req.params;

      const supplier = await Supplier.findById(id);
      if (!supplier) {
        return res.status(404).json({ message: "Supplier not found" });
      }

      if (documentIndex >= supplier.documents.length) {
        return res.status(404).json({ message: "Document not found" });
      }

      supplier.documents.splice(documentIndex, 1);
      await supplier.save();

      res.json(supplier);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

// Get all suppliers - Both viewer and admin can access
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single supplier - Both viewer and admin can access
router.get("/:id", authenticateJWT, async (req, res) => {
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

// Update supplier - Admin only
router.patch(
  "/:id",
  authenticateJWT,
  checkRole("admin"),
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      const supplierData = req.body;

      if (req.file) {
        supplierData.profilePicture = bufferToBase64(
          req.file.buffer,
          req.file.mimetype
        );
      }

      if (typeof supplierData.products === "string") {
        supplierData.products = JSON.parse(supplierData.products);
      }
      if (typeof supplierData.warehouses === "string") {
        supplierData.warehouses = JSON.parse(supplierData.warehouses);
      }
      if (typeof supplierData.address === "string") {
        supplierData.address = JSON.parse(supplierData.address);
      }
      if (typeof supplierData.documents === "string") {
        supplierData.documents = JSON.parse(supplierData.documents);
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
  }
);

// Update supplier status - Both admin and user can access
router.patch(
  "/:id/status",
  authenticateJWT,
  checkRole(["admin", "user"]), // Changed to allow both roles
  async (req, res) => {
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
  }
);

// Delete supplier - Admin only
router.delete("/:id", authenticateJWT, checkRole("admin"), async (req, res) => {
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
