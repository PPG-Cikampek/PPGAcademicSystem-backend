const express = require('express');

const munaqasyahController = require('../controllers/munaqasyahs-controller')
const checkAuth = require('../middlewares/check-auth')

const router = express.Router();

router.get('/classes', munaqasyahController.getClassesInfo);

router.get('/questions', munaqasyahController.getMunaqasyahQuestions);
router.get('/questions/:questionId', munaqasyahController.getQuestionById);
router.get('/questions/class/:classGrade', munaqasyahController.getMunaqasyahQuestionsByClassGrades);

// router.get('/:userId', usersController.getUsersById);


router.post('/questions', munaqasyahController.createMunaqasyahQuestion);

router.patch('/questions/:questionId', checkAuth, munaqasyahController.patchQuestionById);
router.delete('/questions/:questionId', checkAuth, munaqasyahController.deleteQuestionById);

// router.delete('/:userId', usersController.deleteUser);



module.exports = router;