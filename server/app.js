import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
const app = express();
import { Server } from 'socket.io';

const server= http.createServer(app)

const io= new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        credentials: true,
    },
})

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}))

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

export { server, io };
