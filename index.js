const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 8000;

const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nhcslav.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db('microtaskearning');
    const usersCollection = db.collection('users');

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '365d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true });
    });

    app.get('/logout', async (req, res) => {
      try {
        res.clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        }).send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

   // In your Express backend
app.post('/users', async (req, res) => {
  try {
      const { name, email, photoURL, role } = req.body;
      // Validate user data here if needed
      const newUser = { name, email,photoURL, role };
      const result = await usersCollection.insertOne(newUser);
      res.status(201).send(result);
  } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).send({ message: 'Failed to create user' });
  }
});

//  Query user role endpoint
// In your Express backend

app.get('/users/role/:email', async (req, res) => {
  try {
    const { email } = req.params;
    // Query the database to fetch the user's role based on the email address
    // Assuming you have a MongoDB collection named 'users'
    const user = await usersCollection.findOne({ email });
    if (user) {
      // If user is found, send back the role
      res.status(200).json({ role: user.role });
    } else {
      // If user is not found, return a 404 Not Found error
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user role:', error);
    // If there's an error, return a 500 Internal Server Error
    res.status(500).send({ message: 'Failed to fetch user role' });
  }
});


    

    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello from micro task Server..');
});

app.listen(port, () => {
  console.log(`micro task is running on port ${port}`);
});
