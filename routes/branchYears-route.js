const express = require('express');

const branchYearController = require('../controllers/branchYears-controllers')

const router = express.Router();

router.get('/', branchYearController.getBranchYears)
router.get('/:branchYearId', branchYearController.getBranchYearById)
router.get('/branch/:branchId', branchYearController.getBranchYearsByBranchId)
router.get('/branch/:branchId/academic-year/:academicYearId', branchYearController.getBranchYearByAcademicYearIdAndBranchId)

router.post('/', branchYearController.registerYearToBranch)

router.delete('/', branchYearController.deleteBranchYear)

// router.patch('/', branchYearController.updateBranchYear)

router.patch('/activate', branchYearController.activateBranchYear)
router.patch('/deactivate', branchYearController.deactivateBranchYear)

router.patch('/munaqasyah', branchYearController.patchBranchYearMunaqasyahStatus)
router.patch('/munaqasyah/:branchYearId/sub-branch/', branchYearController.patchSubBranchMunaqasyahStatus)


// router.post('/', teachingGroupYearController.createSubBranchYear);


module.exports = router;