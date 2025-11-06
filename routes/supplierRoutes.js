const express = require("express");
const router = express.Router();
const Supplier = require("../models/supplierModel");
const User = require("../models/User");
const multer = require("multer");
const { authenticateUser } = require("../middleware/authMiddleware");

// Configure multer for memory storage (base64)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and document files are allowed"), false);
    }
  },
});

// Helper function to convert buffer to base64
const bufferToBase64 = (buffer, mimetype) => {
  return `data:${mimetype};base64,${buffer.toString("base64")}`;
};

// Debug endpoint to test authentication
router.get("/debug/auth-test", authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Authentication working",
      user: {
        id: req.user._id,
        phone: req.user.phone,
        email: req.user.email,
        hasSupplier: !!req.user.supplierId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Debug test failed",
      error: error.message,
    });
  }
});

// Get user's supplier data
router.get("/my-supplier", authenticateUser, async (req, res) => {
  try {
    let supplier = null;

    if (req.user.supplierId) {
      supplier = await Supplier.findById(req.user.supplierId);
    }

    res.json({
      success: true,
      user: {
        id: req.user._id,
        phone: req.user.phone,
        email: req.user.email,
        companyName: req.user.companyName,
        contactPerson: req.user.contactPerson,
        profilePicture: req.user.profilePicture,
        address: req.user.address,
        website: req.user.website,
        taxId: req.user.taxId,
        businessType: req.user.businessType,
        yearsInBusiness: req.user.yearsInBusiness,
        profileCompleted: req.user.profileCompleted,
      },
      supplier: supplier,
      hasSupplierData: !!supplier,
    });
  } catch (error) {
    console.error("Error fetching supplier data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier data",
    });
  }
});

