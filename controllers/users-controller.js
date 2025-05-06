const fs = require('fs');
const path = require('path');
const HttpError = require('../models/http-error')
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { v1: uuidv1 } = require('uuid')

const User = require('../models/user');
const Branch = require('../models/branch')
const Student = require('../models/student');
const TeachingGroup = require('../models/teachingGroup')
const Teacher = require('../models/teacher')
const NisCounter = require('../models/nisCounter');
const AccountRequest = require('../models/accountRequest');


const getUsers = async (req, res, next) => {
    const { role } = req.query

    let identifiedUsers;
    try {
        if (role === 'student') {
            identifiedUsers = await User.find({ role }, "-password")
                .populate({ path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } });
        } else {
            identifiedUsers = await User.find({}, "-password")
                .populate({ path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } });
        }
    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }
    console.log('Get users requested')
    res.json({ users: identifiedUsers.map(x => x.toObject({ getters: true })) })
};

const getUsersById = async (req, res, next) => {
    const userId = req.params.userId;

    let identifiedUsers;
    try {
        identifiedUsers = await User.findById(userId, "-password")
            .populate({ path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } });

    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }

    if (!identifiedUsers || identifiedUsers.length === 0) {
        return next(new HttpError(`Cannot find user with id '${userId}'`, 404))
    }

    console.log(`Get user data for id ${userId}`)
    res.json({ users: identifiedUsers.toObject({ getters: true }) });
}

const getRequestedAccountsByUserId = async (req, res, next) => {
    const userId = req.params.userId

    let identifiedTickets;
    try {
        if (userId) {
            console.log('looking tickets with userId')
            identifiedTickets = await AccountRequest.find({ userId })
        } else {
            console.log('looking tickets without userId')
            identifiedTickets = await AccountRequest.find()
                .populate({ path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } })
                .populate({ path: 'userId', select: 'name' })
        }

    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }

    res.json({ tickets: identifiedTickets.map(ticket => ticket.toObject({ getters: true })) });
}

const getRequestedAccountsByTicketId = async (req, res, next) => {
    const ticketId = req.params.ticketId

    let identifiedTicket
    try {
        identifiedTicket = await AccountRequest.find({ ticketId }, "-ticketId -userId -teachingGroupId -createdTime -status")
    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }

    if (!identifiedTicket || identifiedTicket.length === 0) {
        return next(new HttpError(`Cannot find account requests with ticketId '${ticketId}'`, 404))
    }

    console.log(identifiedTicket)

    res.json(identifiedTicket.map(ticket => ticket.toObject({ getters: true })))
}

const patchRequestedAccountsByTicketId = async (req, res, next) => {
    const { ticketId, respond } = req.body;

    console.log(req.body)
    console.log("TICKET ID IS " + ticketId)

    let identifiedTicket;
    try {
        identifiedTicket = await AccountRequest.findOne({ ticketId })
    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }

    if (!identifiedTicket) {
        return next(new HttpError(`Cannot find account requests with ticketId '${ticketId}'`, 404))
    }

    identifiedTicket.status = respond;

    try {
        await identifiedTicket.save();
        res.json({ message: 'Berhasil Mengupdate Tiket!', ticket: identifiedTicket.toObject({ getters: true }) });
    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal Mengupdate Tiket!', 500));
    }

}


const login = async (req, res, next) => {
    const { email, password, nis } = req.body;

    console.log(password)
    console.log(nis)

    let existingUser;
    try {
        if (email) {
            existingUser = await User.findOne({ email: email })
                .populate({ path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } });
        } else if (nis) {
            const student = await Student.findOne({ nis: nis }).populate({
                path: 'userId',
                populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } }
            });
            existingUser = student ? student.userId : null;
        }

    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    if (!existingUser) {
        return next(new HttpError("Email atau NIS tidak terdaftar, hubungi PJP!", 404));
    }

    let isPasswordValid;
    try {
        isPasswordValid = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    if (!isPasswordValid) {
        return next(new HttpError('Password Salah!', 401));
    }

    let token;
    token = jwt.sign(
        { userId: existingUser.id, email: existingUser.email, role: existingUser.role },
        process.env.JWT_KEY,
        { expiresIn: '3h' }
    );

    const userWithoutPassword = existingUser.toObject({ getters: true });
    delete userWithoutPassword.password;

    console.log(`User ${email || nis} logged in.`);
    res.json({ message: "Logged in successfully!", user: userWithoutPassword, token });
};

