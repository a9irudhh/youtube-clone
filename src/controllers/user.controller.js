import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import {uploadFile} from "../utils/cloudinary.js"


const generateToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found");
        }

        const accessToken = await user.generateToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        // console.log("Generated Tokens:", { refreshToken, accessToken });

        return { refreshToken, accessToken };
    } catch (error) {
        // console.error("Error generating tokens:", error);
        throw new ApiError(500, "Error generating token");
    }
};



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

const loginUser = asyncHandler(async (req, res) => {
    /*
        get the email and password from the frontend
        validate the email and password
        check if the user exists
        check if the password is correct
        generate a token (access token and refresh token)
        save the refresh token in the database
        return the cookie with the refresh token
    */
    const { email, password } = req.body
    if(!email || !password) {
        throw new ApiError(400, "Please fill in all fields")
    }

    const user = await User.findOne({email})
    if(!user) {
        throw new ApiError(400, "User does not exist")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)
    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Credentials")
    }

    const tokens = await generateToken(user._id);

    // console.log("TOKENS : ", tokens)
    const { refreshToken, accessToken } = tokens;

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(new ApiResponse(200, {userTokens: {accessToken, refreshToken}}, "User logged in successfully"))
})

const logoutUser = asyncHandler(async (req, res) => {
    /*
        get the user from the request
        remove the refresh token from the user
        return the response
    */
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {new: true}
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, "User logged out successfully"))
})
export { registerUser, loginUser, logoutUser }