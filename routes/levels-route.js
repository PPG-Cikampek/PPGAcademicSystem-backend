const express = require('express');

const levelsController = require('../controllers/levels-controller')

const router = express.Router();

router.get('/branches/', levelsController.getBranches)
router.get('/branches/teaching-groupes/', levelsController.getTeachingGroupes);

router.get('/branches/:branchId', levelsController.getBranchById);
router.get('/branches/teaching-groupes/:teachingGroupId', levelsController.getTeachingGroupById);



// router.get('/:userId', usersController.getUsersById);

router.post('/branches/', levelsController.createBranch);
router.post('/branches/teaching-groupes/', levelsController.createTeachingGroup);

router.delete('/branches/', levelsController.deleteBranch);
router.delete('/branches/teaching-groupes/', levelsController.deleteTeachingGroup);

router.patch('/branches/:branchId', levelsController.updateBranch);
router.patch('/branches/teaching-groupes/:teachingGroupId', levelsController.updateTeachingGroup);

// router.post('/signup', usersController.signup);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 