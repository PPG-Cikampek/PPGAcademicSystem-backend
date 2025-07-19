const mongoose = require('mongoose');
const academicYear = require('./academicYear');

const Schema = mongoose.Schema;

const branchYearSchema = new Schema({
    name: { type: String, required: false },
    academicYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'AcademicYear' },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch' },
    isActive: { type: Boolean, required: true },
    munaqasyahStatus: { type: String, required: true },
    teachingGroups: [{ type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup' }]
});

// Indexes for better query performance
branchYearSchema.index({ academicYearId: 1 }); // Frequent query by academicYearId
branchYearSchema.index({ branchId: 1 }); // Frequent query by branchId
branchYearSchema.index({ teachingGroups: 1 }); // Index on teachingGroups field for faster queries

module.exports = mongoose.model('BranchYear', branchYearSchema);

    