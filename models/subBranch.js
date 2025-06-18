const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const subBranchSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    munaqasyahStatus: { type: String, required: false },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch', index: true },
    teachingGroups: [{ type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup', index: true }],
});


module.exports = mongoose.model('SubBranch', subBranchSchema);

