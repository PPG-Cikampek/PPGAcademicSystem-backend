const express = require('express');

const dashboardController = require('../controllers/dashboard-controller')
const checkAuth = require('../middlewares/check-auth')

const router = express.Router();

// router.post('/signup', usersController.signup);

// router.delete('/:userId', usersController.deleteUser);

router.post('/', checkAuth, dashboardController.getDashboardData)


module.exports = router; 