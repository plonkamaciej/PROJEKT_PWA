import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/finassist';
await mongoose.connect(MONGO);

const Tx = mongoose.model('Tx', new mongoose.Schema({
  userId: String, type: String, amount: Number, category: String, date: Date
}));

await Tx.insertMany([
  { userId: 'demo', type: 'income',  amount: 5000, category: 'Pensja',  date: new Date() },
  { userId: 'demo', type: 'expense', amount: 200,  category: 'Jedzenie', date: new Date() },
  { userId: 'demo', type: 'expense', amount: 150,  category: 'Transport', date: new Date() }
]);

console.log('✓ Dane testowe dodane');
process.exit(0);
