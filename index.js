const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
// const nodemailer = require('nodemailer')
// const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
// const jwt = require('jsonwebtoken')
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 8000
// const { Resend } = require('resend')
// const resend = new Resend(api_key)
// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
// app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nhcslav.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db('microtaskearning')
    const usersCollection = db.collection('users')
  
   

        

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})


app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})