// Create or update supplier profile
router.post(
  "/",
  authenticateUser,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      console.log("Creating supplier for user:", req.user._id);

      const userId = req.user._id;
      const supplierData = {
        ...req.body,
        address: req.body.address ? JSON.parse(req.body.address) : undefined,
        status: "Pending",
      };

      // Update user data
      const userData = {
        email: supplierData.email,
        companyName: supplierData.companyName,
        contactPerson: supplierData.contactPerson,
        website: supplierData.website,
        taxId: supplierData.taxId,
        address: supplierData.address,
        profileCompleted: true,
      };

      if (req.file) {
        supplierData.profilePicture = bufferToBase64(
          req.file.buffer,
          req.file.mimetype
        );
        userData.profilePicture = supplierData.profilePicture;
      }

      let supplier;

      if (req.user.supplierId) {
        console.log("Updating existing supplier:", req.user.supplierId);
        // Update existing supplier
        supplier = await Supplier.findByIdAndUpdate(
          req.user.supplierId,
          supplierData,
          { new: true }
        );

        // Update user record
        await User.findByIdAndUpdate(userId, userData);
      } else {
        console.log("Creating new supplier");
        // Create new supplier
        supplier = new Supplier(supplierData);
        await supplier.save();

        console.log("New supplier created with ID:", supplier._id);

        // Link supplier to user and update user data
        userData.supplierId = supplier._id;
        await User.findByIdAndUpdate(userId, userData);

        console.log("User updated with supplier ID:", supplier._id);
      }

      res.status(201).json({
        success: true,
        supplier: supplier,
        message: "Supplier profile saved successfully",
      });
    } catch (error) {
      console.error("Error saving supplier:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Update supplier business details
router.patch("/:id/business", authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const businessData = req.body;

    console.log("Business update request for supplier:", id);
    console.log("Request user supplierId:", req.user.supplierId?.toString());
    console.log("Target supplier ID:", id);

    // ENHANCED OWNERSHIP VERIFICATION
    // Check if user owns this supplier OR if this is a newly created supplier
    const isOwner = req.user.supplierId?.toString() === id;

    if (!isOwner) {
      // Additional check: Is this supplier associated with this user's phone?
      const supplier = await Supplier.findById(id);
      const phoneMatch = supplier && supplier.phone === req.user.phone;

      if (!phoneMatch) {
        console.log("Access denied - not owner and phone doesn't match");
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only edit your own supplier data.",
        });
      } else {
        console.log("Access granted via phone match");
        // Update user's supplierId if this supplier belongs to them
        await User.findByIdAndUpdate(req.user._id, { supplierId: id });
      }
    } else {
      console.log("Access granted - user is owner");
    }

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

    // Validate arrays
    if (businessData.businessType && Array.isArray(businessData.businessType)) {
      const invalidTypes = businessData.businessType.filter(
        (type) => !validBusinessTypes.includes(type)
      );
      if (invalidTypes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid business types: ${invalidTypes.join(", ")}`,
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

    console.log("Updating supplier with business data...");
    const updatedSupplier = await Supplier.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    // Update user business info too
    await User.findByIdAndUpdate(req.user._id, {
      businessType: updateData.businessType,
      yearsInBusiness: updateData.yearsInBusiness,
      supplierId: id, // Ensure user has the correct supplierId
    });

    console.log("Business data updated successfully");

    res.json({
      success: true,
      supplier: updatedSupplier,
      message: "Business details updated successfully",
    });
  } catch (error) {
    console.error("Error updating business details:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

// Document upload route
router.post(
  "/:id/documents",
  authenticateUser,
  upload.single("documentImage"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { documentId, description } = req.body;

      // Enhanced ownership verification
      const isOwner = req.user.supplierId?.toString() === id;
      if (!isOwner) {
        const supplier = await Supplier.findById(id);
        const phoneMatch = supplier && supplier.phone === req.user.phone;

        if (!phoneMatch) {
          return res.status(403).json({
            success: false,
            message: "Access denied",
          });
        }
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Document image is required",
        });
      }

      const documentData = {
        documentId,
        documentImage: bufferToBase64(req.file.buffer, req.file.mimetype),
        description,
        uploadedAt: new Date(),
      };

      const supplier = await Supplier.findById(id);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found",
        });
      }

      supplier.documents.push(documentData);
      await supplier.save();

      res.json({
        success: true,
        supplier: supplier,
        message: "Document uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Delete document route
router.delete(
  "/:id/documents/:documentIndex",
  authenticateUser,
  async (req, res) => {
    try {
      const { id, documentIndex } = req.params;

      // Enhanced ownership verification
      const isOwner = req.user.supplierId?.toString() === id;
      if (!isOwner) {
        const supplier = await Supplier.findById(id);
        const phoneMatch = supplier && supplier.phone === req.user.phone;

        if (!phoneMatch) {
          return res.status(403).json({
            success: false,
            message: "Access denied",
          });
        }
      }

      const supplier = await Supplier.findById(id);
      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier not found",
        });
      }

      if (documentIndex >= supplier.documents.length) {
        return res.status(404).json({
          success: false,
          message: "Document not found",
        });
      }

      supplier.documents.splice(documentIndex, 1);
      await supplier.save();

      res.json({
        success: true,
        supplier: supplier,
        message: "Document deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Update supplier profile (general info)
router.patch(
  "/profile",
  authenticateUser,
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const profileData = req.body;

      // Update user data
      const userData = {
        email: profileData.email,
        companyName: profileData.companyName,
        contactPerson: profileData.contactPerson,
        website: profileData.website,
        taxId: profileData.taxId,
        address: profileData.address
          ? JSON.parse(profileData.address)
          : req.user.address,
      };

      if (req.file) {
        userData.profilePicture = bufferToBase64(
          req.file.buffer,
          req.file.mimetype
        );
        profileData.profilePicture = userData.profilePicture;
      }

      // Update user
      const updatedUser = await User.findByIdAndUpdate(userId, userData, {
        new: true,
      });

      // Update supplier if exists
      if (req.user.supplierId) {
        await Supplier.findByIdAndUpdate(req.user.supplierId, {
          companyName: profileData.companyName,
          contactPerson: profileData.contactPerson,
          email: profileData.email,
          website: profileData.website,
          taxId: profileData.taxId,
          address: userData.address,
          profilePicture: userData.profilePicture,
        });
      }

      res.json({
        success: true,
        user: {
          id: updatedUser._id,
          phone: updatedUser.phone,
          email: updatedUser.email,
          companyName: updatedUser.companyName,
          contactPerson: updatedUser.contactPerson,
          profilePicture: updatedUser.profilePicture,
          address: updatedUser.address,
          website: updatedUser.website,
          taxId: updatedUser.taxId,
        },
        message: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;
