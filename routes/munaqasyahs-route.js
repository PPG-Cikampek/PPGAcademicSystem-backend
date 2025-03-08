const express = require('express');

const munaqasyahController = require('../controllers/munaqasyahs-controller')

const router = express.Router();

router.get('/questions', munaqasyahController.getMunaqasyahQuestions);
router.get('/questions/:questionId', munaqasyahController.getQuestionById);
router.get('/questions/class/:classGrade', munaqasyahController.getMunaqasyahQuestionsByClassGrades);

// router.get('/:userId', usersController.getUsersById);


router.post('/questions', munaqasyahController.createMunaqasyahQuestion);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router; 