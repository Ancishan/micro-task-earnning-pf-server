const express = require('express');
const app = express();
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const submissionsCollection = db.collection('submissions');

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
    });

    app.get('/view/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await tasksCollection.findOne({ _id: new ObjectId(id) });
        if (!result) {
          return res.status(404).json({ message: "Task not found" });
        }
        res.json(result);
      } catch (error) {
        console.error("Error fetching task details:", error);
        res.status(500).json({ message: "Failed to fetch task details" });
      }
    });

    app.post('/tasks', async (req, res) => {
      try {
        const { task_title, task_detail, task_quantity, payable_amount, completion_date, task_image_url, user_email, user_name } = req.body;
        const newTask = { task_title, task_detail, task_quantity, payable_amount, completion_date, task_image_url, createdBy: user_email, user_name };
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

    app.post('/submissions', async (req, res) => {
      try {
        const { task_id, task_title, task_detail, task_img_url, payable_amount, worker_email, submission_details, worker_name, creator_name, creator_email, current_date, status } = req.body;

        const newSubmission = {
          task_id: new ObjectId(task_id),
          task_title,
          task_detail,
          task_img_url,
          payable_amount,
          worker_email,
          submission_details,
          worker_name,
          creator_name,
          creator_email,
          current_date: new Date(current_date),
          status
        };

        const result = await submissionsCollection.insertOne(newSubmission);
        res.status(201).send(result);
      } catch (error) {
        console.error('Error submitting task:', error);
        res.status(500).send({ message: 'Failed to submit task' });
      }
    });

    app.get('/submissions/exists', async (req, res) => {
      const { task_id, worker_email } = req.query;
      try {
          const submission = await submissionsCollection.findOne({ task_id: new ObjectId(task_id), worker_email });
          if (submission) {
              return res.status(200).send({ exists: true });
          }
          res.status(200).send({ exists: false });
      } catch (error) {
          console.error('Error checking submission existence:', error);
          res.status(500).send({ message: 'Failed to check submission existence' });
      }
  });
  

    app.get('/submissions', async (req, res) => {
      const { worker_email, creator_email, status } = req.query;
      const query = {};
      if (worker_email) query.worker_email = worker_email;
      if (creator_email) query.creator_email = creator_email;
      if (status) query.status = status;
      try {
        const submissions = await submissionsCollection.find(query).toArray();
        res.status(200).send(submissions);
      } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).send({ message: 'Failed to fetch submissions' });
      }
    });

    app.put('/submissions/:id', async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      try {
        const submission = await submissionsCollection.findOne({ _id: new ObjectId(id) });
        if (!submission) {
          return res.status(404).send({ message: 'Submission not found' });
        }
        
        await submissionsCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });

        if (status === 'approved') {
            const coinsToAdd = submission.payable_amount;
            await usersCollection.updateOne(
                { email: submission.worker_email },
                { $inc: { coins: coinsToAdd } }
            );
        }

        res.status(200).send({ message: 'Submission updated successfully' });
      } catch (error) {
        console.error('Error updating submission:', error);
        res.status(500).send({ message: 'Failed to update submission' });
      }
    });

    app.put('/users/update-coins', async (req, res) => {
      const { email, coins } = req.body;
      try {
        await usersCollection.updateOne(
          { email },
          { $inc: { coins } }
        );
        res.status(200).send({ message: 'User coins updated successfully' });
      } catch (error) {
        console.error('Error updating user coins:', error);
        res.status(500).send({ message: 'Failed to update user coins' });
      }
    });

    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

  } finally {
    // Ensure client.close() is not called here, to keep the connection open.
  }
}

run().catch(console.dir);
