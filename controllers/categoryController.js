import db from "../database/database.js";

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const [categories] = await db.query(
      `SELECT c.category_id, c.category_name, c.description, c.created_at, 
              COUNT(e.event_id) as event_count
       FROM category c
       LEFT JOIN event e ON c.category_id = e.category_id AND e.approval_status = 'approved'
       GROUP BY c.category_id
       ORDER BY c.category_id`
    );
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

// Get single category
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [category] = await db.query(
      "SELECT category_id, category_name, description FROM category WHERE category_id = ?",
      [id]
    );
    
    if (category.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }
    
    res.json(category[0]);
  } catch (err) {
    console.error("Error fetching category:", err);
    res.status(500).json({ message: "Failed to fetch category" });
  }
};

// Add new category
export const addCategory = async (req, res) => {
  try {
    const { category_name, description } = req.body;

    if (!category_name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check if category already exists
    const [existing] = await db.query(
      "SELECT * FROM category WHERE category_name = ?",
      [category_name]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Category already exists" });
    }

    // Add new category
    const result = await db.query(
      "INSERT INTO category (category_name, description) VALUES (?, ?)",
      [category_name, description || null]
    );

    res.status(201).json({
      success: true,
      message: "Category added successfully",
      category_id: result[0].insertId,
      category_name,
      description
    });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ message: "Failed to add category" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, description } = req.body;

    if (!category_name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const [existing] = await db.query(
      "SELECT * FROM category WHERE category_id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    const [duplicate] = await db.query(
      "SELECT * FROM category WHERE category_name = ? AND category_id != ?",
      [category_name, id]
    );

    if (duplicate.length > 0) {
      return res.status(400).json({ message: "Another category with the same name already exists" });
    }

    await db.query(
      "UPDATE category SET category_name = ?, description = ? WHERE category_id = ?",
      [category_name, description || null, id]
    );

    res.status(200).json({ success: true, message: "Category updated successfully" });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ message: "Failed to update category" });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT * FROM category WHERE category_id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    await db.query("DELETE FROM category WHERE category_id = ?", [id]);

    res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ message: "Failed to delete category" });
  }
};
