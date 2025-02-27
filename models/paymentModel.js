const mongoose = require("mongoose");
const { Schema } = mongoose;

const paymentSchema = new mongoose.Schema(
    {
        number: {type: String, required: true},
        trnx_id: {type: String, required: true},
        amount: {type: String, required: true},
    },
    {timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;

