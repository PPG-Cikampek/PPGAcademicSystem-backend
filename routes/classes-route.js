const express = require('express');

const classController = require('../controllers/classes-controller')

const router = express.Router();

router.get('/', classController.getClasses);
router.get('/:classId', classController.getClassById);
router.get('/teaching-group/:teachingGroupId', classController.getClassesByTeachingGroupId);
router.get('/teachingGroupYear/:teachingGroupYearId', classController.getClassesByTeachingGroupYearId);
router.get('/:classId/student/:studentId', classController.getClassAttendanceByIdAndStudentId);

// // router.get('/:userId', usersController.getUsersById);

router.post('/get-by-ids', classController.getClassesByIds);

router.post('/', classController.createClass);
router.post('/register-student', classController.registerStudentToClass);
router.post('/register-teacher', classController.registerTeacherToClass);

router.delete('/', classController.deleteClass);
router.delete('/remove-student', classController.removeStudentFromClass);
router.delete('/remove-teacher', classController.removeTeacherFromClass);

router.patch('/lock', classController.lockClassById);
router.patch('/unlock', classController.unlockClassById);



// router.post('/teachingGroup', levelsController.createTeachingGroup);


// // router.post('/signup', usersController.signup);

// // router.delete('/:userId', usersController.deleteUser);



module.exports = router; 