const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const TeachingGroup = require('../models/teachingGroup');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const TeachingGroupYear = require('../models/teachingGroupYear')
const Student = require('../models/student')
const Teacher = require('../models/teacher')
const Attendance = require('../models/attendance');
const attendance = require('../models/attendance');
const teachingGroupYear = require('../models/teachingGroupYear');
const user = require('../models/user');


const getDashboardData = async (req, res, next) => {
    const userRole = req.userData.userRole
    const userId = req.userData.userId

    try {

        let dashboardData = {}

        if (userRole === 'teachingGroupAdmin') {
            const user = User.find(userId)

            const teachingGroupYears = await TeachingGroupYear.find({ teachingGroupId: user.teachingGroupId }).select('_id');
            const teachingGroupYearIds = teachingGroupYears.map(tgy => tgy._id);

            const classCount = await Class.countDocuments({ teachingGroupYearId: { $in: teachingGroupYearIds } });

            // const classCount = await Class.countDocuments({ 'teachingGroupYearId.teachingGroupId': user.teachingGroupId })
            const studentCount = await Student.countDocuments({ 'userId.teachingGroupId': user.teachingGroupId })
            const teacherCount = await Teacher.countDocuments({ 'userId.teachingGroupId': user.teachingGroupId })
            const attendanceCount = await Attendance.countDocuments({ 'studentId.userId.teachingGroupId': user.teachingGroupId })

            const attendancePresentCount = await Attendance.countDocuments({ status: { $in: ['Hadir', 'Terlambat'] } })

            const attendancePercentage = attendancePresentCount / attendanceCount * 100


            dashboardData = {
                "Kelas": classCount,
                "Peserta Didik": studentCount,
                "Tenaga Pendidik": teacherCount,
                "Kehadiran": attendancePercentage
            }

        }

        if (userRole === 'admin' || userRole === 'curriculum') {
            const branchCount = await Branch.countDocuments()
            const teachingGroupCount = await TeachingGroup.countDocuments()
            const classCount = await Class.countDocuments()
            const studentCount = await Student.countDocuments()
            const teacherCount = await Teacher.countDocuments()
            const attendanceCount = await Attendance.countDocuments()

            const attendancePresentCount = await Attendance.countDocuments({ status: { $in: ['Hadir', 'Terlambat'] } })

            const attendancePercentage = attendancePresentCount / attendanceCount * 100


            dashboardData = {
                "Desa": branchCount,
                "Kelompok": teachingGroupCount,
                "Kelas": classCount,
                "Peserta Didik": studentCount,
                "Tenaga Pendidik": teacherCount,
                "Kehadiran": attendancePercentage
            }
        }

        res.status(200).json({ message: 'Success', dashboardData });
    } catch (err) {
        console.log(err)
        return next(new HttpError('Internal server error occurred!', 500))
    }

}

exports.getDashboardData = getDashboardData