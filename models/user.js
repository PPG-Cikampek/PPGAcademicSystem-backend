const mongoose = require('mongoose');
const validator = require('validator');
const HttpError = require('./http-error');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: true },
    email: {
        type: String,
        required: [true, 'Masukkan Email!'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'Masukkan Email yang Valid!']
    },
    isEmailVerified: { type: Boolean, required: true, default: false },
    password: { type: String, required: true, minlength: [8, 'Password must be at least 8 characters'] },
    role: { type: String, required: true },
    image: { type: String, required: false },
    thumbnail: { type: String, required: false },
    subBranchId: { type: mongoose.Types.ObjectId, required: false, ref: 'SubBranch' },
    resetToken: { type: String },
    resetTokenExpiration: { type: Date }
});

// Indexes for better query performance
userSchema.index({ email: 1 }); // Email is already unique, but explicit index for faster queries
userSchema.index({ role: 1 }); // Frequent query by role (admin, teacher, student)
userSchema.index({ subBranchId: 1 }); // Frequent query by subBranchId
userSchema.index({ resetToken: 1 }); // For password reset functionality

userSchema.pre('save', async function(next) {
    const user = this;
    try {
        await user.validate();
        next();
    } catch (err) {
        console.log("Ada ERRRORR" + err);
        next(new HttpError(err.message, 400));
    }
});

module.exports = mongoose.model('User', userSchema);

