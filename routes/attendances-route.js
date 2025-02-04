const express = require('express');

const attendancesController = require('../controllers/attendances-controller')

const router = express.Router();


router.get('/:attendanceId', attendancesController.getAttendanceById)
router.get('/class/:classId', attendancesController.getAttendancesByClass)
router.get('/academic-year/:academicYearId', attendancesController.getAttendancesByAcademicYearId)

router.post('/reports/', attendancesController.getAttendanceReports)

router.post('/create-new-attendances/', attendancesController.createNewAttendanceForClass);
router.post('/:classId', attendancesController.getAttendancesByDateAndClass)

router.patch('/', attendancesController.updateAttendancesByIds);

router.delete('/:attendanceId', attendancesController.deleteAttendanceById);



module.exports = router; 