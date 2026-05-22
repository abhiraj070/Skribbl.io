export const InitliseIO = (io) => {
    io.on('connection', (socket) => {
        console.log('a user connected');
    });
}