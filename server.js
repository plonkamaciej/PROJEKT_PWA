import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import webpush from 'web-push';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Importuj moduły do HTTPS i systemu plików
import https from 'node:https';
import fs from 'node:fs';

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/finassist';
await mongoose.connect(MONGO);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MODELE
const Tx = mongoose.model('Tx', new mongoose.Schema({
  userId: String,
  type: { type: String, enum: ['income', 'expense'] },
  amount: Number,
  category: String,
  date: Date
}));
const Sub = mongoose.model('Sub', new mongoose.Schema({
  userId: String,
  sub: Object
}));

const Budget = mongoose.model('Budget', new mongoose.Schema({
  userId: String,
  category: String,
  limit: Number
}));

// Nowy model do śledzenia wysłanych powiadomień o przekroczeniu budżetu
const BudgetNotification = mongoose.model('BudgetNotification', new mongoose.Schema({
  userId: String,
  category: String,
  monthYear: String, // Format: YYYY-MM
  sentAt: { type: Date, default: Date.now }
}));

// Nowy model użytkownika (login i hasło - hasła w plain text na potrzeby uproszczenia, w realnej aplikacji należy haszować!)
const User = mongoose.model('User', new mongoose.Schema({
  login: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}));

// API – Rejestracja użytkownika
app.post('/api/register', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ message: 'Login i hasło są wymagane.' });
  }

  try {
    const existingUser = await User.findOne({ login });
    if (existingUser) {
      return res.status(409).json({ message: 'Użytkownik o podanym loginie już istnieje.' });
    }

    // Tworzenie nowego użytkownika (hasło w plain text - NIEBEZPIECZNE W PRODUKCJI!)
    const newUser = await User.create({ login, password });
    console.log('Nowy użytkownik zarejestrowany:', newUser.login); // Log rejestracji
    res.status(201).json({ message: 'Użytkownik zarejestrowany pomyślnie.' });

  } catch (error) {
    console.error('Błąd podczas rejestracji użytkownika:', error); // Log błędu rejestracji
    res.status(500).json({ message: 'Wystąpił błąd podczas rejestracji.' });
  }
});

// API – Logowanie użytkownika
app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ message: 'Login i hasło są wymagane.' });
  }

  try {
    // Znajdź użytkownika po loginie
    const user = await User.findOne({ login });

    // Sprawdź, czy użytkownik istnieje i hasło się zgadza (porównanie w plain text - NIEBEZPIECZNE W PRODUKCJI!)
    if (user && user.password === password) {
      console.log('Użytkownik zalogowany pomyślnie:', user.login); // Log logowania
      // W realnej aplikacji zwróciłbyś token JWT lub ustanowił sesję
      res.status(200).json({ message: 'Logowanie pomyślne.', userId: user.login }); // Zwracamy userId (login)
    } else {
      console.warn('Nieudana próba logowania dla loginu:', login); // Log nieudanego logowania
      res.status(401).json({ message: 'Nieprawidłowy login lub hasło.' });
    }

  } catch (error) {
    console.error('Błąd podczas logowania użytkownika:', error); // Log błędu logowania
    res.status(500).json({ message: 'Wystąpił błąd podczas logowania.' });
  }
});

