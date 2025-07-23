const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
    studentId: { type: mongoose.Types.ObjectId, required: true, ref: 'Student' },
    forDate: { type: Date, required: true },
    timestamp: { type: Date, required: true },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch' },
    subBranchId: { type: mongoose.Types.ObjectId, required: true, ref: 'SubBranch' },
    teachingGroupId: { type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup' },
    classId: { type: mongoose.Types.ObjectId, required: true, ref: 'Class' },
    status: { type: String, required: true },
    violations: { type: Object, required: true },
    updateReason: { type: String, required: false },
    teachersNotes: { type: String, required: false },
});

// Indexes for better query performance
attendanceSchema.index({ studentId: 1 }); // Frequent query by studentId
attendanceSchema.index({ forDate: 1 }); // Frequent query by forDate
attendanceSchema.index({ branchId: 1 }); // Frequent query by branchId
attendanceSchema.index({ teachingGroupId: 1 }); // Frequent query by teachingGroupYearId
attendanceSchema.index({ subBranchId: 1 }); // Frequent query by subBranchId
attendanceSchema.index({ classId: 1 }); // Frequent query by classId

module.exports = mongoose.model('Attendance', attendanceSchema);

