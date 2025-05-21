import * as store from './storage.js';

const form = document.querySelector('#tx-form');
const list = document.querySelector('#tx-list');
const incEl = document.querySelector('#inc');
const expEl = document.querySelector('#exp');
const balEl = document.querySelector('#bal');

const budgetForm = document.querySelector('#budget-form');
const budgetListEl = document.querySelector('#budget-list');

const monthlySummaryEl = document.querySelector('#monthly-summary');
const categoryBreakdownEl = document.querySelector('#category-breakdown');

// Nowe referencje do elementów autoryzacji i głównej aplikacji
const authContainer = document.querySelector('#auth-container');
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const appContent = document.querySelector('#app-content');

// Nowe referencje do elementów użytkownika i wylogowania
const userInfoContainer = document.querySelector('#user-info');
const loggedInUserEl = document.querySelector('#logged-in-user');
const logoutButton = document.querySelector('#logout-button');

let USER_ID = null; // Zmienna do przechowywania zalogowanego userId
const USER_ID_STORAGE_KEY = 'finassist-user-id'; // Klucz do przechowywania userId w localStorage

// INIT
// Sprawdź stan logowania przy starcie aplikacji
async function checkLoginStatus() {
  const storedUserId = localStorage.getItem(USER_ID_STORAGE_KEY);
  if (storedUserId) {
    USER_ID = storedUserId;
    console.log('Znaleziono userId w localStorage:', USER_ID); // Log logowania z localStorage
    showAppContent();
    if (loggedInUserEl) {
        loggedInUserEl.textContent = USER_ID; // Wyświetl nazwę użytkownika po odczytaniu z localStorage
    }

    // --- Nowa/zmodyfikowana logika: Zawsze pobieraj najnowsze dane z backendu po zalogowaniu ---
    console.log('Użytkownik zalogowany. Próba pobrania najnowszych danych z backendu...');
    try {
        // Pobierz transakcje z backendu
        const txResponse = await fetch(`/api/transactions?userId=${USER_ID}`);
        if (txResponse.ok) {
            const transactions = await txResponse.json();
            console.log('Pobrano transakcje z backendu:', transactions.length);
            // Zapisz transakcje w IndexedDB (funkcja add używa put, więc zaktualizuje istniejące lub doda nowe)
            for (const tx of transactions) {
                // Upewnij się, że dane z backendu mają synced: true
                await store.add({ ...tx, synced: true });
            }
            console.log('Transakcje zapisane w IndexedDB po zalogowaniu/synchronizacji.');
        } else {
            console.error('Błąd pobierania transakcji z backendu:', txResponse.status, txResponse.statusText);
            // Można dodać UI feedback dla użytkownika o błędzie synchronizacji z serwerem
        }

        // Pobierz budżety z backendu
        const budgetResponse = await fetch(`/api/budgets?userId=${USER_ID}`);
        if (budgetResponse.ok) {
            const budgets = await budgetResponse.json();
             console.log('Pobrano budżety z backendu:', budgets.length);
            // Zapisz budżety w IndexedDB
            for (const budget of budgets) {
                 // Upewnij się, że dane z backendu mają synced: true
                await store.addBudget({ ...budget, synced: true });
            }
             console.log('Budżety zapisane w IndexedDB po logowaniu/synchronizacji.');
        } else {
            console.error('Błąd pobierania budżetów z backendu:', budgetResponse.status, budgetResponse.statusText);
             // Można dodać UI feedback dla użytkownika o błędzie synchronizacji z serwerem
        }

    } catch (error) {
        console.error('Błąd sieci/serwera podczas pobierania danych po logowaniu/synchronizacji:', error); // Log błędu
        // Można dodać UI feedback dla użytkownika o błędzie połączenia
    }
    // --- Koniec nowej/zmodyfikowanej logiki ---

    // Renderuj widok ZAWSZE z danych IndexedDB (teraz zaktualizowanych z backendu)
    if (document.querySelector('#list')) render(); // Renderuj transakcje
    if (document.querySelector('#budget-list')) renderBudgets(); // Renderuj budżety
    if (document.querySelector('#report-analysis')) renderReports(); // Renderuj raporty

    // Spróbuj wysłać oczekujące dane offline do backendu
    synchronizeOfflineTransactions();
    synchronizeOfflineBudgets();

    // Zarejestruj Service Worker i Push (tylko jeśli jeszcze nie zarejestrowano)
    registerServiceWorkerAndPush();

  } else {
    console.log('Brak userId w localStorage, wyświetlam formularz logowania.'); // Log braku logowania
    showAuthForm();
  }
}

