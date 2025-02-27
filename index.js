//setting up express server 
const express = require("express");
const mongoose = require('mongoose');

const app = express();
require("dotenv").config();
const cors = require("cors");
const axios = require("axios");
const port = process.env.PORT;
const Payment = require("./models/paymentModel");
let token = "";

mongoose
.connect(process.env.MONGO_URL)
.then(() => {
    console.log("database connected successfully");
})
.catch((err) => {
    console.log(err.message);
});

app.listen(port, () => {
    console.log(`app is running at localhost: ${port}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
    res.send("<h1>Hello from Carol</h1>");
});
const generateToken = async (req, res, next)=>{

    const secret = process.env.MPESA_SECRET_KEY;
    const consumer = process.env.MPESA_CONSUMER_KEY;

    const auth = new Buffer.from(`${consumer}:${secret}`).toString("base64");
    await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
        headers: {
            authorization : `Basic ${auth}`
        }
    })
    .then((response) =>{
        token = response.data.access_token
        console.log(response.data.access_token);
        next();  
    }).catch((err) =>{
        console.log(err);
        res.status(400).json(err.message);
    });
};
//middleware function to generate token
app.post("/stk", generateToken, async (req, res) => {
    const phone = req.body.phone.substring(1);
    const amount = req.body.amount;

    const date = new Date();
    const timestamp = 
    date.getFullYear() +
    ("0" + (date.getMonth() + 1)).slice(-2) +
    ("0" + date.getDate()).slice(-2) +
    ("0" + date.getHours() + 1).slice(-2) +
    ("0" + date.getMinutes() + 1).slice(-2) +
    ("0" + date.getSeconds() + 1).slice(-2);

    const shortcode = process.env.MPESA_PAYBILL;
    const passkey = process.env.MPESA_PASSKEY;

    const password = new Buffer.from(shortcode + passkey + timestamp).toString("base64");

    await axios.post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",// "CustomerBuyGoodsOnline"
          Amount: amount,
          PartyA: `254${phone}`,
          PartyB: shortcode,
          PhoneNumber: `254${phone}`,
          CallBackURL: "https://4ef5-2c0f-fe38-2185-8106-4e2-1bee-bb5f-bf6b.ngrok-free.app/callback",
          AccountReference: `254${phone}`,
          TransactionDesc: "Test"
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }

    ).then((data)=>{
        console.log(data.data)
        res.status(200).json(data.data) 
    })
    .catch((err)=>{
       console.log(err.message)
       res.status(400).json
       {err.message} 
    });
});

app.post("/callback", (req, res) => {
    const callbackData = req.body;
    console.log(callbackData.Body);
    if(!callbackData.Body.stkCallback.CallbackMetadata) {
        console.log(callbackData.Body);
        return res.json("ok"); 
    }

    
    // console.log(callbackData.Body.stkCallback.CallbackMetadata);

    const phone = callbackData.Body.stkCallback.CallbackMetadata.Item[4].Value;
    const amount = callbackData.Body.stkCallback.CallbackMetadata.Item[0].Value;
    const trnx_id = callbackData.Body.stkCallback.CallbackMetadata.Item[1].Value;

    console.log({ phone, amount, trnx_id});

    const payment = new Payment();

    payment.number = phone;
    payment.amount = amount;
    payment.trnx_id = trnx_id;

    payment
    .save()
    .then((data) => {
        console.log({message: "saved successfully", data});
        res.status(200).json({ message: "Payment saved", data });
    })
    .catch((err) => {
        console.log(err.message);
        res.status(500).json({ message: "Error saving payment", error: err.message });
    });
});