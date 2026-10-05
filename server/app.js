import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './src/routes/user.routes.js';
const app = express();
import { Server } from 'socket.io';

const server= http.createServer(app)
const clientOrigin = process.env.ENV === "development"
    ? process.env.CLIENT_DEV_URL
    : process.env.CLIENT_URL;

const io= new Server(server, {
    cors: {
        origin: clientOrigin,
        credentials: true,
    },
})

app.use(helmet());
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/users', userRoutes);

export { server, io };