function showAppContent() {
  if (authContainer) authContainer.style.display = 'none';
  // Pokaż elementy aplikacji i informację o użytkowniku
  if (appContent) appContent.style.display = '';
  if (userInfoContainer) userInfoContainer.style.display = '';
}

function showAuthForm() {
  if (authContainer) authContainer.style.display = '';
  // Ukryj elementy aplikacji i informację o użytkowniku
  if (appContent) appContent.style.display = 'none';
  if (userInfoContainer) userInfoContainer.style.display = 'none';
}

// TODO: Dodać obsługę formularza logowania/rejestracji w następnym kroku
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = authForm.querySelector('#login').value;
    const password = authForm.querySelector('#password').value;
    const targetButtonId = e.submitter.id; // Określ, który przycisk został kliknięty (submitter działa dla input type=submit lub button type=submit/button wewnątrz form)

    let endpoint = '';
    let successMessage = '';
    let errorMessage = '';
    let method = 'POST';

    if (targetButtonId === 'login-button') {
        endpoint = '/api/login';
        // successMessage = 'Logowanie pomyślne.'; // Komunikat będzie wyświetlany po przeładowaniu/pokazaniu app
        errorMessage = 'Nieprawidłowy login lub hasło.';
    } else if (targetButtonId === 'register-button') {
        endpoint = '/api/register';
        successMessage = 'Rejestracja pomyślna. Możesz się teraz zalogować.';
        errorMessage = 'Wystąpił błąd podczas rejestracji.';
    } else {
        return; // Nieznany przycisk, nic nie rób
    }

    // Obsługa rejestracji (wykonywana po kliknięciu przycisku Zarejestruj)
    if (targetButtonId === 'register-button') {
         try {
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            });

            const data = await response.json();

            if (response.ok) {
                authMessage.textContent = successMessage;
                authMessage.style.color = 'green';
                 // Po udanej rejestracji, można wyczyścić formularz i pozwolić użytkownikowi się zalogować
                 authForm.reset();
            } else {
                 authMessage.textContent = data.message || errorMessage;
                 authMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Błąd sieci/serwera podczas rejestracji:', error);
            authMessage.textContent = 'Wystąpił błąd połączenia.';
            authMessage.style.color = 'red';
        }
        return; // Zakończ obsługę formularza po rejestracji
    }

    // Obsługa logowania (wykonywana po kliknięciu przycisku Zaloguj)
    if (targetButtonId === 'login-button') {
        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Logowanie pomyślne
                USER_ID = data.userId; // Pobierz userId z odpowiedzi backendu
                localStorage.setItem(USER_ID_STORAGE_KEY, USER_ID); // Zapisz userId w localStorage
                console.log('Logowanie pomyślne. userId:', USER_ID); // Log

                authMessage.textContent = ''; // Wyczyść komunikat
                showAppContent(); // Pokaż główną aplikację i info o użytkowniku
                if (loggedInUserEl) {
                    loggedInUserEl.textContent = USER_ID; // Wyświetl nazwę użytkownika
                }

                // *** Nowa logika: Pobierz dane z backendu i zapisz w IndexedDB po zalogowaniu ***
                console.log('Pobieram dane użytkownika z backendu...');
                try {
                    // Pobierz transakcje z backendu
                    const txResponse = await fetch(`/api/transactions?userId=${USER_ID}`);
                    if (txResponse.ok) {
                        const transactions = await txResponse.json();
                        console.log('Pobrano transakcje z backendu:', transactions.length);
                        // Zapisz transakcje w IndexedDB (funkcja add używa put, więc zaktualizuje istniejące lub doda nowe)
                        for (const tx of transactions) {
                            // Upewnij się, że dane z backendu mają synced: true
                            await store.add({ ...tx, synced: true });
                        }
                        console.log('Transakcje zapisane w IndexedDB po zalogowaniu.');
                    } else {
                        console.error('Błąd pobierania transakcji z backendu:', txResponse.status, txResponse.statusText);
                        authMessage.textContent = 'Błąd ładowania transakcji z serwera.';
                        authMessage.style.color = 'red';
                    }

                    // Pobierz budżety z backendu
                    const budgetResponse = await fetch(`/api/budgets?userId=${USER_ID}`);
                    if (budgetResponse.ok) {
                        const budgets = await budgetResponse.json();
                         console.log('Pobrano budżety z backendu:', budgets.length);
                        // Zapisz budżety w IndexedDB
                        for (const budget of budgets) {
                             // Upewnij się, że dane z backendu mają synced: true
                            await store.addBudget({ ...budget, synced: true });
                        }
                         console.log('Budżety zapisane w IndexedDB po logowaniu.');
                    } else {
                        console.error('Błąd pobierania budżetów z backendu:', budgetResponse.status, budgetResponse.statusText);
                         authMessage.textContent = 'Błąd ładowania budżetów z serwera.';
                        authMessage.style.color = 'red';
                    }

                } catch (error) {
                    console.error('Błąd sieci/serwera podczas pobierania danych po logowaniu:', error);
                    authMessage.textContent = 'Wystąpił błąd połączenia podczas ładowania danych.';
                    authMessage.style.color = 'red';
                }
                // *** Koniec nowej logiki ***

                // Zainicjuj renderowanie i synchronizację z danymi zalogowanego użytkownika
                if (document.querySelector('#list')) render();
                if (document.querySelector('#budget-list')) renderBudgets();
                if (document.querySelector('#report-analysis')) renderReports();
                synchronizeOfflineTransactions();
                synchronizeOfflineBudgets();
                registerServiceWorkerAndPush(); // Zarejestruj SW i Push po zalogowaniu

            } else {
                // Logowanie nieudane
                authMessage.textContent = data.message || errorMessage;
                authMessage.style.color = 'red';
                console.warn('Logowanie nieudane:', data.message);
            }
        } catch (error) {
            console.error('Błąd sieci/serwera podczas logowania:', error);
            authMessage.textContent = 'Wystąpił błąd połączenia.';
            authMessage.style.color = 'red';
        }
        return; // Zakończ obsługę formularza po logowaniu
    }
});

// TODO: Zastąpić USER_ID wszędzie gdzie jest używany stałą wartością USER_ID zmienną globalną
// Przykłady (do zmiany w kolejnych krokach):
// w fetchach do /api/transactions, /api/budgets, /api/reports, /api/subscribe
// w obiektach transakcji i budżetów przed zapisem do IndexedDB

// Uruchom sprawdzanie stanu logowania po załadowaniu DOM - BEZ opóźnienia, ale asynchronicznie
document.addEventListener('DOMContentLoaded', checkLoginStatus);

form.addEventListener('submit', async e => {
  console.log('Formularz submit zarejestrowany.'); // Log S1
  e.preventDefault();
  console.log('preventDefault() wywołane.'); // Log S2
  const data = Object.fromEntries(new FormData(form));
  const tx = {
    ...data,
    amount: Number(data.amount),
    date: new Date().toISOString(),
    userId: USER_ID,
    _id: Date.now() + Math.random().toString(36).substring(2, 9), // Generujemy tymczasowe _id na frontendzie
    synced: false // Nowa flaga: domyślnie nie zsynchronizowano
  };
  console.log('Przygotowana transakcja:', tx); // Log S3

  // Zawsze zapisuj do IndexedDB jako pierwsze źródło prawdy
  try {
    console.log('Próba zapisu transakcji do IndexedDB...'); // Log S4
    await store.add(tx); // Użyj funkcji add (która teraz używa put i dodaje synced flag)
    console.log('Transakcja zapisana w IndexedDB.'); // Log S5

    render(); // Odśwież widok z danych z IndexedDB
    synchronizeOfflineTransactions(); // Spróbuj od razu zsynchronizować z backendem

  } catch (error) {
    console.error('Błąd podczas zapisu transakcji do IndexedDB:', error); // Log S6
    // Można dodać UI feedback dla użytkownika o błędzie zapisu lokalnego
  } finally {
    console.log('Resetowanie formularza.'); // Log S7
    form.reset();
  }
});

