import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../model/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const VerifyJWT = asyncHandler(async (req, res, next) => {
  const accessToken =
    req.cookies?.accessToken ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!accessToken) {
    throw new ApiError(401, 'User unauthorized');
  }

  let decoded;
  try {
    decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired access token');
  }

  const user = await User.findById(decoded.id).select('-password -refreshToken');
  if (!user) {
    throw new ApiError(401, 'User unauthorized');
  }

  req.user = user;
  next();
});

export { VerifyJWT };
