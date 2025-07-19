const express = require('express');

const academicYearController = require('../controllers/academicYears-controller')

const router = express.Router();

router.get('/', academicYearController.getAcademicYears)
router.get('/active/', academicYearController.getActiveAcademicYear)
router.get('/:academicYearId', academicYearController.getAcademicYearById)
router.get('/munaqasyah/packages/', academicYearController.getMunaqasyahPackages)


// router.get('/:userId', usersController.getUsersById);

router.post('/', academicYearController.createAcademicYear);
router.post('/activate/:academicYearId', academicYearController.activateAcademicYear);

router.delete('/:academicYearId', academicYearController.deleteAcademicYear);

router.patch('/:academicYearId', academicYearController.updateAcademicYear);
router.patch('/munaqasyah/:academicYearId', academicYearController.patchAcademicYearMunaqasyahStatus);

// router.post('/signup', usersController.signup);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 