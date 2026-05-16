import mongoose from "mongoose";
 
export const connectDB = async () => {
   
   try {
     if(!process.env.MONGO_URI || !process.env.DB_NAME) {
       throw new Error("MONGO_URI and DB_NAME are required in .env file");
    }
    const conn = await mongoose.connect(process.env.MONGO_URI,{
        dbName: process.env.DB_NAME
    })
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
   }catch(err){
     console.error("❌ MongoDB connection error:", err);
     // 3. Exit process with failure (1) so the server doesn't stay 
    // hanging in a broken state
    process.exit(1);
   }
}
