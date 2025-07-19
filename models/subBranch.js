const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const subBranchSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    munaqasyahStatus: { type: String, required: false },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch' },
    teachingGroups: [{ type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup' }],
});

// Indexes for better query performance
subBranchSchema.index({ branchId: 1 }); // Index on branchId field for faster queries
subBranchSchema.index({ teachingGroups: 1 }); // Index on teachingGroups field for faster queries

module.exports = mongoose.model('SubBranch', subBranchSchema);

