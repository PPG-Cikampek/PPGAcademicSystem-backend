const express = require('express');

const scoreController = require('../controllers/scores-controller')
const checkAuth = require('../middlewares/check-auth')

const router = express.Router();

router.get('/', checkAuth, scoreController.getScore);
router.get('/student/:scoreId', scoreController.getScoreById);

router.get('/sub-branch/:subBranchId', checkAuth, scoreController.getClassScoresBySubBranchId);
router.get('/branch-year/:branchYearId', checkAuth, scoreController.getClassScoresByBranchYearId);


router.patch('/:scoreId', checkAuth, scoreController.patchScoreById);



// router.delete('/:userId', usersController.deleteUser);



module.exports = router;