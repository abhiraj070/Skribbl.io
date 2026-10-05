import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './src/routes/user.routes.js';
const app = express();
import { Server } from 'socket.io';

const server= http.createServer(app)
const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.CLIENT_DEV_URL,
    "https://skribbl-io-nine.vercel.app",
].filter(Boolean).map((origin) => origin.replace(/\/$/, ""));

const isAllowedOrigin = (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
    }

    callback(new Error("Origin is not allowed by CORS"));
};

const io= new Server(server, {
    cors: {
        origin: isAllowedOrigin,
        credentials: true,
    },
})

app.use(helmet());
app.use(cors({ origin: isAllowedOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/users', userRoutes);

export { server, io };
