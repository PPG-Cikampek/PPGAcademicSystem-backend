// app.js
const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config(); // Load environment variables

const logRequest = require("./middlewares/log-request");
const cors = require("cors");
const usersRoutes = require("./routes/users-route");
const levelsRoutes = require("./routes/levels-route");
const teachingGroupsRoutes = require("./routes/teachingGroups-route");
const academicYearsRoutes = require("./routes/academicYears-route");
const branchYearsRoutes = require("./routes/branchYears-route");
const classesRoutes = require("./routes/classes-route");
const teachersRoutes = require("./routes/teachers-route");
const studentsRoutes = require("./routes/students-route");
const attendancesRoutes = require("./routes/attendances-route");
const dashboardRoutes = require("./routes/dashboard-route");
const journalsRoutes = require("./routes/journals-route");
const materialProgressesRoutes = require("./routes/materialProgresses-route");
const munaqasyahRoutes = require("./routes/munaqasyahs-route");
const scoreRoutes = require("./routes/scores-route");
const HttpError = require("./models/http-error");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 5000;

// MongoDB connection string
const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
const clientOptions = {
    serverApi: { version: "1", strict: true, deprecationErrors: true },
};

// Middleware
app.use((req, res, next) => {
    console.log("Received URL:", req.originalUrl);
    next();
});

app.use(express.json()); // Parses incoming JSON requests
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded data

// Logging middleware to log every request
app.use(logRequest); // Log every request

// CORS handling using the `cors` package. We preserve the original behaviour:
// - If the request origin is in the configured ALLOWED_ORIGINS list, send
//   Access-Control-Allow-Origin with that exact origin and include credentials.
// - Otherwise, fall back to allowing any origin ('*') but do not set credentials.
const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    "https://akademik.ppgcikampek.id, http://localhost:3000"
)
    .split(",")
    .map((o) => o.trim());

const commonHeaders = {
    allowedHeaders:
        "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    methods: "GET, POST, PATCH, DELETE, OPTIONS",
};

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        // Use cors middleware for allowed, credentialed origins
        return cors({ origin: origin, credentials: true, ...commonHeaders })(
            req,
            res,
            next
        );
    }

    // Fallback: allow any origin without credentials (similar to original code)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", commonHeaders.allowedHeaders);
    res.setHeader("Access-Control-Allow-Methods", commonHeaders.methods);

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// Initialize backup scheduler
require("./scheduler/backup-scheduler");

// Serve static files for images
app.use(
    "/api/uploads/images",
    express.static(path.join(__dirname, "uploads", "images"))
);

// Routes
app.use("/api/users", usersRoutes);
app.use("/api/levels", levelsRoutes);
app.use("/api/teachingGroups", teachingGroupsRoutes);
app.use("/api/academicYears", academicYearsRoutes);
app.use("/api/branchYears", branchYearsRoutes);
app.use("/api/classes", classesRoutes);
app.use("/api/teachers", teachersRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/attendances", attendancesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/journals", journalsRoutes);
app.use("/api/materialProgress", materialProgressesRoutes);
app.use("/api/munaqasyahs", munaqasyahRoutes);
app.use("/api/scores", scoreRoutes);

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
mongoose
    .connect(MONGO_URI, clientOptions)
    .then(async () => {
        console.log(`Connected to MongoDB -> ${process.env.DB_NAME}`);

        // Log MongoDB server version using a MongoClient
        const mongoClient = new MongoClient(MONGO_URI, clientOptions);
        try {
            await mongoClient.connect();
            const adminDb = mongoClient.db().admin();
            const info = await adminDb.serverStatus();
            console.log("MongoDB Version:", info.version);
        } catch (err) {
            console.error("Error fetching MongoDB version:", err);
        } finally {
            try {
                await mongoClient.close();
            } catch (closeErr) {
                console.error("Error closing MongoClient:", closeErr);
            }
        }

        app.listen(process.env.PORT || PORT, () => {
            console.log(
                `Server is running on http://localhost:${
                    process.env.PORT || PORT
                }`
            );
        });
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });
