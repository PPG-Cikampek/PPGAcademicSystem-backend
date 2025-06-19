const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
    studentId: { type: mongoose.Types.ObjectId, required: true, ref: 'Student' },
    forDate: { type: Date, required: true },
    timestamp: { type: Date, required: true },
    subBranchId: { type: mongoose.Types.ObjectId, required: true, ref: 'SubBranch' },
    branchYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'BranchYear' },
    classId: { type: mongoose.Types.ObjectId, required: true, ref: 'Class', index: true },
    status: { type: String, required: true },
    violations: { type: Object, required: true },
    updateReason: { type: String, required: false },
    teachersNotes: { type: String, required: false },
});


module.exports = mongoose.model('Attendance', attendanceSchema);

