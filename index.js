const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000


// middleware 
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ttjbmkn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// token verify middleware 

const verifyToken = async(req, res, next) => {
  const token = req.cookies.token
  if(!token){
    return res.status(401).send({message: 'unauthorized'})
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'unauthorized access'})
    }

    req.user = decoded
    
    next()
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db('carDoctor').collection('services')
    const bookingCollection = client.db('carDoctor').collection('booking')

    // auth related API

    app.post('/jwt', async(req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '2h'})

      res
      .cookie('token', token, {
        httpOnly: true, 
        secure: true,
        sameSite: 'none'
        
      })
      .send({success: true})
    })

    // token clear API

    app.post('/logout', async(req, res) => {
      const user = req.body
      console.log(user);
      res
      .clearCookie('token', {maxAge: 0})
      .send({success: true})
    })


    // app.post('/jwt', async(req, res) => {
    //   const user = req.body
    //   console.log(user);
    //  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '2h'})
    //  res
    //  .cookie('token', token, {
    //   httpOnly: true,
    //   secure: false
    //  })
    //  .send({success: true})
    // })


    // service related api
    app.get('/services', async(req, res) => {
      console.log(req.query);
        const filter = req.query
        const query = {
          // filter kore data pabo 
          // price: {$gt: 20}

          title: {$regex: filter.search, $options: 'i'}
        }
        const options = {
          sort: {
            price: filter.sort === 'acc' ? 1 : -1
          }
        }
        console.log(query);
        const result = await serviceCollection.find(query, options).toArray()
        res.send(result)
    })

    app.get('/services/:id', async(req, res) => {
        const id = req.params.id
        const filter = { _id : new ObjectId(id)}
        const options = {
            // Include only the `title` and `price` fields in the returned document
            projection: { title: 1, price: 1, img: 1 },
          };
        const result = await serviceCollection.findOne(filter, options)
        res.send(result)
    })

    // booking 

    app.get('/bookings', verifyToken, async(req, res) => {
      console.log(req.query.email);
      console.log('token owner info', req.user); 
      
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      let query = {}
      if(req.query?.email){
        query = {email: req.query.email}
      }

      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/bookings', async(req, res) => {
      const booking = req.body
      console.log(booking);
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.patch('/bookings/:id', async(req, res) => {
      const id = req.params.id
      const filter = { _id : new ObjectId(id)}
      const updatedBooking = req.body
      console.log(updatedBooking);
      const updateDoc = {
        $set: {
          status: updatedBooking.status
        },
      };

      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)
      
    })

    app.delete('/bookings/:id', async(req, res) => {
      const id = req.params.id
      const filter = {_id : new ObjectId(id)}
      const result = await bookingCollection.deleteOne(filter)
      res.send(result)
    })

    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('car doctor server is running.')
})

app.listen(port, () => {
    console.log(`server is running on port : ${port}`);
})