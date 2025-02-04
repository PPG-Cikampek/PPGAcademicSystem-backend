const express = require('express');

const teachingGroupYearController = require('../controllers/teachingGroupYears-controllers')

const router = express.Router();

router.get('/', teachingGroupYearController.getTeachingGroupYears)
router.get('/:teachingGroupYearId', teachingGroupYearController.getTeachingGroupYearById)
router.get('/teachingGroup/:teachingGroupId', teachingGroupYearController.getTeachingGroupYearsByTeachingGroupId)
router.get('/teaching-group/:teachingGroupId/academic-year/:academicYearId', teachingGroupYearController.getTeachingGroupYearByAcademicYearIdAndTeachingGroupId)

router.post('/', teachingGroupYearController.registerYearToTeachingGroup)

router.delete('/', teachingGroupYearController.deleteTeachingGroupYear)

// router.patch('/', teachingGroupYearController.updateTeachingGroupYear)

router.patch('/activate', teachingGroupYearController.activateTeachingGroupYear)
router.patch('/deactivate', teachingGroupYearController.deactivateTeachingGroupYear)



// router.post('/', teachingGroupYearController.createTeachingGroupYear);


module.exports = router; 