budgetForm.addEventListener('submit', async e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(budgetForm));
  const budget = {
    ...data,
    limit: Number(data.limit),
    userId: USER_ID,
    // TODO: Add a unique identifier for budgets if needed for more complex sync (e.g., category + userId?)
    // Na razie IndexedDB używa userId jako keyPath, co zakłada 1 budżet per user globalnie lub per kategorię jeśli keyPath byłby [userId, category]
    synced: false // Nowa flaga: domyślnie nie zsynchronizowano
  };

  // Zawsze zapisuj do IndexedDB jako pierwsze źródło prawdy
   try {
    console.log('Próba zapisu budżetu do IndexedDB...'); // Log B1
    await store.addBudget(budget); // Użyj funkcji addBudget (która teraz używa put i dodaje synced flag)
    console.log('Budżet zapisany w IndexedDB.'); // Log B2

    renderBudgets(); // Odśwież widok z danych z IndexedDB
    // synchronizeOfflineBudgets(); // Spróbuj od razu zsynchronizować z backendem (zrobimy to w następnym kroku)

  } catch (error) {
    console.error('Błąd podczas zapisu budżetu do IndexedDB:', error); // Log B3
    // Można dodać UI feedback dla użytkownika o błędzie zapisu lokalnego
  }
  budgetForm.reset();
});

async function render() {
  // Sprawdź, czy element listy transakcji istnieje przed renderowaniem
  if (!list) return; // Jeśli element nie istnieje, przerwij

  // Wyczyść listę HTML przed ponownym renderowaniem
  list.innerHTML = '';
  console.log('Wyczyszczono listę transakcji w UI.'); // Log render_clear

  console.log('[Render] Próba wczytania danych z IndexedDB...'); // Log render_start_indexeddb

  // Wczytaj dane z IndexedDB
  try {
    // W modelu jednokierunkowym, IndexedDB może zawierać dane wielu użytkowników (jeśli nie czyścimy przy wylogowaniu/zmianie usera)
    // W realnej aplikacji, przy zmianie usera/wylogowaniu, IndexedDB powinna być wyczyszczona.
    // Na razie zakładamy, że IndexedDB jest per przeglądarka i może wymagać czyszczenia przy zmianie usera.
    // Filtrujemy dane z IndexedDB po zalogowanym USER_ID
    const allTransactions = await store.getAll(); // Pobierz wszystkie transakcje z IndexedDB
    const arr = allTransactions.filter(tx => tx.userId === USER_ID); // Filtruj po zalogowanym USER_ID

    console.log('[Render] Dane wczytane z IndexedDB:', arr.length, 'rekordów (dla zalogowanego usera).'); // Log render_fetch_indexeddb_success

    // Sprawdź, czy element listy transakcji istnieje przed renderowaniem
    if (list) {
      console.log('[Render] Renderowanie listy z danych z IndexedDB.'); // Log render_ui_indexeddb
      list.innerHTML = arr.map(t =>
        `<li>${new Date(t.date).toLocaleDateString()} – ${t.category}: ${(t.type==='expense'?'-':'')}${t.amount.toFixed(2)} zł</li>`
      ).join('');
    }
    // Sprawdź, czy elementy podsumowania istnieją przed aktualizacją
    if (incEl && expEl && balEl) {
      console.log('[Render] Aktualizacja podsumowania z danych z IndexedDB.'); // Log render_summary_indexeddb
      const inc = arr.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
      const exp = arr.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      incEl.textContent = inc.toFixed(2);
      expEl.textContent = exp.toFixed(2);
      balEl.textContent = (inc-exp).toFixed(2);
    }

  } catch (error) {
    console.error('Błąd podczas wczytywania transakcji z IndexedDB (render):', error); // Log render_indexeddb_error
    // Można dodać UI feedback dla użytkownika o błędzie wczytywania lokalnego
    if (list) {
        list.innerHTML = '<li>Błąd ładowania transakcji z lokalnej bazy.</li>';
    }
     if (incEl) incEl.textContent = '-';
     if (expEl) expEl.textContent = '-';
     if (balEl) balEl.textContent = '-';
  }
}

