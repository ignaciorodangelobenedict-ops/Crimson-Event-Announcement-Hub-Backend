import express from "express";
import { getAllCategories, getCategoryById, addCategory, updateCategory, deleteCategory } from "../controllers/categoryController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all categories (public)
router.get("/", getAllCategories);

// Get single category (public)
router.get("/:id", getCategoryById);

// Add new category
router.post("/", verifyToken, addCategory);

// Update category
router.put("/:id", verifyToken, updateCategory);

// Delete category
router.delete("/:id", verifyToken, deleteCategory);

export default router;
