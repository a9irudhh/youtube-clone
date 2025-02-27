import mongoose from "mongoose"
import {DB_NAME} from "../constants.js"

const connectDB = async () => {
    try {
        if(!process.env.MONGODB_URI){
            throw new Error("Mongo URI is missing")
        }
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`Connected to DB: ${connectionInstance.connection.host}`)
        
    } catch (error) {
        console.error("Error while connecting to DB", error)
    }
} 

export default connectDB