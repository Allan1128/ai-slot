addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  const BOT_TOKEN = "7863120202:AAHM4zcQcMJqEAdWLerfboUZpq3coDcXLzg";
  const TELEGRAM_API_URL = 'https://api.telegram.org/bot' + BOT_TOKEN + '/';
  const ADMIN_IDS = ["7532709749"];
  const DEPOSIT_ADDRESS = "ArGtUMUAT7L8FyfALJCzrRAx1FkqqiJsruuttjETGdvm";
  
  const AI_USD_RATE = 0.00000034969;
  const COSTS = {
    3: 0.1 / AI_USD_RATE,
    4: 0.15 / AI_USD_RATE,
    5: 0.2 / AI_USD_RATE,
    6: 0.001 / AI_USD_RATE
  };
  const REWARDS = {
    3: 1 / AI_USD_RATE,
    4: 3 / AI_USD_RATE,
    5: 10 / AI_USD_RATE,
    6: 1000 / AI_USD_RATE
  };
  const SYMBOLS = ["🍎", "🍌", "🍒", "🍇", "🍊", "🍍", "🍓", "🍉", "🥭", "🥝"];
  const SYMBOL_COUNTS = { 3: 5, 4: 6, 5: 7, 6: 10 };
  
  let userBalances = {};
  let withdrawRequests = {};
  
  async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
  
    if (path === '/webhook') {
      const update = await request.json();
      await handleUpdate(update);
      return new Response('OK');
    }
  
    return new Response('Not Found', { status: 404 });
  }
  
  async function handleUpdate(update) {
    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
  
      if (text === '/start') {
        await sendMessage(chatId, 'Welcome to the Fruit Slot Machine! Please choose an option:', getMainMenu());
      } else if (text.startsWith('/withdraw')) {
        const args = text.split(' ').slice(1);
        await handleWithdraw(chatId, args);
      }
    } else if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const data = query.data;
  
      await handleCallbackQuery(chatId, data);
    }
  }
  
  async function handleCallbackQuery(chatId, data) {
    if (data === 'main_menu') {
      await editMessageText(chatId, 'Please choose an option:', getMainMenu());
    } else if (data === 'spin_menu') {
      await editMessageText(chatId, 'Choose a spin mode:', getSpinMenu());
    } else if (data.startsWith('spin_') && !data.includes('_')) {
      const mode = parseInt(data.split('_')[1]);
      await editMessageText(chatId, `Choose the number of spins for ${mode} reels:`, getTimesMenu(mode));
    } else if (data.startsWith('spin_')) {
      const [_, mode, times] = data.split('_');
      await handleSpin(chatId, parseInt(mode), times === 'unlimited' ? Infinity : parseInt(times));
    } else if (data === 'balance') {
      const balance = userBalances[chatId] || 0;
      await editMessageText(chatId, `Current balance: ${balance.toFixed(2)} AI`, getMainMenu());
    } else if (data === 'deposit') {
      await editMessageText(chatId, `Please deposit to this address: ${DEPOSIT_ADDRESS}\nDepositing 0.1 USDT will get you ${COSTS[3].toFixed(2)} AI\nContact the admin with the transaction ID after transfer`, getMainMenu());
      for (const adminId of ADMIN_IDS) {
        await sendMessage(adminId, `User ${chatId} requested a deposit, please prepare to process。`);
      }
    } else if (data === 'withdraw') {
      await editMessageText(chatId, 'Please use /withdraw <amount> <SOL address> to submit a withdrawal request\nFor example: /withdraw 100000 YOUR_ADDRESS', getMainMenu());
    }
  }
  
  async function handleWithdraw(chatId, args) {
    if (args.length !== 2) {
      await sendMessage(chatId, 'Usage: /withdraw <amount> <SOL address>\nFor example: /withdraw 100000 YOUR_ADDRESS');
      return;
    }
  
    const [amountStr, solAddress] = args;
    const amount = parseFloat(amountStr);
  
    if (isNaN(amount)) {
      await sendMessage(chatId, 'Amount must be a number!');
      return;
    }
  
    const balance = userBalances[chatId] || 0;
  
    if (balance < amount) {
      await sendMessage(chatId, 'Insufficient balance!');
      return;
    }
  
    userBalances[chatId] -= amount;
    withdrawRequests[chatId] = [amount, solAddress];
    await sendMessage(chatId, `Withdrawal request submitted: ${amount.toFixed(2)} AI to ${solAddress}\nPlease wait for the admin to process\nCurrent balance: ${userBalances[chatId].toFixed(2)} AI`);
    for (const adminId of ADMIN_IDS) {
      await sendMessage(adminId, `User ${chatId} requested a withdrawal of ${amount.toFixed(2)} AI to ${solAddress}`);
    }
  }
  
  async function handleSpin(chatId, mode, times) {
    const balance = userBalances[chatId] || 0;
    const cost = COSTS[mode] * (times === Infinity ? 1 : times);
  
    if (balance < cost) {
      await sendMessage(chatId, 'Insufficient balance!', getMainMenu());
      return;
    }
  
    const availableSymbols = SYMBOLS.slice(0, SYMBOL_COUNTS[mode]);
    let spinsDone = 0;
    let totalReward = 0;
    let output = '';
  
    while (spinsDone < times && userBalances[chatId] >= COSTS[mode]) {
      userBalances[chatId] -= COSTS[mode];
      spinsDone += 1;
  
      const result = Array.from({ length: mode }, () => availableSymbols[Math.floor(Math.random() * availableSymbols.length)]);
      const line = result.join(' ');
  
      if (new Set(result).size === 1) {
        const reward = REWARDS[mode];
        totalReward += reward;
        userBalances[chatId] += reward;
        output += `${line} - Jackpot! Won ${reward.toFixed(2)} AI\n`;
      } else {
        output += `${line} - No win\n`;
      }
  
      if (times === Infinity && userBalances[chatId] < COSTS[mode]) {
        output += 'Insufficient balance, stopping unlimited mode\n';
        break;
      }
    }
  
    if (totalReward > 0 && times !== 1) {
      output += `Total rewards: ${totalReward.toFixed(2)} AI\n`;
    }
    output += `Current balance: ${userBalances[chatId].toFixed(2)} AI`;
  
    await sendMessage(chatId, output, getMainMenu());
  }
  
  function getMainMenu() {
    return {
      inline_keyboard: [
        [{ text: '🎰 Play Slot Machine', callback_data: 'spin_menu' }],
        [{ text: '💰 Check Balance', callback_data: 'balance' }],
        [{ text: '➕ Deposit', callback_data: 'deposit' }],
        [{ text: '➖ Withdraw', callback_data: 'withdraw' }]
      ]
    };
  }
  
  function getSpinMenu() {
    return {
      inline_keyboard: [
        [{ text: '3 Reels', callback_data: 'spin_3' }, { text: '4 Reels', callback_data: 'spin_4' }],
        [{ text: '5 Reels', callback_data: 'spin_5' }, { text: '6 Reels', callback_data: 'spin_6' }],
        [{ text: 'Back', callback_data: 'main_menu' }]
      ]
    };
  }
  
  function getTimesMenu(mode) {
    return {
      inline_keyboard: [
        [{ text: '1 Time', callback_data: `spin_${mode}_1` }, { text: '10 Times', callback_data: `spin_${mode}_10` }],
        [{ text: '100 Times', callback_data: `spin_${mode}_100` }, { text: '1000 Times', callback_data: `spin_${mode}_1000` }],
        [{ text: 'Unlimited', callback_data: `spin_${mode}_unlimited` }],
        [{ text: 'Back', callback_data: 'spin_menu' }]
      ]
    };
  }
  
  async function sendMessage(chatId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      text: text,
      reply_markup: replyMarkup
    };
    await fetch(TELEGRAM_API_URL + 'sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  
  async function editMessageText(chatId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      message_id: chatId,
      text: text,
      reply_markup: replyMarkup
    };
    await fetch(TELEGRAM_API_URL + 'editMessageText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }