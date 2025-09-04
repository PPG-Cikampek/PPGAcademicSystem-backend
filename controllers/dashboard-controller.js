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
const AcademicYear = require('../models/academicYear');



const getAttendanceByAcademicYear = async (attendanceQuery) => {
    const attendanceStats = await Attendance.aggregate([
        { $match: attendanceQuery },
        {
            $lookup: {
                from: 'branchyears',
                localField: 'branchYearId',
                foreignField: '_id',
                as: 'branchYear'
            }
        },
        { $unwind: '$branchYear' },
        {
            $lookup: {
                from: 'academicyears',
                localField: 'branchYear.academicYearId',
                foreignField: '_id',
                as: 'academicYear'
            }
        },
        { $unwind: '$academicYear' },
        {
            $group: {
                _id: {
                    academicYearId: '$academicYear._id',
                    academicYearName: '$academicYear.name'
                },
                totalAttendances: { $sum: 1 },
                presentAttendances: {
                    $sum: {
                        $cond: [
                            { $in: ['$status', ['Hadir', 'Terlambat']] },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                academicYearId: '$_id.academicYearId',
                academicYearName: '$_id.academicYearName',
                attendancePercentage: {
                    $cond: [
                        { $eq: ['$totalAttendances', 0] },
                        0,
                        { $multiply: [{ $divide: ['$presentAttendances', '$totalAttendances'] }, 100] }
                    ]
                }
            }
        },
        { $sort: { academicYearName: 1 } }
    ]);

    return attendanceStats;
};

const getDashboardData = async (req, res, next) => {
    const userRole = req.userData.userRole
    const userId = req.userData.userId
    const branchId = req.userData.userBranchId


    console.log(req.userData)

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

            // Get attendance statistics by academic year
            const attendanceByYear = await getAttendanceByAcademicYear({ studentId: { $in: studentIds } });

            dashboardData = {
                // "Kelas": classCount,
                "Peserta Didik": studentCount,
                "Tenaga Pendidik": teacherCount,
                "Kehadiran": attendanceByYear
            }

            console.log(dashboardData)
        }

        if (userRole === 'branchAdmin') {
            // Get all sub-branches for this branch
            const subBranches = await SubBranch.find({ branchId: branchId }).select('_id');
            const subBranchIds = subBranches.map(sb => sb._id);

            // Get all branchYears for these subBranches
            const branchYears = await branchYear.find({ subBranchId: { $in: subBranchIds } }).select('_id');

            // Get all users in these subBranches
            const usersInBranch = await User.find({ subBranchId: { $in: subBranchIds } }).select('_id');
            const userIdsInBranch = usersInBranch.map(u => u._id);

            // Count students and teachers
            const studentCount = await Student.countDocuments({ userId: { $in: userIdsInBranch } });
            const teacherCount = await Teacher.countDocuments({ userId: { $in: userIdsInBranch } });

            // Get all students' _id for attendance
            const students = await Student.find({ userId: { $in: userIdsInBranch } }).select('_id');
            const studentIds = students.map(s => s._id);

            // Get attendance statistics by academic year
            const attendanceByYear = await getAttendanceByAcademicYear({ studentId: { $in: studentIds } });

            dashboardData = {
                "Kelompok": subBranchIds.length,
                "Peserta Didik": studentCount,
                "Tenaga Pendidik": teacherCount,
                "Kehadiran": attendanceByYear
            }
        }

        if (userRole === 'admin' || userRole === 'curriculum') {
            const branchCount = await Branch.countDocuments()
            const subBranchCount = await SubBranch.countDocuments()
            const classCount = await Class.countDocuments()
            const studentCount = await Student.countDocuments()
            const teacherCount = await Teacher.countDocuments()

            // Get attendance statistics by academic year for all students
            const attendanceByYear = await getAttendanceByAcademicYear({});

            dashboardData = {
                "Desa": branchCount,
                "Kelompok": subBranchCount,
                "Kelas": classCount,
                "Peserta Didik": studentCount,
                "Tenaga Pendidik": teacherCount,
                "Kehadiran": attendanceByYear
            }
        }

        res.status(200).json({ message: 'Success', dashboardData });
    } catch (err) {
        console.log(err)
        return next(new HttpError('Internal server error occurred!', 500))
    }

}

exports.getDashboardData = getDashboardData