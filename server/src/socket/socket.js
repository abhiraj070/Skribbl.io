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
            endRound(roomId)
        }, 100000)
    }

    function startWordSelection(roomId) {
        const room = rooms[roomId]
        if (!room) return

        const words = selectWords()
        roundWords[roomId] = words
        const drawerSocketId = getDrawerSocketId(room)

        io.to(roomId).emit("Word-Selection-Waiting", { duration: 10 })

        if (drawerSocketId) {
            io.to(drawerSocketId).emit("Word-Selection-Phase", { words, duration: 10 })
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

    function endRound(roomId) {
        const room = rooms[roomId]
        if (!room) return

        io.to(roomId).emit("Show-Result-Phase", { duration: 10 })
        room.rounds -= 1

        if (resultTimer[roomId]) clearTimeout(resultTimer[roomId])
        resultTimer[roomId] = setTimeout(() => {
            if (room.rounds <= 0) {
                endGame(roomId)
            } else {
                room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.users.length
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
                rounds: 0
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

    });
}

export { rooms }
