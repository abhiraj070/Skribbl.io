import { JWT } from "jsonwebtoken"
import { ApiError } from "../utils/ApiError"
import { User } from "../model/user.model"
const VerifyJWT= async (req, res, next)=>{
    const accessToken= req.cookies?.accessToken || req.headers("Authorization")?.replace("Bearer ","")
    if(!accessToken){
        throw new ApiError(401, "user unathorized")
    }
    const decodedUser= await JWT.Verify(accessToken, process.env.ACCESS_TOKEN_EXPIRY)
    const user= await User.findById(decodedUser._id).select("-password -refreshToken")
    if(!decodedUser){
        throw new ApiError(401,"user unathorized")
    }
    req.user= user
    await req.save()
    next()
}

export {VerifyJWT}