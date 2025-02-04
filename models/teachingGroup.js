const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const teachingGroupSchema = new Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    branchId: { type: mongoose.Types.ObjectId, required: true, ref: 'Branch', index: true },
    teachingGroupYears: [{ type: mongoose.Types.ObjectId, required: false, ref: 'TeachingGroupYear' }]
});


module.exports = mongoose.model('TeachingGroup', teachingGroupSchema);

