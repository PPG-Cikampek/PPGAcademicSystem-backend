const express = require('express');

const journalController = require('../controllers/journals-controller')

const router = express.Router();

router.get('/:userId', journalController.getJournalsByUserId)

// router.get('/:userId', usersController.getUsersById);


router.post('/', journalController.createJournal);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 