async function renderBudgets() {
  // Sprawdź, czy element listy budżetów istnieje
  if (!budgetListEl) return; // Jeśli element nie istnieje, przerwij

  console.log('[RenderBudgets] Próba wczytania danych z IndexedDB...'); // Log render_budgets_start_indexeddb

  // Wczytaj dane z IndexedDB
  try {
     // Filtrujemy dane z IndexedDB po zalogowanym USER_ID
    const allBudgets = await store.getAllBudgets(); // Pobierz wszystkie budżety z IndexedDB
    const budgets = allBudgets.filter(budget => budget.userId === USER_ID); // Filtruj po zalogowanym USER_ID

    console.log('[RenderBudgets] Dane wczytane z IndexedDB:', budgets.length, 'rekordów (dla zalogowanego usera).'); // Log render_budgets_fetch_indexeddb_success

    budgetListEl.innerHTML = budgets.map(b =>
      `<li>${b.category}: ${b.limit.toFixed(2)} zł</li>`
    ).join('');
     console.log('[RenderBudgets] Renderowanie listy budżetów z danych z IndexedDB.'); // Log render_budgets_ui_indexeddb

  } catch (error) {
    console.error('Błąd podczas wczytywania budżetów z IndexedDB (renderBudgets):', error); // Log render_budgets_indexeddb_error
    // Można dodać UI feedback dla użytkownika o błędzie wczytywania lokalnego
     budgetListEl.innerHTML = '<li>Błąd ładowania budżetów z lokalnej bazy.</li>';
  }
}

async function renderReports() {
   // Sprawdź, czy elementy raportów istnieją
  if (!monthlySummaryEl || !categoryBreakdownEl) return; // Jeśli elementy nie istnieją, przerwij

  console.log('[RenderReports] Próba wczytania danych do raportów z IndexedDB...'); // Log render_reports_start_indexeddb

  // Na potrzeby raportów, pobierzmy dane z IndexedDB (transakcje)
  try {
    const arr = await store.getAll(); // Wczytaj wszystkie transakcje z IndexedDB

    console.log('[RenderReports] Dane transakcji wczytane z IndexedDB dla raportów:', arr.length, 'rekordów.'); // Log render_reports_fetch_indexeddb_success

    // Implementacja logiki raportowania po stronie klienta z danych z IndexedDB
    // Obecnie raporty pobierały dane z backendu na podstawie zakresu dat.
    // W modelu offline-first, logika raportowania musi działać na wszystkich danych w IndexedDB
    // lub na przefiltrowanych danych wg zakresu dat na frontendzie.

    // Na potrzeby przykładu, generujemy raport za ostatnie 30 dni z danych z IndexedDB
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const recentTransactions = arr.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });

    console.log('[RenderReports] Przefiltrowano transakcje dla raportu (ostatnie 30 dni): ', recentTransactions.length, 'rekordów.'); // Log render_reports_filter

    // Proste renderowanie podsumowania miesięcznego z danych z IndexedDB
    let monthlySummaryHTML = '<h3>Ostatnie 30 dni</h3>';
    const totalIncome = recentTransactions.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = recentTransactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
    monthlySummaryHTML += `<p>Przychody: ${totalIncome.toFixed(2)} zł</p>`;
    monthlySummaryHTML += `<p>Wydatki: ${totalExpense.toFixed(2)} zł</p>`;
    monthlySummaryHTML += `<p>Bilans: ${(totalIncome - totalExpense).toFixed(2)} zł</p>`;
    monthlySummaryEl.innerHTML = monthlySummaryHTML;
    console.log('[RenderReports] Zrenderowano podsumowanie miesięczne.'); // Log render_reports_summary_ui

    // Proste renderowanie podsumowania kategorii wydatków z danych z IndexedDB
    let categoryBreakdownHTML = '<h3>Wydatki według kategorii (ostatnie 30 dni)</h3>';
    const expenseCategoriesMap = recentTransactions
      .filter(item => item.type === 'expense')
      .reduce((map, item) => {
        map[item.category] = (map[item.category] || 0) + item.amount;
        return map;
      }, {});

    const expenseCategories = Object.entries(expenseCategoriesMap).map(([category, total]) => ({ category, total }));

    if (expenseCategories.length === 0) {
      categoryBreakdownHTML += '<p>Brak wydatków w tym okresie.</p>';
    } else {
      categoryBreakdownHTML += '<ul>';
      expenseCategories.forEach(item => {
        categoryBreakdownHTML += `<li>${item.category}: ${item.total.toFixed(2)} zł</li>`;
      });
      categoryBreakdownHTML += '</ul>';
    }
    categoryBreakdownEl.innerHTML = categoryBreakdownHTML;
    console.log('[RenderReports] Zrenderowano wydatki według kategorii.'); // Log render_reports_category_ui

  } catch (error) {
    console.error('Błąd podczas wczytywania danych do raportów z IndexedDB:', error); // Log render_reports_indexeddb_error
    // Można dodać UI feedback dla użytkownika o błędzie wczytywania lokalnego
     if (monthlySummaryEl) monthlySummaryEl.innerHTML = '<li>Błąd ładowania podsumowania raportu z lokalnej bazy.</li>';
     if (categoryBreakdownEl) categoryBreakdownEl.innerHTML = '<li>Błąd ładowania szczegółów kategorii z lokalnej bazy.</li>';
  }
}

