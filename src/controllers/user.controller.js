import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import {uploadFile} from "../utils/cloudinary.js"

const registerUser = asyncHandler(async (req, res) => {
    /*
     get user details from frontend (req)
     validate user details (not empty, valid email, etc) (this can be done with zod as well)
     check if user already exists
     check for images, avatar, etc
     upload images to cloudinary
     create entry in database by creating a user object
     remove password from user object and refresh token
     check for user creation errors
     return response to frontend
    */
    
    const { email, password, fullName, userName } = req.body
    if(!email || !password || !fullName || !userName) {
        throw new ApiError(400, "Please fill in all fields")
    }

    const user = await User.findOne({
        $or: [{email: email}, {userName: userName}] 
    })

    if(user) {
        throw new ApiError(400, "User already exists")
    }

    const avatarPath = req.files?.avatar[0]?.path;
    const coverImagePath = req.files?.coverImage[0]?.path;

    // console.log("HERE : ", req.files)
    
    if (!avatarPath || !coverImagePath) {
        throw new ApiError(400, "Please upload images")
    }

    const avatar = await uploadFile(avatarPath)
    const coverImage = await uploadFile(coverImagePath)

    // console.log("AVATAR : ", avatar)
    // console.log("COVER IMAGE : ", coverImage)

    if(!avatar || !coverImage) {
        throw new ApiError(500, "Error uploading images")
    }

    const newUser = await User.create({
        userName: userName.toLowerCase(),
        fullName,
        email,
        avatar: avatar || "",
        coverImage : coverImage || "",
        password
    })

    // console.log("NEW USER : ", newUser)
    const userCreated = await User.findById(newUser._id).select("-password -refreshToken")

    // console.log("USER CREATED : ", userCreated)
    if(!userCreated) {
        throw new ApiError(500, "Error creating user")
    }

    return res.status(201).json(new ApiResponse(200, "User created successfully", userCreated))
})

export { registerUser }