const express = require('express');
const fileUpload = require('../middlewares/file-upload');
const checkAuth = require('../middlewares/check-auth');
const bugReportsController = require('../controllers/bugReports-controller');

const router = express.Router();

// All routes require authentication
// Note: Leaderboard should come before /:reportId to avoid route conflict
router.get('/leaderboard', checkAuth, bugReportsController.getLeaderboard);
router.get('/metrics', checkAuth, bugReportsController.getMetrics);

// Standard CRUD routes
router.get('/', checkAuth, bugReportsController.getBugReports);
router.get('/:reportId', checkAuth, bugReportsController.getBugReportById);

// Create bug report with screenshot uploads (max 3 images)
router.post('/', checkAuth, fileUpload.array('screenshots', 3), bugReportsController.createBugReport);

// Delete bug report (owner only for pending, admin can delete any)
router.delete('/:reportId', checkAuth, bugReportsController.deleteBugReport);

// Admin-only routes (role check in controller)
router.patch('/:reportId/status', checkAuth, bugReportsController.updateBugReportStatus);
router.post('/:reportId/updates', checkAuth, bugReportsController.addBugReportUpdate);

module.exports = router;