// Nowa funkcja do synchronizacji transakcji z Local Storage do backendu
async function synchronizeOfflineTransactions() {
  console.log('[SyncTx] Rozpoczęcie synchronizacji transakcji offline.'); // Log sync_tx_start
  const allOfflineTransactions = await store.getAll(); // Pobierz wszystkie transakcje z IndexedDB
  const offlineTransactions = allOfflineTransactions.filter(tx => !tx.synced && tx.userId === USER_ID); // Filtruj niezsynchronizowane i dla zalogowanego usera

  console.log('[SyncTx] Pobrano z IndexedDB (wszystkie): ', allOfflineTransactions.length); // Log sync_tx_get_all
  console.log('[SyncTx] Do synchronizacji (\'synced: false\' i userId === ', USER_ID, '): ', offlineTransactions.length, 'transakcji.'); // Log sync_tx_pending

  if (offlineTransactions.length === 0) {
    console.log('[SyncTx] Brak oczekujących transakcji offline do synchronizacji.'); // Log sync_tx_no_pending
    return;
  }

  console.log(`[SyncTx] Znaleziono ${offlineTransactions.length} oczekujących transakcji offline. Próba synchronizacji...`); // Log sync_tx_pending

  for (const tx of offlineTransactions) {
    try {
      // Tworzymy kopię transakcji do wysłania
      const txToSend = { ...tx };
      // Usuń tymczasowe _id generowane na frontendzie przed wysyłką do backendu
      delete txToSend._id;

      console.log('[SyncTx] Próba wysłania transakcji offline do backendu:', txToSend); // Log sync_tx_send

      const response = await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(txToSend)
      });

      if (response.ok) {
        // const syncedTx = await response.json(); // Nie potrzebujemy już obiektu z backendu do aktualizacji _id w tym modelu synchronizacji
        console.log('[SyncTx] Zsynchronizowano transakcję offline (backend OK). Oryginalne _id:', tx._id); // Log sync_tx_success

        // Aktualizuj rekord w IndexedDB, ustawiając synced na true
        const updatedTx = { ...tx, synced: true };
        console.log('[SyncTx] Aktualizowanie rekordu w IndexedDB (synced: true) z _id:', updatedTx._id); // Log sync_tx_update_start
        await store.add(updatedTx); // Użyj add (put), aby zaktualizować rekord
        console.log('[SyncTx] Zaktualizowano rekord w IndexedDB (synced: true) z _id:', updatedTx._id); // Log sync_tx_update_end

        // Nie usuwamy już starego rekordu i nie dodajemy nowego z backendowym _id, bo frontendowe _id jest kluczem w IndexedDB

      } else {
        console.error('[SyncTx] Błąd serwera podczas synchronizacji transakcji offline:', response.status, response.statusText, tx); // Log sync_tx_server_error
        // Nie usuwamy z IndexedDB, spróbujemy ponownie później
      }
    } catch (error) {
      console.error('[SyncTx] Błąd sieci podczas synchronizacji transakcji offline:', error, tx); // Log sync_tx_network_error
      // Błąd sieci, przerywamy synchronizację
      break; // Przerywamy pętlę
    }
  }
  console.log('[SyncTx] Synchronizacja transakcji offline zakończona. Odświeżam widok.'); // Log sync_tx_end
  // Po próbie synchronizacji, odśwież widok (pobierając z backendu)
  render(); // Odśwież widok transakcji - render pobierze aktualne dane z backendu (co teraz powinno być zgodne z IndexedDB)
  // Jeśli pozostały jakieś transakcje w IndexedDB, można by dodać status wizualny
}

