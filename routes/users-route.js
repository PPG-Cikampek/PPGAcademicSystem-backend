const express = require('express');
const fileUpload = require('../middlewares/file-upload')

const usersController = require('../controllers/users-controller');

const checkAuth = require('../middlewares/check-auth')

const router = express.Router();

router.get('/', usersController.getUsers);
router.get('/:userId', usersController.getUsersById);
router.get('/account-requests/:userId', usersController.getRequestedAccountsByUserId);
router.get('/account-requests/ticket/:ticketId', usersController.getRequestedAccountsByTicketId);


router.post('/request-verify-email', checkAuth, usersController.requestVerifyEmail);
router.get('/verify-email/:token', usersController.verifyEmail);


router.post('/change-password', checkAuth, usersController.changeUserPassword);

router.post('/login', usersController.login);

router.post('/request-reset-password', usersController.requestResetPassword);
router.post('/reset-password', usersController.resetPassword);


router.post('/createUser', checkAuth, usersController.createUser);
router.post('/requestAccounts', checkAuth, usersController.requestAccounts);

router.post('/bulk-create', checkAuth, usersController.bulkCreateUsersAndStudents);
router.post('/image-upload/:userId', fileUpload.single('image'), usersController.updateProfileImage);


router.patch('/:userId', checkAuth, usersController.updateUser);


router.delete('/bulk-delete', checkAuth, usersController.bulkDeleteUsers);

router.delete('/:userId', checkAuth, usersController.deleteUser);



module.exports = router;