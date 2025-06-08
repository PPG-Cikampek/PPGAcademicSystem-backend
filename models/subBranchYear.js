const mongoose = require('mongoose');
const academicYear = require('./academicYear');

const Schema = mongoose.Schema;

const subBranchYearSchema = new Schema({
    name: { type: String, required: false },
    academicYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'AcademicYear', index: true },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch', index: true },
    isActive: { type: Boolean, required: true },
    munaqasyahStatus: { type: Boolean, required: true },
    teachingGroups: [{ type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup' }]
});


module.exports = mongoose.model('SubBranchYear', subBranchYearSchema);

    