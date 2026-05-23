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
            socketIdToId[socket.id]={id: socket.id, roomId: roomId}
        })

        socket.on("leave-room",(roomId, leftId)=>{
            if(!rooms[roomId]) return 
            rooms[roomId].users= rooms[roomId].users.filter((user)=>{return user.id!=leftId})
            socket.leave(roomId)
        })

        socket.on("disconnecting",()=>{
            const entry = socketIdToId[socket.id]
            if(!entry){
                return
            }

            let userId, roomId
            if(typeof entry === "string"){
                userId = entry
                for(const rid of Object.keys(rooms)){
                    if(rooms[rid]?.users?.some((u)=>u.id == userId)){
                        roomId = rid
                        break
                    }
                }
            } else {
                userId = entry.id
                roomId = entry.roomId
            }

            if(roomId && rooms[roomId]){
                rooms[roomId].users = rooms[roomId].users.filter((u)=>u.id != userId)
                if(rooms[roomId].users.length === 0){
                    delete rooms[roomId]
                } else {
                    io.to(roomId).emit("user-left", { userId })
                }
            }

            if(userId) delete idToSocketId[userId]
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
                socket.to(idToSocketId[room.users[room.nextChance]]).emit("Word-Selection-Phase",{words: selectedWords, duration: 10})
                room.users.length-1>room.nextChance ? room.nextChance+=1: room.nextChance=0

                selectionTimer[roomId]= setInterval(()=>{
                    autoPickWord()
                },10000)
            }
            function autoPickWord(){
                const idx= Math.floor(Math.random()*3)
                const room=rooms[roomId]
                socket.to(idToSocketId[room.users[room.nextChance-1]]).emit("Drawing-Phase",{wordSelected: selectedWords[idx], duration: 100})
                socket.to(roomId).emit("Gussing-Phase",{lengthOfWordSelected: selectedWords[idx].length, duration: 100})
                setInterval(()=>{
                    io.to(roomId).emit("Correct-Word",{corectWord: selectedWords[idx]})
                    endRound()
                },100000)
            }
            function endRound(){
                io.to(roomId).emit("Show-Result-Phase",{duration: 10})
                const room=rooms[roomId]
                room.rounds-=1;
                setInterval(()=>{
                    room.rounds===0 ? endGame() : startWordSelection()
                },10000)
            }
            function endGame(){
                io.to(roomId).emit("Game-End-Phase",{})
            }

        })

        socket.on("word-selected",({selectedWord,roomId})=>{
            clearInterval(selectionTimer[roomId])
            const room=rooms[roomId]
            socket.to(room.nextChance-1).emit("Drawing-Phase",{wordSelected: selectedWord})
            socket.to(roomId).emit("Gussing-Phase",{lengthOfWordSelected: selectedWord.length})
            setInterval(()=>{
                io.to(roomId).emit("Correct-Word",{corectWord: selectedWord})
                endRound()
            },100000)

            function endRound(){
                io.to(roomId).emit("Show-Result-Phase",{duration: 10})
                const room=rooms[roomId]
                room.rounds-=1;
                setInterval(()=>{
                    room.rounds===0 ? endGame() : startWordSelection()
                },10000)
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