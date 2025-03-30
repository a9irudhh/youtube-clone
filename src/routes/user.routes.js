import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken, changePassword, getCurrentUser, updateUserDetails, updateUserAvatar, updateCoverPath, getUserChannel, getUserHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
    upload.fields([
        {name: "avatar", maxCount: 1},
        {name: "coverImage", maxCount: 1}
    ]),
    registerUser)
router.route("/login").post(loginUser)

// secure routes
router.route("/logout").post(verifyJwt, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/changePassword").post(verifyJwt, changePassword)
router.route("/currentUser").post(verifyJwt, getCurrentUser)
router.route("/updateDetails").patch(verifyJwt, updateUserDetails)
router.route("/avatar").patch(verifyJwt, upload.single("avatar"), updateUserAvatar)
router.route("/coverPhoto").patch(verifyJwt, upload.single("coverImage"), updateCoverPath)
router.route("/channel/:userName").get(verifyJwt, getUserChannel)
router.route("/watchHistory").get(verifyJwt, getUserHistory)
export default router;