// API – transakcje
app.post('/api/transactions', async (req, res) => {
  // Usuń pole _id z przychodzącego obiektu transakcji, aby MongoDB mogło wygenerować własne ObjectId
  const transactionData = { ...req.body };
  delete transactionData._id;

  const doc = await Tx.create(transactionData);
  res.status(201).json(doc);

  // --- Nowa logika sprawdzania budżetu po dodaniu transakcji ---
  const { userId, type, category, amount } = doc; // Pobieramy dane z zapisanego dokumentu

  // Sprawdzamy tylko wydatki
  if (type === 'expense') {
    console.log('Transakcja wydatku zarejestrowana:', { userId, type, category, amount }); // Log 1

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthYear = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    // Pobieramy budżet dla tej kategorii i użytkownika
    const budget = await Budget.findOne({ userId, category });

    console.log('Znaleziony budżet dla kategorii ', category, ':', budget); // Log 2

    // Jeśli budżet istnieje dla tej kategorii
    if (budget) {
      // Obliczamy sumę wydatków w tej kategorii w bieżącym miesiącu
      const categoryExpenses = await Tx.aggregate([
        { $match: { userId, type: 'expense', category: category, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalCategoryExpenses = categoryExpenses[0]?.total || 0;

      console.log('Suma wydatków w kategorii ', category, ' w tym miesiącu:', totalCategoryExpenses); // Log 3
      console.log('Limit budżetu:', budget.limit); // Log 4

      // Jeśli suma wydatków przekroczyła limit budżetu
      if (totalCategoryExpenses > budget.limit) {
        console.log('Limit budżetu przekroczony.'); // Log 5

        // --- Nowe sprawdzenie: Czy powiadomienie dla tego budżetu/miesiąca zostało już wysłane? ---
        // *** Usunięto sprawdzenie BudgetNotification, aby wysyłać powiadomienie przy każdym przekroczeniu ***
        // const notificationSent = await BudgetNotification.findOne({
        //   userId,
        //   category,
        //   monthYear
        // });

        // if (!notificationSent) {
          console.log('Powiadomienie nie zostało jeszcze wysłane dla tego budżetu/miesiąca. Próbuję wysłać...'); // Log 5a
          // Pobieramy subskrypcje użytkownika
          const subs = await Sub.find({ userId });

          console.log('Znaleziono subskrypcje dla użytkownika ', userId, ':', subs.length); // Log 6

          for (const { sub } of subs) {
            // Wysyłamy powiadomienie push
            console.log('Próbuję wysłać powiadomienie do subskrypcji:', sub); // Log 7
            await webpush.sendNotification(sub, JSON.stringify({
              title: `Przekroczono budżet dla: ${category}`,
              body: `Wydano ${totalCategoryExpenses.toFixed(2)} zł. Limit wynosił ${budget.limit.toFixed(2)} zł.`, // Bardziej szczegółowa wiadomość
              url: '/budget.html' // Można przekierować na stronę budżetowania
            })).catch(error => console.error('Błąd wysyłania powiadomienia:', error)); // Zmieniony catch
          }

          // Zapisz informację o wysłaniu powiadomienia
          // *** Usunięto zapis BudgetNotification ***
          // await BudgetNotification.create({
          //   userId,
          //   category,
          //   monthYear
          // });
          console.log('Zapisano informację o wysłanym powiadomieniu budżetowym.'); // Log 7a

        // } else {
        //   console.log('Powiadomienie dla tego budżetu/miesiąca zostało już wysłane.'); // Log 5b
        // }
        // --- Koniec nowego sprawdzenia ---

      }
    }
  }
  // --- Koniec nowej logiki ---
});

app.get('/api/transactions', async (req, res) => {
  const { userId } = req.query; // Przyjmujemy userId jako parametr zapytania
  if (!userId) {
    // W przypadku braku userId (np. niezalogowany użytkownik), zwróć puste dane lub błąd
    return res.status(401).json({ message: 'Użytkownik niezalogoWany.' }); // Zmieniono na 401 Unauthorized
  }
  const transactions = await Tx.find({ userId }).sort({ date: -1 }); // Pobierz i sortuj malejąco po dacie
  res.json(transactions);
});

// API – subskrypcja push
app.post('/api/subscribe', async (req, res) => {
  await Sub.findOneAndUpdate({ userId: req.body.userId }, { sub: req.body.sub }, { upsert: true });
  res.sendStatus(201);
});

// API – budżetowanie
app.post('/api/budgets', async (req, res) => {
  const { userId, category, limit } = req.body;
  if (!userId || !category || limit === undefined) {
    return res.status(400).json({ message: 'Brakuje userId, category lub limit w ciele zapytania' });
  }
  const budget = await Budget.findOneAndUpdate({ userId, category }, { limit }, { upsert: true, new: true });
  res.status(201).json(budget);
});

app.get('/api/budgets', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: 'Brak userId w zapytaniu' });
  }
  const budgets = await Budget.find({ userId });
  res.json(budgets);
});

// API – raportowanie
app.get('/api/reports/summary', async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  if (!userId || !startDate || !endDate) {
    return res.status(400).json({ message: 'Brakuje userId, startDate lub endDate w zapytaniu' });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    const summary = await Tx.aggregate([
      { $match: { userId, date: { $gte: start, $lte: end } } },
      { $group: { _id: { type: '$type', category: '$category' }, total: { $sum: '$amount' } } }
    ]);
    res.json(summary);
  } catch (error) {
    console.error('Błąd podczas generowania raportu:', error);
    res.status(500).json({ message: 'Wystąpił błąd podczas generowania raportu' });
  }
});

// API – VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    console.error('Brak klucza publicznego VAPID w zmiennych środowiskowych!');
    return res.status(500).json({ message: 'Brak klucza publicznego VAPID na serwerze.' });
  }
  res.json({ publicKey });
});

// * statyczne pliki / SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// VAPID
webpush.setVapidDetails(process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY);

const PORT = process.env.PORT || 3001;

// Użyj certyfikatów SSL dla HTTPS
const options = {
  key: fs.readFileSync('localhost+2-key.pem'),
  cert: fs.readFileSync('localhost+2.pem')
};

// Uruchom serwer HTTPS na porcie 3000
https.createServer(options, app).listen(PORT, () => {
  console.log('FinAssist → https://localhost:3001'); // Log z adresem HTTPS
});
