const express = require('express');

const attendancesController = require('../controllers/attendances-controller')
const checkAuth = require('../middlewares/check-auth')

const router = express.Router();

// protect all attendance routes
router.use(checkAuth)

router.get('/:attendanceId', attendancesController.getAttendanceById)
router.get('/class/:classId', attendancesController.getAttendancesByClass)
router.get('/academic-year/:academicYearId', attendancesController.getAttendancesByAcademicYearId)

router.post('/overview/', attendancesController.getAttendanceOverview)
router.post('/reports/', attendancesController.getAttendanceReports)

router.post('/create-new-attendances/', attendancesController.createNewAttendanceForClass);
router.post('/:classId', attendancesController.getAttendancesByDateAndClass)

router.patch('/', attendancesController.updateAttendancesByIds);

router.delete('/:attendanceId', attendancesController.deleteAttendanceById);



module.exports = router; 