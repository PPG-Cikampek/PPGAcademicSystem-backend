const express = require('express');

const academicYearController = require('../controllers/academicYears-controller')

const router = express.Router();

router.get('/', academicYearController.getAcademicYears)
router.get('/active/', academicYearController.getActiveAcademicYear)
router.get('/:academicYearId', academicYearController.getAcademicYearById)


// router.get('/:userId', usersController.getUsersById);

router.post('/', academicYearController.createAcademicYear);
router.post('/activate/:academicYearId', academicYearController.activateAcademicYear);

router.delete('/:academicYearId', academicYearController.deleteAcademicYear);

router.patch('/:academicYearId', academicYearController.updateAcademicYear);
router.patch('/start/:academicYearId/munaqasyah', academicYearController.startAcademicYearMunaqasyah);

// router.post('/signup', usersController.signup);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 