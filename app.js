// app.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config(); // Load environment variables

const usersRoutes = require('./routes/users-route');
const levelsRoutes = require('./routes/levels-route');
const academicYearsRoutes = require('./routes/academicYears-route');
const teachingGroupYearsRoutes = require('./routes/teachingGroupYears-route');
const classesRoutes = require('./routes/classes-route');
const teachersRoutes = require('./routes/teachers-route');
const studentsRoutes = require('./routes/students-route');
const attendancesRoutes = require('./routes/attendances-route');
const dashboardRoutes = require('./routes/dashboard-route');
const journalsRoutes = require('./routes/journals-route');
const materialProgressesRoutes = require('./routes/materialProgresses-route');
const munaqasyahRoutes = require('./routes/munaqasyahs-route');
const HttpError = require('./models/http-error');

const app = express();
const PORT = 5000;

// MongoDB connection string
const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

// Middleware

app.use(express.json()); // Parses incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data

// Serve static files for images
app.use('/api/uploads/images', express.static(path.join(__dirname, 'uploads', 'images')));

// Logging middleware to check request paths
app.use((req, res, next) => {
    console.log(`Request URL: ${req.url}`);
    next();
});

// CORS handling
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');

    next();
});

// Routes
app.use('/api/users', usersRoutes);
app.use('/api/levels', levelsRoutes);
app.use('/api/academicYears', academicYearsRoutes);
app.use('/api/teachingGroupYears', teachingGroupYearsRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/attendances', attendancesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/journals', journalsRoutes);
app.use('/api/materialProgress', materialProgressesRoutes);
app.use('/api/munaqasyah', munaqasyahRoutes);

// Catch-all route for handling unknown routes
app.use((req, res, next) => {
    const error = new HttpError("Oops! Page not found!", 404);
    throw error;
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (req.file) {
        fs.unlink(req.file.path, (err) => {
            console.error(err);
        });
    }
    if (res.headerSent) {
        return next(error);
    }
    console.error(error.stack);
    res.status(error.code || 500);
    res.json({ message: error.message });
});

// Connect to MongoDB and start the server
mongoose.connect(MONGO_URI, clientOptions)
    .then(() => {
        console.log(`Connected to MongoDB -> ${process.env.DB_NAME}`);
        app.listen(process.env.PORT || PORT, () => {
            console.log(`Server is running on http://localhost:${process.env.PORT || PORT}`);
        });
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
    });