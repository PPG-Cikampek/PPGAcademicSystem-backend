const express = require('express');

const teachersController = require('../controllers/teachers-controller')
const fileUpload = require('../middlewares/file-upload')

const router = express.Router();

router.get('/', teachersController.getTeachers)
router.get('/:teacherId', teachersController.getTeacherById)
router.get('/branch/:branchId', teachersController.getTeachersByBranchId)
router.get('/sub-branch/:subBranchId', teachersController.getTeachersBySubBranchId)
router.get('/user/:userId', teachersController.getTeacherByUserId)

// router.post('/signup', usersController.signup);

router.patch('/', fileUpload.single('image'), teachersController.updateTeacher)


// router.delete('/:userId', usersController.deleteUser);


module.exports = router; 