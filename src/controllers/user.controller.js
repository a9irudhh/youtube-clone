import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import {uploadFile} from "../utils/cloudinary.js"
import jwt from "jsonwebtoken";

const options = {
    httpOnly: true,
    secure: true
}

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

    return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async(req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorised access")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken?._id)
        if(!user) {
            throw new ApiError(404, "User not found")
        }
    
        if(user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        
        const {newRefreshToken, newAccessToken} = await generateToken(user._id)
        return res
        .status(200)
        .cookie("accessToken", newAccessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(200, {accessToken: newAccessToken, refreshToken: newRefreshToken}, "Token refreshed successfully"))
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")        
    }

})

const changePassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body;
    if(!oldPassword || !newPassword) {
        throw new ApiError(400, "Please fill in all fields")
    }

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid password")
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
     
    return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully"))

})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User found"))
}) 

const updateUserDetails = asyncHandler(async (req, res) => {
    const {userName, fullName, email} = req.body;
    if(!userName || !fullName || !email) {
        throw new ApiError(400, "Please fill in all fields")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id, {
            $set: {
                userName: userName.toLowerCase(),
                fullName,
                email
            }
        },
        {new: true}).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarPath = req.file?.path;
    if(!avatarPath) {
        throw new ApiError(400, "Please upload an image")
    }

    const avatar = await uploadFile(avatarPath)
    if(!avatar) {
        throw new ApiError(500, "Error uploading avatar")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            avatar
        }
    }, {new: true}).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"))
})

const updateCoverPath = asyncHandler(async (req, res) => {
    const coverPath = req.file?.path;
    if(!coverPath) {
        throw new ApiError(400, "Please upload an image")
    }

    const coverImage = await uploadFile(coverPath)
    if(!coverImage) {
        throw new ApiError(500, "Error uploading coverImage")
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage
        }
    }, {new: true}).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"))
})

const getUserChannel = asyncHandler(async(req, res) => {
    const userName = req.params;
    if(!userName) {
        throw new ApiError(400, "Please provide a username")
    }

    const channel = await User.aggregate([
        {
            $match : {
                userName: userName.toLowerCase()
            }
        },
        {
            $lookup : {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscriber"
            }
        },
        {
            $lookup : {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields : {
                subscriberCount: { $size: "$subscriber" },
                subscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscriber.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                subscriber: 0,
                subscribedTo: 0
            }
        }
    ])

    if(!channel) {
        throw new ApiError(404, "User not found")
    }
    console.log("CHANNEL : ", channel)
    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User found"))

})

const getUserHistory = asyncHandler(async (req, res) => {
        const user = await User.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(req.user?._id)
                }
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "history",
                    foreignField: "_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "owner",
                                foreignField: "_id",
                                as: "ownerDetails"
                            }
                        },
                        {
                            $addFields: {
                                owner: { $first: "$ownerDetails" }
                            }
                        },
                        {
                            $project: {
                                title: 1,
                                thumbnail: 1,
                                duration: 1,
                                views: 1,
                                owner: {
                                    fullName: 1,
                                    userName: 1,
                                    avatar: 1
                                }
                            }
                        }
                    ]
                }
            }
        ]);

    return res
    .status(200)
    .json(new ApiResponse(200, user[0]?.watchHistory || [], "User watch history retrieved successfully"));
});

export { registerUser, loginUser, logoutUser, refreshAccessToken, changePassword, getCurrentUser, updateUserDetails , updateUserAvatar, updateCoverPath, getUserChannel, getUserHistory}