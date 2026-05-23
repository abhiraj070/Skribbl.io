import { selectWords } from "../utils/words.js";

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
                    word: {},
                    nextChance: 0,
                    rounds: 0
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
        const selectionTimer= {}
        socket.on("start-game",({roomId, rounds})=>{
            io.to(roomId).emit("start-my-game",{})
            rooms[roomId].rounds=rounds
            function initialCountDown(){
                io.to(roomId).emit("Starting-Phase",{phase: "STARTING", duration: 5})
                setTimeout(()=>{
                    startWordSelection();
                },5000)
            }
            let selectedWords
            function startWordSelection(){
                selectedWords= selectWords()
                const room=rooms[roomId]
                socket.to(room.users[room.nextChance]).emit("Word-Selection-Phase",{words: selectedWords, duration: 10})
                room.users.length<room.nextChance-1 ? room.nextChance+=1: room.nextChance=0

                selectionTimer[roomId]= setTimeout(()=>{
                    autoPickWord()
                },10000)
            }
            function autoPickWord(){
                const idx= Math.floor(Math.random()*3)
                const room=rooms[roomId]
                socket.to(room.nextChance-1).emit("Drawing-Phase",{wordSelected: selectedWords[idx], duration: 100})
                socket.to(roomId).emit("Gussing-Phase",{lengthOfWordSelected: selectedWords[idx].length, duration: 100})
                setInterval(()=>{
                    endRound()
                },100000)
            }
            function endRound(){
                io.to(roomId).emit("Show-Result-Phase",{duration: 10})
                const room=rooms[roomId]
                room.rounds-=1;
                rooms.rounds===0 ? endGame() : startWordSelection()
            }
            function endGame(){
                io.to(roomId).emit("Game-End-Phase",{})
            }

        })

        socket.on("word-selected",({selectedWord,roomId})=>{
            clearTimeout(selectionTimer[roomId])
            const room=rooms[roomId]
            socket.to(room.nextChance-1).emit("Drawing-Phase",{wordSelected: selectedWord})
            socket.to(roomId).emit("Gussing-Phase",{lengthOfWordSelected: selectedWord.length})
            setInterval(()=>{
                endRound()
            },100000)

            function endRound(){
                io.to(roomId).emit("Show-Result-Phase",{duration: 10})
                const room=rooms[roomId]
                room.rounds-=1;
                rooms.rounds===0 ? endGame() : startWordSelection()
            }
            function endGame(){
                io.to(roomId).emit("Game-End-Phase",{})
            }
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