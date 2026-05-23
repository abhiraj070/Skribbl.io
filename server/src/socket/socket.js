const rooms={}, socketIdToId={}, idToSocketId={}

export const InitliseIO = (io) => {
    io.on('connection', (socket) => {

        console.log('a user connected',socket.id);
        const userId= socket.handshake.auth.userId
        socketIdToId[socket.id]= userId
        idToSocketId[userId]= socket.id

        socket.on("create-room",({roomId, hostId, username})=>{
            if(rooms[roomId]) return
            socket.join(roomId)
            rooms[roomId]={
                    host: hostId,
                    users: [],
                    word: {}
                }
            rooms[roomId].users.push({id: hostId, username: username, points: 0})
        })

        socket.on("join-room",({roomId, joinerId, username})=>{
            if(!rooms[roomId]) return
            rooms[roomId].users.push({id: joinerId, username: username, points: 0})
            socket.join(roomId)
            socketIdToId={id: socket.id, roomId: roomId}
        })

        socket.on("leave-room",(roomId, leftId)=>{
            if(!rooms[roomId]) return 
            rooms[roomId].users= rooms[roomId].users.filter((user)=>{return user.id!=leftId})
            socket.leave(roomId)
        })

        socket.on("disconnecting",()=>{
            const userleaving= socketIdToId[socket.id]
            rooms[userleaving.roomId].users=rooms[userleaving.roomId].users.filter((user)=>{return user.id!=userleaving.id})
            if(rooms[userleaving.roomId].users.length===0) delete rooms[userleaving.roomId]
            delete idToSocketId[userleaving.id]
            delete socketIdToId[socket.id]
        })

        socket.on("sent-message",(roomId, message, sender)=>{
            socket.to(roomId).emit("sent-message-recived",{message, sender})
        })

        socket.on("start-game",({roomId})=>{
            socket.to(roomId).emit("start-my-game",{})
        })

        socket.on("selected-word",({roomId, word})=>{
            socket.to(roomId).emit("selected-word-recive",{word})
            rooms[roomId].word=word
        })

        socket.on("score-update",({roomId, playerId, points})=>{
            const user = rooms[roomId].users.find(user => user.id == playerId)
            user.points=points
        })

        

    });
}

export {rooms}