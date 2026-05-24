import { selectWords } from "../utils/words.js";

const rooms = {}, socketIdToId = {}, idToSocketId = {}
const selectionTimer = {}, drawingTimer = {}, resultTimer = {}
const roundWords = {}

function clearRoomTimers(roomId) {
    if (selectionTimer[roomId]) {
        clearTimeout(selectionTimer[roomId])
        delete selectionTimer[roomId]
    }
    if (drawingTimer[roomId]) {
        clearTimeout(drawingTimer[roomId])
        delete drawingTimer[roomId]
    }
    if (resultTimer[roomId]) {
        clearTimeout(resultTimer[roomId])
        delete resultTimer[roomId]
    }
}

function getDrawerSocketId(room) {
    const drawer = room.users[room.currentDrawerIndex]
    return drawer ? idToSocketId[drawer.id] : null
}

export const InitliseIO = (io) => {
    function beginDrawingPhase(roomId, word) {
        const room = rooms[roomId]
        if (!room) return

        room.canvasObjects = []
        io.to(roomId).emit("canvas-operation", { type: "CLEAR", roomId })

        const drawerSocketId = getDrawerSocketId(room)
        if (drawerSocketId) {
            io.to(drawerSocketId).emit("Drawing-Phase", { wordSelected: word, duration: 100 })
            io.to(roomId).except(drawerSocketId).emit("Gussing-Phase", { lengthOfWordSelected: word.length, duration: 100 })
        } else {
            io.to(roomId).emit("Gussing-Phase", { lengthOfWordSelected: word.length, duration: 100 })
        }
        room.word = word

        if (drawingTimer[roomId]) clearTimeout(drawingTimer[roomId])
        drawingTimer[roomId] = setTimeout(() => {
            io.to(roomId).emit("Correct-Word", { corectWord: word })
            endTurn(roomId)
        }, 100000)
    }

    function startWordSelection(roomId) {
        const room = rooms[roomId]
        if (!room) return

        const words = selectWords()
        roundWords[roomId] = words
        const drawerSocketId = getDrawerSocketId(room)
        const drawer = room.users[room.currentDrawerIndex]
        const drawerName = drawer?.username || "Someone"

        io.to(roomId).emit("Word-Selection-Waiting", { duration: 10, drawerName })

        if (drawerSocketId) {
            io.to(drawerSocketId).emit("Word-Selection-Phase", { words, duration: 10, drawerName })
        }

        if (selectionTimer[roomId]) clearTimeout(selectionTimer[roomId])
        selectionTimer[roomId] = setTimeout(() => autoPickWord(roomId), 10000)
    }

    function autoPickWord(roomId) {
        const room = rooms[roomId]
        const words = roundWords[roomId]
        if (!room || !words) return

        const idx = Math.floor(Math.random() * 3)
        beginDrawingPhase(roomId, words[idx])
    }

    function endTurn(roomId) {
        const room = rooms[roomId]
        if (!room) return
        if(room.currentDrawerIndex==room.users.length-1){
            room.rounds-=1
        }
        io.to(roomId).emit("Show-Result-Phase", { duration: 10 })
        if (resultTimer[roomId]) clearTimeout(resultTimer[roomId])
        resultTimer[roomId] = setTimeout(() => {
            if (room.rounds <= 0) {
                endGame(roomId)
            } else {
                room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.users.length
                room.totalAnswered=0
                startWordSelection(roomId)
            }
        }, 10000)
    }

    function endGame(roomId) {
        clearRoomTimers(roomId)
        delete roundWords[roomId]
        io.to(roomId).emit("Game-End-Phase", {})
    }

    io.on('connection', (socket) => {

        console.log('a user connected', socket.id);
        const userId = socket.handshake.auth.userId
        socketIdToId[socket.id] = userId
        idToSocketId[userId] = socket.id

        socket.on("create-room", ({ roomId, hostId, username }) => {
            if (rooms[roomId]) return
            socket.join(roomId)
            rooms[roomId] = {
                host: hostId,
                users: [],
                word: {},
                currentDrawerIndex: 0,
                rounds: 0,
                canvasObjects: [],
                totalAnswered: 0
            }
            rooms[roomId].users.push({ id: hostId, username: username, points: 0 })
            socketIdToId[socket.id] = { id: hostId, roomId }
        })

        socket.on("join-room", ({ roomId, joinerId, username }) => {
            if (!rooms[roomId]) return
            rooms[roomId].users.push({ id: joinerId, username: username, points: 0 })
            socket.join(roomId)
            socketIdToId[socket.id] = { id: joinerId, roomId }
        })

        socket.on("leave-room", (roomId, leftId, username) => {
            if (!rooms[roomId]) return
            const name =
                username ||
                rooms[roomId].users.find((u) => u.id == leftId)?.username ||
                "Someone"
            rooms[roomId].users = rooms[roomId].users.filter((user) => user.id != leftId)
            socket.leave(roomId)
            socket.to(roomId).emit("leave-room-mesaage", {
                message: `${name} left the game`,
            })
        })

        socket.on("disconnecting", () => {
            const entry = socketIdToId[socket.id]
            if (!entry) {
                return
            }

            let userId, roomId
            if (typeof entry === "string") {
                userId = entry
                for (const rid of Object.keys(rooms)) {
                    if (rooms[rid]?.users?.some((u) => u.id == userId)) {
                        roomId = rid
                        break
                    }
                }
            } else {
                userId = entry.id
                roomId = entry.roomId
            }

            if (roomId && rooms[roomId]) {
                const leaving = rooms[roomId].users.find((u) => u.id == userId)
                const leaveName = leaving?.username || "Someone"
                rooms[roomId].users = rooms[roomId].users.filter((u) => u.id != userId)
                if (rooms[roomId].users.length === 0) {
                    clearRoomTimers(roomId)
                    delete roundWords[roomId]
                    delete rooms[roomId]
                } else {
                    io.to(roomId).emit("leave-room-mesaage", {
                        message: `${leaveName} left the game`,
                    })
                }
            }

            if (userId) delete idToSocketId[userId]
            delete socketIdToId[socket.id]
        })

        socket.on("sent-message", (roomId, message, sender) => {
            socket.to(roomId).emit("sent-message-recived", { message, sender })
        })

        socket.on("start-game", ({ roomId, rounds }) => {
            io.to(roomId).emit("start-my-game", {})
            rooms[roomId].rounds = rounds
            rooms[roomId].currentDrawerIndex = 0

            io.to(roomId).emit("Starting-Phase", { phase: "STARTING", duration: 5 })
            setTimeout(() => startWordSelection(roomId), 5000)
        })

        socket.on("word-selected", ({ selectedWord, roomId }) => {
            if (selectionTimer[roomId]) {
                clearTimeout(selectionTimer[roomId])
                delete selectionTimer[roomId]
            }
            beginDrawingPhase(roomId, selectedWord)
        })

        socket.on("selected-word", ({ roomId, word }) => {
            io.to(roomId).emit("selected-word-recive", { word })
            rooms[roomId].word = word
        })

        socket.on("score-update", ({ roomId, playerId, points }) => {
            const user = rooms[roomId].users.find((u) => u.id == playerId)
            if (user) {
                user.points = (user.points ?? 0) + points
            }
        })

        socket.on("canvas-operation", (operation) => {
            if (!operation || typeof operation !== "object") return
            const { type, roomId } = operation
            const room = rooms[roomId]
            if (!room) return

            const entry = socketIdToId[socket.id]
            const userId = typeof entry === "string" ? entry : entry?.id
            const inRoom = room.users.some((u) => u.id == userId)
            if (!inRoom) return

            if (!Array.isArray(room.canvasObjects)) room.canvasObjects = []

            switch (type) {
                case "ADD_OBJECT": {
                    if (!operation.objectData) return
                    room.canvasObjects.push(operation.objectData)
                    break
                }
                case "REMOVE_OBJECT": {
                    if (!operation.objectId) return
                    room.canvasObjects = room.canvasObjects.filter(
                        (o) => o.objectId !== operation.objectId
                    )
                    break
                }
                case "CLEAR": {
                    room.canvasObjects = []
                    break
                }
                default:
                    return
            }

            socket.to(roomId).emit("canvas-operation", operation)
        })

        socket.on("request-canvas-state", ({ roomId }) => {
            const room = rooms[roomId]
            if (!room) return
            socket.emit("canvas-state", {
                objects: Array.isArray(room.canvasObjects) ? room.canvasObjects : [],
            })
        })

        socket.on("word-guessed",(roomId)=>{
            const room= rooms[roomId]
            room.totalAnswered+=1;
            if(room.totalAnswered==room.users.length-1){
                clearRoomTimers(roomId)
                io.to(roomId).emit("Correct-Word", { corectWord: room.word })
                endTurn(roomId)
            }
        })

    });
}

export { rooms }
