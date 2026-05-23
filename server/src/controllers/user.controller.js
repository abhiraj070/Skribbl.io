import { User } from '../model/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { rooms } from '../socket/socket.js';

const getCookieOptions = () => {
    const isProd = process.env.NODE_ENV === "production"
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        path: "/",
    }
}
const register= asyncHandler(async (req,res) => {
    const {name, email, password}= req.body
    if(!name || !email || !password){
        throw new ApiError(400, "All fields are required")
    }
    const isUserNew= await User.findOne({email})
    if(isUserNew){
        throw new ApiError(400, "User already exists")
    }
    
    const user= await User.create({
        name,
        email,
        password,
    })
    if(!user){
        throw new ApiError(500, "Error while creating user")
    }
    const registeredUser= await User.findById(user._id).select("-refreshToken -password")
    return res
    .status(200)
    .json(new ApiResponse(200,{user:registeredUser},"User Registered successfully"))

})

const login= asyncHandler(async (req, res) => {
    const {email, password}= req.body
    if(!email || !password){
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findOne({ email }).select('+password');
    if(!user){
        throw new ApiError(400, "User not registered")
    }
    const isPasswordCorrect= await user.isPasswordCorrect(password)
    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid password")
    }
    const accessToken= await user.generateAccessToken()
    const refreshToken= await user.generateRefreshToken()

    if(!accessToken || !refreshToken){
        throw new ApiError(500,"Error while generating tokens")
    }

    const cookieOptions = {
        ...getCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
    }

    user.refreshToken= refreshToken;
    await user.save({validateBeforeSave: false})
    const loggedUser= await User.findById(user._id).select("-password -refreshToken")

    return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200,{user: loggedUser, accessToken},"User logged in successfully"))
})

const logout = asyncHandler(async (req, res) => {
    const cookieOptions = getCookieOptions()

    await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } })

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const getRoomUsers = asyncHandler(async (req, res) => {
    const { roomId } = req.query

    if (!roomId) {
        throw new ApiError(400, "roomId is required")
    }

    const room = rooms[roomId]
    if (!room) {
        throw new ApiError(404, "Room not found")
    }

    const dbUsers = await User.find({ _id: { $in: room.users.map((u) => u.id) } })
        .select('name')
        .lean()

    const nameById = Object.fromEntries(dbUsers.map((u) => [String(u._id), u.name]))

    const users = room.users.map((u) => ({
        username: u.username,
        name: nameById[String(u.id)] ?? null,
        points: u.points ?? 0,
    }))

    return res
        .status(200)
        .json(new ApiResponse(200, { users, word: room.word }, "Room users fetched successfully"))
})

const getRoomWord = asyncHandler(async (req, res) => {
    const { roomId } = req.query

    if (!roomId) {
        throw new ApiError(400, "roomId is required")
    }

    const room = rooms[roomId]
    if (!room) {
        throw new ApiError(404, "Room not found")
    }

    const word = room.word
    if (!word || (typeof word === "object" && Object.keys(word).length === 0)) {
        throw new ApiError(404, "Word not set")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, word, "Room word fetched successfully"))
})

export { login, register, logout, getRoomUsers, getRoomWord }