const bulkCreateUsersAndStudents = async (req, res, next) => {
    const { year, count, teachingGroupName, role } = req.body;

    if (req.userData.userRole !== 'admin') {
        return next(new HttpError('Unauthorized', 401));
    }

    if (!count || count <= 0) {
        return next(new HttpError('Invalid count provided!', 400));
    }

    let currentYear;
    if (year) {
        currentYear = year;
    } else {
        currentYear = new Date().getFullYear();
    }

    let teachingGroup;
    try {
        teachingGroup = await TeachingGroup.findOne({ name: teachingGroupName });
    } catch (err) {
        return next(new HttpError('TeachingGroup lookup failed!', 500));
    }

    if (!teachingGroup) {
        return next(new HttpError('TeachingGroup not found!', 404));
    }

    let nisStart;
    try {
        const lastStudent = await Student.findOne({ nis: new RegExp(`^${currentYear}`) }).sort({ nis: -1 });
        nisStart = lastStudent ? parseInt(lastStudent.nis.slice(4)) + 1 : 1;
    } catch (err) {
        console.error(err);
        return next(new HttpError('Failed to retrieve last NIS!', 500));
    }

    const users = [];
    const students = [];

    for (let i = 0; i < count; i++) {
        const nis = `${currentYear}${(nisStart + i).toString().padStart(4, '0')}`; // e.g., 20240001

        const userEmail = `siswa${nis}@gmail.com`; // Unique email for each student

        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash('1234', 12) //default password
        } catch (err) {
            return next(new HttpError('Gagal menambahkan user!', 500));
        }

        const newUser = {
            name: `Siswa ${nis}`,
            email: userEmail,
            password: hashedPassword, // Default password
            role,
            image: '',
            teachingGroupId: teachingGroup._id,
        };

        const newStudent = {
            userId: null, // This will be updated once the user document is saved
            name: `Siswa ${i + 1}`,
            nis,
            dateOfBirth: '',
            gender: '',
            parentName: '',
            address: '',
            image: '',
            isActive: true,
            isProfileComplete: false,
            attendanceIds: [],
            classIds: [],
        };

        users.push(newUser);
        students.push(newStudent);
    }

    try {
        // Save all users
        const createdUsers = await User.insertMany(users);

        // Link users to their respective students
        students.forEach((student, index) => {
            student.userId = createdUsers[index]._id;
        });

        // Save all students
        await Student.insertMany(students);

        res.status(201).json({
            message: 'Berhasil membuat siswa!',
            usersCount: createdUsers.length,
            studentsCount: students.length,
        });
    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal membuat siswa!', 500));
    }
};

const requestAccounts = async (req, res, next) => {
    const { teachingGroupId, accountList } = req.body;
    const createdTime = new Date();

    console.log(accountList);

    const ticketId = uuidv1(); // Generate ticketId once

    const createRequest = new AccountRequest({
        userId: req.userData.userId,
        teachingGroupId,
        ticketId,
        createdTime,
        status: 'pending',
        accountList
    });

    try {
        await createRequest.save();
        res.status(201).json({ message: 'Berhasil membuat permintaan!' });
    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal membuat permintaan!', 500));
    }
};