// Nowa funkcja do synchronizacji budżetów z IndexedDB do backendu
async function synchronizeOfflineBudgets() {
  console.log('[SyncBudgets] Rozpoczęcie synchronizacji budżetów offline.'); // Log sync_budgets_start
  const allOfflineBudgets = await store.getAllBudgets(); // Pobierz wszystkie budżety z IndexedDB
  const offlineBudgets = allOfflineBudgets.filter(budget => !budget.synced && budget.userId === USER_ID); // Filtruj niezsynchronizowane i dla zalogowanego usera

  console.log('[SyncBudgets] Pobrano z IndexedDB (wszystkie): ', allOfflineBudgets.length); // Log sync_budgets_get_all
  console.log('[SyncBudgets] Do synchronizacji (\'synced: false\' i userId === ', USER_ID, '): ', offlineBudgets.length, 'budżetów.'); // Log sync_budgets_pending

  if (offlineBudgets.length === 0) {
    console.log('[SyncBudgets] Brak oczekujących budżetów offline do synchronizacji.'); // Log sync_budgets_no_pending
    return;
  }

  for (const budget of offlineBudgets) {
    try {
      const budgetToSend = { ...budget };
      // TODO: Decide if _id should be sent for budgets, depends on backend structure.
      // If backend uses userId + category as key, we don't need _id.

      console.log('[SyncBudgets] Próba wysłania budżetu offline do backendu:', budgetToSend); // Log sync_budgets_send

      const response = await fetch('/api/budgets', {
        method: 'POST', // lub PUT jeśli aktualizujemy istniejący
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(budgetToSend)
      });

      if (response.ok) {
        console.log('[SyncBudgets] Zsynchronizowano budżet offline (backend OK). Oryginalny key:', budget.userId); // Log sync_budgets_success (używając userId jako identyfikatora)

        // Aktualizuj rekord w IndexedDB, ustawiając synced na true
        const updatedBudget = { ...budget, synced: true };
        console.log('[SyncBudgets] Aktualizowanie rekordu w IndexedDB (synced: true) z key:', updatedBudget.userId); // Log sync_budgets_update_start
        await store.addBudget(updatedBudget); // Użyj addBudget (put), aby zaktualizować rekord
        console.log('[SyncBudgets] Zaktualizowano rekord w IndexedDB (synced: true) z key:', updatedBudget.userId); // Log sync_budgets_update_end

      } else {
        console.error('[SyncBudgets] Błąd serwera podczas synchronizacji budżetu offline:', response.status, response.statusText, budget); // Log sync_budgets_server_error
        // Nie aktualizujemy synced flagi, spróbujemy ponownie później
      }
    } catch (error) {
      console.error('[SyncBudgets] Błąd sieci podczas synchronizacji budżetu offline:', error, budget); // Log sync_budgets_network_error
      // Błąd sieci, przerywamy synchronizację
      break; // Przerywamy pętlę
    }
  }
  console.log('[SyncBudgets] Synchronizacja budżetów offline zakończona. Odświeżam widok.'); // Log sync_budgets_end
  renderBudgets(); // Odśwież widok budżetów z danych z IndexedDB
}

// Dodaj listener na zdarzenie online, aby spróbować synchronizacji obu typów danych
window.addEventListener('online', () => {
    synchronizeOfflineTransactions();
    synchronizeOfflineBudgets(); // Dodaj synchronizację budżetów po powrocie online
});

