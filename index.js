const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5ajuo.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
  try{
    await client.connect();
    const itemsCollection = client.db('ElectricItems').collection('items');

    //get all items
    app.get('/items', async(req, res) => {
      const query = {};
      const result = await itemsCollection.find().toArray();
      res.send(result);
    });

    //get single product using id
    app.get('/items/:id', async(req, res) => {
      const id = req.params.id;
      const filter = {_id: ObjectId(id)};
      const result = await itemsCollection.findOne(filter);
      res.send(result);
    })
  }
  finally{}
}
run().catch(console.dir);

//home route from server side
app.get('/', (req, res) => {
  res.send('Hello From Electric Items');
})

//server side listening page
app.listen(port, () => {
  console.log(`Electric Items listening on Port: ${port}`);
})