const createUser = async (req, res, next) => {
    const { name, email, password, role, teachingGroupName, teacherDetails } = req.body;

    if (req.userData.userRole !== 'admin') {
        return next(new HttpError('Unauthorized', 401));
    }

    const createdTime = new Date()

    let existingUser;
    try {
        existingUser = await User.findOne({ email: email });
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    if (existingUser) {
        return next(new HttpError('Email sudah digunakan!', 422));
    }

    let teachingGroup;
    try {
        teachingGroup = await TeachingGroup.findOne({ name: teachingGroupName });
    } catch (err) {
        console.log("ada EERRORR")
        console.log(err)
        return next(new HttpError(err ? err : 'Kelompok tidak ditemukan!', 500));
    }

    if (!teachingGroup) {
        return next(new HttpError('Kelompok tidak ditemukan!', 404));
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(password, 12)
    } catch (err) {
        return next(new HttpError('Gagal menambahkan user!', 500));
    }


    // Create the new user
    const newUser = new User({
        name,
        email,
        password: hashedPassword,
        role,
        image: "",
        teachingGroupId: teachingGroup._id, // Use the _id from the TeachingGroup document
    });

    let teacher;
    if (role === 'teacher') {
        const { nig } = teacherDetails;
        console.log(nig)
        teacher = new Teacher({
            userId: newUser._id, // Reference to the new user's ID
            name,
            nig,
            phone: "",
            position: "",
            dateOfBirth: "",
            gender: "",
            address: "",
            image: "",
            positionStartDate: createdTime,
            positionEndDate: "",
            isProfileComplete: false,
            classIds: [],
        });
    }

    try {
        const session = await mongoose.startSession();
        session.startTransaction();

        await newUser.save({ session });

        if (teacher) {
            await teacher.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        console.log(`New user added. Email: ${email}, Role: ${role}`);


        // Remove the password field before sending the response
        const newUserWithoutPassword = newUser.toObject({ getters: true });
        delete newUserWithoutPassword.password;

        res.json({ message: 'Berhasil membuat User!', user: newUserWithoutPassword });
    } catch (err) {
        return next(new HttpError('Gagal menambahkan user!: ' + err.message, 500));
    }
};


const deleteUser = async (req, res, next) => {
    const userId = req.params.userId;

    if (req.userData.userRole !== 'admin') {
        return next(new HttpError('Unauthorized', 401));
    }

    let user;
    try {
        user = await User.findById(userId)
    } catch (err) {
        console.error(err);
        const error = new HttpError('Something went wrong while deleting the user.', 500);
        return next(error);
    }

    if (!user) {
        return next(new HttpError(`Could not find a user with ID '${userId}'`, 404));
    }

    const userImagePath = user.image;
    console.log(userImagePath);


    try {
        const session = await mongoose.startSession();
        session.startTransaction();

        if (userImagePath) {
            const imagesFolder = path.resolve(__dirname, '../');
            const imagePath = path.join(imagesFolder, userImagePath);
            console.log(imagePath);
            try {
                // fs.unlinkSync(imagePath);
            } catch (err) {
                console.error(`Failed to delete profile image for user with ID ${user._id}:`, err);
            }
        }

        if (user.role === 'student') {
            await Student.deleteMany({ userId: user._id }).session(session);
        } else if (user.role === 'teacher') {
            await Teacher.deleteMany({ userId: user._id }).session(session);
        }

        await user.deleteOne({ session });
        await session.commitTransaction();
        session.endSession();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Deleting user failed', 500);
        return next(error);
    }

    console.log(`User ${user.email} deleted`)
    res.status(200).json({ message: 'Berhasil menghapus user!' });
};

const bulkDeleteUsers = async (req, res, next) => {
    const { userIds } = req.body;

    if (req.userData.userRole !== 'admin') {
        return next(new HttpError('Unauthorized', 401));
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
        return next(new HttpError('No user IDs provided.', 400));
    }

    try {
        const session = await mongoose.startSession();
        session.startTransaction();

        // Fetch users to identify roles and images
        const users = await User.find({ _id: { $in: userIds } }).session(session);

        // Delete associated documents
        for (const user of users) {
            if (user.role === 'student') {
                await Student.deleteMany({ userId: user._id }).session(session);
            } else if (user.role === 'teacher') {
                await Teacher.deleteMany({ userId: user._id }).session(session);
            }

            // Delete user images
            if (user.image) {
                const imagesFolder = path.resolve(__dirname, '../');
                const imagePath = path.join(imagesFolder, user.image);
                console.log(imagePath);

                try {
                    // fs.unlinkSync(imagePath);
                } catch (err) {
                    console.error(`Failed to delete profile image for user with ID ${user._id}:`, err);
                }
            }
        }

        // Delete users
        await User.deleteMany({ _id: { $in: userIds } }).session(session);

        await session.commitTransaction();
        session.endSession();

        res.json({ message: `Berhasil menghapus sejumlah ${userIds.length} user!` });
    } catch (err) {
        console.log(err);
        return next(new HttpError('Deleting users failed. Please try again later.', 500));
    }
};

//create an endpoint to update user's name, role, and subbranch.
const updateUser = async (req, res, next) => {
    const userId = req.params.userId;
    const { name, role, teachingGroupName } = req.body;

    let user;
    let teachingGroup;

    try {
        user = await User.findById(userId);
        if (teachingGroupName) {
            teachingGroup = await TeachingGroup.findOne({ name: teachingGroupName });
            if (!teachingGroup) {
                return next(new HttpError('TeachingGroup not found!', 404));
            }
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!user) {
        return next(new HttpError(`User with ID '${userId}' not found!`, 404));
    }

    user.name = name || user.name;
    user.role = role || user.role;
    if (teachingGroup) {
        user.teachingGroupId = teachingGroup._id;
    }

    try {
        await user.save();
        res.json({ message: 'User updated successfully!', user: user.toObject({ getters: true }) });
    } catch (err) {
        console.error(err);
        return next(new HttpError('Failed to update user!', 500));
    }
};

const requestResetPassword = async (req, res, next) => {
    const { email } = req.body;

    let user;
    try {
        user = await User.findOne({ email });
        if (!user) {
            return next(new HttpError('Email tidak terdaftar!', 404));
        }
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    const token = crypto.randomBytes(64).toString('hex');
    const tokenExpiration = Date.now() + 3600000; // 1 hour

    user.resetToken = token;
    user.resetTokenExpiration = tokenExpiration;

    try {
        await user.save();
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SERVER_EMAIL,
            pass: process.env.SERVER_EMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.SERVER_EMAIL,
        to: user.email,
        subject: 'Reset Kata Sandi Sistem E-Presensi',
        html: `<p>Anda meminta untuk mereset password</p>
               <p>Klik Tautan Berikut <a href="http://localhost:3000/reset-password/${token}">link</a> untuk mereset password.</p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error)
            return next(new HttpError('Failed to send email!', 500));
        }
        console.log('Password reset request sent to ' + email);
        res.status(200).json({ message: `Email berisi langkah-langkah mereset password telah dikirim ke ${email}` });
    });
};

const resetPassword = async (req, res, next) => {
    const { token, newPassword } = req.body;

    let user;
    try {
        user = await User.findOne({
            resetToken: token,
            resetTokenExpiration: { $gt: Date.now() }
        });
        if (!user) {
            return next(new HttpError('Token tidak valid atau sudah kadaluarsa!', 400));
        }
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(newPassword, 12);
    } catch (err) {
        return next(new HttpError('Gagal mengubah password!', 500));
    }

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiration = undefined;

    try {
        await user.save();
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log(user.email + ' has changed their password');
    res.status(200).json({ message: 'Password berhasil diubah!' });
};

const requestVerifyEmail = async (req, res, next) => {
    const { email, newEmail, isNewEmail } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email) || !newEmail || !emailRegex.test(newEmail)) {
        return next(new HttpError('Email tidak valid!', 400));
    }

    let user;
    try {
        user = await User.findOne({ email });
        if (!user && !newEmail) {
            return next(new HttpError('Email tidak terdaftar!', 404));
        }
        if (isNewEmail) {
            existingUser = await User.findOne({ email: newEmail });
            if (existingUser) {
                return next(new HttpError('Email sudah terdaftar!', 404));
            }
        }
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.zoho.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SERVER_EMAIL,
            pass: process.env.SERVER_EMAIL_PASSWORD
        }
    });

    let mailOptions;
    if (isNewEmail) {
        const token = jwt.sign({ email, newEmail }, process.env.JWT_KEY, { expiresIn: '1h' });
        mailOptions = {
            from: process.env.SERVER_EMAIL,
            to: newEmail,
            subject: 'Pengubahan Email Sistem Akademik PPG',
            html: `<p>Anda meminta mengubah Email Sistem Akademik PPG</p>
                   <p>Klik Tautan Berikut <a href="${process.env.BASE_URL}/verify-email/${token}">link</a> untuk memverifikasi email baru Anda.</p>
                   <br>
                   <p>Link di atas berlaku selama 1 jam.</p> `
        };
    } else {
        const token = jwt.sign({ email, newEmail: email }, process.env.JWT_KEY, { expiresIn: '1h' });
        mailOptions = {
            from: process.env.SERVER_EMAIL,
            to: user.email,
            subject: 'Verifikasi Email Sistem Akademik PPG',
            html: `<p>Verifikasi Email Sistem Akademik PPG</p>
                   <p>Klik Tautan Berikut <a href="${process.env.BASE_URL}/verify-email/${token}">link</a> untuk memverifikasi email Anda.</p>
                   <br>
                   <p>Link di atas berlaku selama 1 jam.</p> `
        };
    }

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error)
            return next(new HttpError('Failed to send email!', 500));
        }
        newEmail ? console.log('Email verification request sent to ' + email) : console.log('Email change request sent to ' + newEmail);
        res.status(200).json({ message: `Email berisi langkah-langkah selanjutnya telah dikirim ke ${newEmail || email}` });
    });
};

const verifyEmail = async (req, res, next) => {
    const { token } = req.params;
    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY);

        const user = await User.findOneAndUpdate(
            { email: decoded.email },
            { email: decoded.newEmail },
            { new: true });

        user.isEmailVerified = true;
        await user.save();

        console.log(user.email + ' has verified their email');

        res.status(200).json({ message: 'Email berhasil diverifikasi!' });
    } catch (err) {
        return next(new HttpError('Token tidak valid/kadaluarsa!', 400));
    }
};

const updateProfileImage = async (req, res, next) => {
    const userId = req.params.userId;
    const { thumbnail } = req.body;
    let user;
    try {
        if (req.file) {
            const updateData = {};
            updateData.image = req.file.path.replace(/\\/g, '/');
            updateData.originalImagePath = req.file.path;
            if (thumbnail) {
                updateData.thumbnail = thumbnail;
            }

            user = await User.findByIdAndUpdate(
                userId,
                updateData,
                { new: true, runValidators: true }
            );

            if (user.role === 'teacher') {
                await Teacher.findOneAndUpdate(
                    { userId: user._id },
                    { image: updateData.image, originalImagePath: updateData.originalImagePath, ...(thumbnail && { thumbnail }) },
                    { new: true, runValidators: true }
                );
            } else if (user.role === 'student') {
                await Student.findOneAndUpdate(
                    { userId: user._id },
                    { image: updateData.image, originalImagePath: updateData.originalImagePath, ...(thumbnail && { thumbnail }) },
                    { new: true, runValidators: true }
                );
            }
        } else {
            return next(new HttpError('File tidak tersedia!', 400));
        }
    } catch (err) {
        console.error(err);
        const error = new HttpError('Gagal memperbarui foto profil.', 500);
        return next(error);
    }

    console.log(`Updated profile image for user ${user.email}`);
    res.status(200).json({ message: 'Berhasil memperbarui foto profil!' });
};

const changeUserPassword = async (req, res, next) => {
    const { email, oldPassword, newPassword, confirmNewPassword } = req.body;

    if (confirmNewPassword !== newPassword) {
        return next(new HttpError('Password tidak sama!', 400));
    }

    let user;
    try {
        user = await User.findOne({ email });

    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    if (!user) {
        return next(new HttpError('Email tidak terdaftar!', 404));
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
        return next(new HttpError('Password lama salah!', 401));
    }

    let hashedPassword;
    try {
        hashedPassword = await bcrypt.hash(newPassword, 12);
    } catch (err) {
        return next(new HttpError('Gagal mengubah password!', 500));
    }

    user.password = hashedPassword;

    try {
        await user.save();
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log(user.email + ' has changed their password');
    res.status(200).json({ message: 'Password berhasil diubah!' });
}

exports.getUsers = getUsers;
exports.bulkCreateUsersAndStudents = bulkCreateUsersAndStudents;
exports.login = login;
exports.createUser = createUser;
exports.getUsersById = getUsersById
exports.deleteUser = deleteUser
exports.bulkDeleteUsers = bulkDeleteUsers
exports.updateUser = updateUser;
exports.requestResetPassword = requestResetPassword;
exports.resetPassword = resetPassword;
exports.requestVerifyEmail = requestVerifyEmail
exports.verifyEmail = verifyEmail
exports.updateProfileImage = updateProfileImage
exports.changeUserPassword = changeUserPassword
exports.requestAccounts = requestAccounts;
exports.getRequestedAccountsByUserId = getRequestedAccountsByUserId;
exports.getRequestedAccountsByTicketId = getRequestedAccountsByTicketId;
exports.patchRequestedAccountsByTicketId = patchRequestedAccountsByTicketId;