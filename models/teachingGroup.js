const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const teachingGroupSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: false },
    isLocked: { type: Boolean, default: false },
    branchYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'BranchYear', index: true },
    subBranches: [{ type: mongoose.Types.ObjectId, required: false, ref: 'SubBranch' }],
    classes: [{ type: mongoose.Types.ObjectId, required: false, ref: 'Class' }],
});


module.exports = mongoose.model('TeachingGroup', teachingGroupSchema);

