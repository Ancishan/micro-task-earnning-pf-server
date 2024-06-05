const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    const tasksCollection = db.collection('tasks');

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

    app.post('/users', async (req, res) => {
      try {
        const { name, email, photoURL, role } = req.body;
        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          const updatedUser = await usersCollection.updateOne(
            { email },
            { $set: { name, photoURL, role } }
          );
          return res.status(200).send({ success: true, message: 'User updated successfully', updatedUser: existingUser });
        } else {
          const newUser = { name, email, photoURL, role };
          const { insertedId } = await usersCollection.insertOne(newUser);
          const createdUser = await usersCollection.findOne({ _id: insertedId });
          res.status(201).send({ success: true, message: 'User created successfully', newUser: createdUser });
        }
      } catch (error) {
        console.error('Error creating or updating user:', error);
        res.status(500).send({ message: 'Failed to create or update user' });
      }
    });

    app.get('/users/role/:email', async (req, res) => {
      try {
        const { email } = req.params;
        const user = await usersCollection.findOne({ email });
        if (user) {
          res.status(200).json({ role: user.role });
        } else {
          res.status(404).json({ message: 'User not found' });
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        res.status(500).send({ message: 'Failed to fetch user role' });
      }
    });
    app.get('/tasks', async (req, res) => {
      const cursor = tasksCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post('/tasks', async (req, res) => {
      try {
        const { task_title, task_detail, task_quantity, payable_amount, completion_date, submission_info, task_image_url, user_email } = req.body;
        const newTask = { task_title, task_detail, task_quantity, payable_amount, completion_date, submission_info, task_image_url, createdBy: user_email };
        const result = await tasksCollection.insertOne(newTask);
        res.status(201).send(result);
      } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send({ message: 'Failed to create task' });
      }
    });

    app.get('/tasks/:createdBy', async (req, res) => {
      try {
        const { createdBy } = req.params;
        const result = await tasksCollection.find({ createdBy }).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send({ message: 'Failed to fetch tasks' });
      }
    });

    // Update task
    app.put('/tasks/:id', async (req, res) => {
      const { id } = req.params;
      const { task_title, task_detail, task_quantity, payable_amount } = req.body;
      try {
        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { task_title, task_detail, task_quantity, payable_amount } }
        );
        res.status(200).send(result);
      } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).send({ message: 'Failed to update task' });
      }
    });

    app.delete('/tasks/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
        if (!task) {
          return res.status(404).send({ message: 'Task not found' });
        }
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        const user = await usersCollection.findOne({ email: task.createdBy });
        if (user) {
          const coinsToAdd = task.task_quantity * task.payable_amount;
          await usersCollection.updateOne(
            { email: task.createdBy },
            { $inc: { coins: coinsToAdd } }
          );
        }
        res.status(200).send(result);
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).send({ message: 'Failed to delete task' });
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