// Nowa funkcja do wylogowania
async function logout() {
  console.log('Wylogowywanie użytkownika:', USER_ID); // Log wylogowania
  USER_ID = null; // Wyczyść zmienną USER_ID
  localStorage.removeItem(USER_ID_STORAGE_KEY); // Usuń userId z localStorage

  // Wyczyść dane z IndexedDB dla bezpieczeństwa/prywatności
  // W zależności od wymagań, można by tylko filtrować dane po USER_ID zamiast czyścić całość
  // Ale dla prostoty i bezpieczeństwa, czyścimy IndexedDB przy wylogowaniu.
  try {
    await store.clear(); // Usuń transakcje
    await store.clearBudgets(); // Usuń budżety
    // TODO: Wyczyścić inne magazyny IndexedDB, jeśli zostaną dodane
    console.log('Wyczyszczono IndexedDB.'); // Log czyszczenia IndexedDB
  } catch (error) {
    console.error('Błąd podczas czyszczenia IndexedDB przy wylogowaniu:', error); // Log błędu czyszczenia IndexedDB
  }

  // Odśwież UI
  if (document.querySelector('#list')) render(); // Wyczyść listę transakcji w UI
  if (document.querySelector('#budget-list')) renderBudgets(); // Wyczyść listę budżetów w UI
  if (document.querySelector('#report-analysis')) renderReports(); // Wyczyść raporty w UI

  showAuthForm(); // Pokaż formularz logowania
  console.log('Użytkownik wylogowany.'); // Log wylogowania zakończony
}

// Dodaj listener do przycisku wylogowania
if (logoutButton) {
  logoutButton.addEventListener('click', logout);
}

// *** Dodana funkcja do rejestracji Service Workera i powiadomień push ***
async function registerServiceWorkerAndPush() {
    console.log('Próba rejestracji Service Workera i Push...'); // Log SW start
    // Sprawdź, czy przeglądarka obsługuje Service Workers i Push API
    if (!('serviceWorker' in navigator)) {
        console.warn('Przeglądarka nie obsługuje Service Workers'); // Log SW not supported
        return;
    }
    if (!('PushManager' in window)) {
        console.warn('Przeglądarka nie obsługuje Push API'); // Log Push not supported
        return;
    }
    if (Notification.permission === 'denied') {
         console.warn('Użytkownik zablokował powiadomienia.'); // Log Push denied
         // Możesz poinformować użytkownika, aby odblokował powiadomienia w ustawieniach przeglądarki
         return;
    }

    try {
        // 1. Rejestracja Service Workera
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker zarejestrowany. Scope:', registration.scope); // Log SW registered

        // 2. Prośba o pozwolenie na powiadomienia (jeśli jeszcze nie udzielono lub nie odmówiono)
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Pozwolenie na powiadomienia udzielone.'); // Log Push granted

            // 3. Pobranie publicznego klucza VAPID z backendu
            const response = await fetch('/api/vapid-public-key');
            const data = await response.json();
            const vapidPublicKey = data.publicKey;

             if (!vapidPublicKey) {
                console.error('Nie udało się pobrać publicznego klucza VAPID z backendu.'); // Log VAPID error
                return;
            }

            // 4. Subskrypcja do powiadomień push
            const subscribeOptions = {
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            };

            let subscription = await registration.pushManager.getSubscription();

            if (subscription === null) {
                 console.log('Tworzenie nowej subskrypcji push...'); // Log new Push subscription
                 subscription = await registration.pushManager.subscribe(subscribeOptions);
                 console.log('Nowa subskrypcja push utworzona:', subscription); // Log new Push subscription success
            } else {
                 console.log('Istniejąca subskrypcja push znaleziona:', subscription); // Log existing Push subscription
            }

            // 5. Wysłanie subskrypcji do backendu
            console.log('Wysyłanie subskrypcji push do backendu...'); // Log send Push subscription
            const subResponse = await fetch('/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: USER_ID, // Użyj zalogowanego userId
                    sub: subscription
                }),
            });

            if (subResponse.ok) {
                console.log('Subskrypcja push wysłana do backendu pomyślnie.'); // Log send Push subscription success
            } else {
                 console.error('Błąd wysyłania subskrypcji push do backendu:', subResponse.status, subResponse.statusText);
            }

        } else {
            console.warn('Pozwolenie na powiadomienia nie udzielone.'); // Log Push permission not granted
        }

    } catch (error) {
        console.error('Błąd podczas rejestracji SW lub subskrypcji Push:', error); // Log SW/Push error
    }
}

// Funkcja pomocnicza do konwersji klucza VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
