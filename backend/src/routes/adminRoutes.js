const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

const {
  getUsers,
  deleteUser,
  getProducts,
  deleteProduct,
  getStats
} = require('../controllers/adminController');

router.get('/stats', authMiddleware, adminMiddleware, getStats);

router.get('/users', authMiddleware, adminMiddleware, getUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, deleteUser);

router.get('/products', authMiddleware, adminMiddleware, getProducts);
router.delete('/products/:id', authMiddleware, adminMiddleware, deleteProduct);

module.exports = router;