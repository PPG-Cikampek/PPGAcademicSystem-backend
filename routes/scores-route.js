const express = require('express');

const scoreController = require('../controllers/scores-controller')
const checkAuth = require('../middlewares/check-auth')

const router = express.Router();

router.get('/', checkAuth, scoreController.getScore);
router.get('/student/:scoreId', scoreController.getScoreById);

router.get('/classes/:teachingGroupYearId', scoreController.getClassesByTeachingGroupYearId);



router.patch('/:scoreId', checkAuth, scoreController.patchScoreById);



// router.delete('/:userId', usersController.deleteUser);



module.exports = router;