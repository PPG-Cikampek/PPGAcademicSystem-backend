const express = require('express');

const levelsController = require('../controllers/levels-controller')

const router = express.Router();

router.get('/branches/', levelsController.getBranches)
router.get('/branches/sub-branches/', levelsController.getSubBranches);

router.get('/branches/:branchId', levelsController.getBranchById);
router.get('/branches/:branchId/sub-branches/', levelsController.getSubBranchesByBranchById);
router.get('/branches/sub-branches/:teachingGroupId', levelsController.getSubBranchById);



// router.get('/:userId', usersController.getUsersById);

router.post('/branches/', levelsController.createBranch);
router.post('/branches/sub-branches/', levelsController.createSubBranch);

router.delete('/branches/', levelsController.deleteBranch);
router.delete('/branches/sub-branches/', levelsController.deleteTeachingGroup);

router.patch('/branches/:branchId', levelsController.updateBranch);
router.patch('/branches/sub-branches/:teachingGroupId', levelsController.updateTeachingGroup);

// router.post('/signup', usersController.signup);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 