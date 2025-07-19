const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const teachingGroupSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: false },
    isLocked: { type: Boolean, default: false },
    branchYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'BranchYear' },
    subBranches: [{ type: mongoose.Types.ObjectId, required: false, ref: 'SubBranch' }],
    classes: [{ type: mongoose.Types.ObjectId, required: false, ref: 'Class' }],
});

// Indexes for better query performance
teachingGroupSchema.index({ branchYearId: 1 }); // Frequent query by branchYearId
teachingGroupSchema.index({ subBranches: 1 }); // Frequent query by subBranches
teachingGroupSchema.index({ classes: 1 }); // Frequent query by classes

module.exports = mongoose.model('TeachingGroup', teachingGroupSchema);

