import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";

import dataSyncer from "./contest/controllers/DataSyncController.js";
import contestSyncer from "./contest/controllers/contestController.js";
import contestRoutes from "./contest/routes/contestRoutes.js";
import fetchContestsData from "./fetchContests.js";

dotenv.config();
const app = express();
let appServer;

const handleUncaughtExceptions = () => {
  process.on("uncaughtException", (err) => {
    console.error(`Error: ${err.message}`);
    console.error("Shutting down due to uncaught exception");
    process.exit(1);
  });
};

const handleUnhandledRejections = () => {
  process.on("unhandledRejection", (err) => {
    console.error(`Error: ${err.message}`);
    console.error("Shutting down the server due to Unhandled promise rejection");
    appServer.close(() => {
      process.exit(1);
    });
  });
};

const connectToMongoDB = async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("MongoDB Connected.");
};

const setupContestServer = async () => {
  await dataSyncer.syncContests();
  setInterval(dataSyncer.syncContests, 90 * 60 * 1000);

  await contestSyncer.updateContests();
  setInterval(contestSyncer.updateContests, 60 * 60 * 1000);

  setInterval(
    async () => {
      try {
        console.log("Pinging...");
        await fetchContestsData();
        console.log("Pong!");
      } catch (error) {
        console.error("Error Pinging", error);
      }
    },
    13 * 60 * 1000,
  );

  app.use("/contests", contestRoutes);
};

const startServer = async () => {
  try {
    await connectToMongoDB();
    await setupContestServer();

    // Handle unhandled routes
    app.all("*", (req, res, next) => {
      res.status(404).json({ error: `${req.originalUrl} route not found` });
    });

    const port = process.env.PORT || 3000;
    console.log("┌──────────────────────────────────┐");
    console.log("│ Server active: Contest".padEnd(35) + "│");
    console.log("├──────────────────────────────────┤");
    appServer = app.listen(port, () => {
      console.log(`│ Server listening on port ${port}`.padEnd(35) + "│");
      console.log("└──────────────────────────────────┘");
    });
  } catch (err) {
    console.error("Error starting server:", err);
  }
};

handleUncaughtExceptions();
handleUnhandledRejections();

if (process.env.NODE_ENV) {
  startServer();
} else {
  console.error("Error: NODE_ENV not set.");
}
