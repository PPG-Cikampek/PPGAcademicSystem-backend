const express = require('express');

const teachingGroupController = require('../controllers/teachingGroups-controller.js')

const router = express.Router();

router.get('/', teachingGroupController.getTeachingGroups);
router.get('/:teachingGroupId', teachingGroupController.getTeachingGroupById);

router.post('/', teachingGroupController.createTeachingGroup);
router.post('/:teachingGroupId', teachingGroupController.registerSubBranchtoTeachingGroup);

router.delete('/', teachingGroupController.deleteTeachingGroup);
router.delete('/remove-sub-branch', teachingGroupController.removeSubBranchFromTeachingGroup);
router.delete('/remove-class', teachingGroupController.removeClassFromTeachingGroup);



module.exports = router; 