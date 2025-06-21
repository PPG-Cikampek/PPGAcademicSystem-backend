const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const Class = require('../models/class')
const branchYear = require('../models/branchYear')
const Student = require('../models/student')
const Teacher = require('../models/teacher')
const Attendance = require('../models/attendance');
const SubBranch = require('../models/subBranch');



const getDashboardData = async (req, res, next) => {
    const userRole = req.userData.userRole
    const userId = req.userData.userId

    try {

        let dashboardData = {}

        if (userRole === 'subBranchAdmin') {
            const user = await User.findById(userId)

            const branchYears = await branchYear.find({ subBranchId: user.subBranchId }).select('_id');
            const branchYearIds = branchYears.map(tgy => tgy._id);

            const classCount = await Class.countDocuments({ branchYearId: { $in: branchYearIds } });

            // Find all users (students) in this teaching group
            const studentUsers = await User.find({ subBranchId: user.subBranchId }).select('_id');
            const studentUserIds = studentUsers.map(u => u._id);

            // Count students whose userId is in studentUserIds
            const studentCount = await Student.countDocuments({ userId: { $in: studentUserIds } });

            // Count teachers whose userId is in studentUserIds (assuming teachers are also users in the same group)
            const teacherCount = await Teacher.countDocuments({ userId: { $in: studentUserIds } });

            // Find all students in this group to get their _ids
            const students = await Student.find({ userId: { $in: studentUserIds } }).select('_id');
            const studentIds = students.map(s => s._id);

            // Count attendance for students in this group
            const attendanceCount = await Attendance.countDocuments({ studentId: { $in: studentIds } });

            const attendancePresentCount = await Attendance.countDocuments({ 
                studentId: { $in: studentIds }, 
                status: { $in: ['Hadir', 'Terlambat'] } 
            });

            const attendancePercentage = attendanceCount === 0 ? 0 : (attendancePresentCount / attendanceCount * 100);

            dashboardData = {
                // "Kelas": classCount,
                "Peserta Didik": studentCount,
                "Tenaga Pendidik": teacherCount,
                "Kehadiran": attendancePercentage
            }

            console.log(dashboardData)
        }

        if (userRole === 'admin' || userRole === 'curriculum') {
            const branchCount = await Branch.countDocuments()
            const subBranchCount = await SubBranch.countDocuments()
            const classCount = await Class.countDocuments()
            const studentCount = await Student.countDocuments()
            const teacherCount = await Teacher.countDocuments()
            const attendanceCount = await Attendance.countDocuments()

            const attendancePresentCount = await Attendance.countDocuments({ status: { $in: ['Hadir', 'Terlambat'] } })

            const attendancePercentage = attendancePresentCount / attendanceCount * 100


            dashboardData = {
                "Desa": branchCount,
                "Kelompok": subBranchCount,
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