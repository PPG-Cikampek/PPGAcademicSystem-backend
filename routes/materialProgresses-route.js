const express = require('express');

const materialProgressController = require('../controllers/materialProgresses-controller.js')

const router = express.Router();

router.get('/:userId', materialProgressController.getProgressesByUserId)

// router.get('/:userId', usersController.getUsersById);


router.post('/', materialProgressController.createProgress);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 