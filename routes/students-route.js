const express = require('express');

const studentsController = require('../controllers/students-controller')
const fileUpload = require('../middlewares/file-upload')

const router = express.Router();

router.get('/', studentsController.getStudents);
router.get('/:studentId', studentsController.getStudentById);
router.get('/login/:nis', studentsController.getStudentByNis);
router.get('/teaching-group/:teachingGroupId', studentsController.getStudentsByTeachingGroupId);
// router.get('/teachingGroupYear/:teachingGroupYearId', classController.getClassesByTeachingGroupYearId);

// // router.get('/:userId', usersController.getUsersById);

router.post('/', studentsController.createStudent);

router.patch('/:studentId', fileUpload.single('image'), studentsController.updateStudent);

// router.post('/teachingGroup', levelsController.createTeachingGroup);


// // router.post('/signup', usersController.signup);

// // router.delete('/:userId', usersController.deleteUser);



module.exports = router; 