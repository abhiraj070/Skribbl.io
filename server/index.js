import 'dotenv/config';
import {server, io} from './app.js';
import { connectDB } from './src/db/dbconnect.js';
import { InitliseIO } from './src/socket/socket.js';

const PORT = process.env.PORT;


try {
  await connectDB();
  
  InitliseIO(io);
  console.log("IO initialized");

  server.listen(PORT, () => {  
    console.log(`Server running on port ${PORT}`);
  });
} catch (error) {
  console.log("Error initializing IO", error);
  process.exit(1);
}
