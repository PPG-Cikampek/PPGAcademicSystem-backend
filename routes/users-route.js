const express = require('express');
const fileUpload = require('../middlewares/file-upload');

const usersController = require('../controllers/users-controller');

const checkAuth = require('../middlewares/check-auth');
const requireRole = require('../middlewares/require-role');

const router = express.Router();

// Public routes (no auth required)
router.get('/', usersController.getUsers);
router.get('/account-requests', usersController.getRequestedAccountsByUserId);
router.get('/:userId', usersController.getUsersById);
router.get('/account-requests/:userId', usersController.getRequestedAccountsByUserId);
router.get('/account-requests/ticket/:ticketId', usersController.getRequestedAccountsByTicketId);

// Protected routes with role guards
router.post('/createUser', checkAuth, requireRole('admin'), usersController.createUser);
router.post('/bulk-create', checkAuth, requireRole('admin'), usersController.bulkCreateUsersAndStudents);
router.post('/account-requests/approve-all', checkAuth, requireRole('admin'), usersController.approveAndCreateAllPendingTickets);
router.post('/requestAccounts', checkAuth, fileUpload.array('images', 50), usersController.requestAccounts);
router.post('/image-upload/:userId', fileUpload.single('image'), usersController.updateProfileImage);

router.patch('/:userId', checkAuth, usersController.updateUser);
router.patch('/account-requests/ticket', usersController.patchRequestedAccountsByTicketId);

router.delete('/bulk-delete', checkAuth, requireRole('admin'), usersController.bulkDeleteUsers);
router.delete('/:userId', checkAuth, requireRole('admin'), usersController.deleteUser);

module.exports = router;