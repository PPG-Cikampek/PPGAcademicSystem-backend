const express = require('express');

const teachersController = require('../controllers/teachers-controller')
const fileUpload = require('../middlewares/file-upload')

const router = express.Router();

router.get('/', teachersController.getTeachers)
router.get('/:teacherId', teachersController.getTeacherById)
router.get('/teaching-group/:teachingGroupId', teachersController.getTeachersByTeachingGroupId)
router.get('/user/:userId', teachersController.getTeacherByUserId)

// router.post('/signup', usersController.signup);

router.patch('/', fileUpload.single('image'), teachersController.updateTeacher)


// router.delete('/:userId', usersController.deleteUser);


module.exports = router; 