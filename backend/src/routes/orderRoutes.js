const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');

const {
  createOrder,
  getMyOrders,
  getReceivedOrders,
  updateOrderStatus
} = require('../controllers/orderController');

router.post('/', authMiddleware, createOrder);
router.get('/my', authMiddleware, getMyOrders);
router.get('/received', authMiddleware, getReceivedOrders);
router.put('/:id/status', authMiddleware, updateOrderStatus);

module.exports = router;