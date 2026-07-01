const axios = require('axios');
const fs = require('fs');

// Environment variables provided by GitHub Secrets
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

const STATE_FILE = './match_state.json';

async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error("Error sending Telegram message:", error.message);
  }
}

async function checkLiveScores() {
  // Fetch live matches from API-Football (example focusing on major leagues or live matches)
  const options = {
    method: 'GET',
    url: 'https://api-football-v1.p.rapidapi.com/v3/fixtures',
    params: { live: 'all' },
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    const liveMatches = response.data.response;

    // Load previous match states to detect new goals
    let previousState = {};
    if (fs.existsSync(STATE_FILE)) {
      previousState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }

    let currentState = {};

    for (const match of liveMatches) {
      const matchId = match.fixture.id;
      const homeTeam = match.teams.home.name;
      const awayTeam = match.teams.away.name;
      const homeGoals = match.goals.home;
      const awayGoals = match.goals.away;
      const elapsedMin = match.fixture.status.elapsed;

      currentState[matchId] = { homeGoals, awayGoals };

      // Check if this match was already tracked in the last execution loop
      if (previousState[matchId]) {
        const prevHome = previousState[matchId].homeGoals;
        const prevAway = previousState[matchId].awayGoals;

        // If a goal is scored
        if (homeGoals > prevHome || awayGoals > prevAway) {
          // Grab details of the goal scorer from the events timeline array if available
          let scorerName = "Unknown Player";
          let assistName = "None";
          
          if (match.events && match.events.length > 0) {
            const goals = match.events.filter(e => e.type === "Goal");
            if (goals.length > 0) {
              const latestGoal = goals[goals.length - 1];
              scorerName = latestGoal.player.name || "Unknown";
              assistName = latestGoal.assist.name || "None";
            }
          }

          const alertMessage = `⚽ **GOAAAAAL!** ⚽\n\n` +
                               `🏆 **${homeTeam}  ${homeGoals} - ${awayGoals}  ${awayTeam}**\n` +
                               `👤 **Scorer:** ${scorerName}\n` +
                               `👟 **Assist:** ${assistName}\n` +
                               `⏰ **Minute:** ${elapsedMin}'`;

          await sendTelegramMessage(alertMessage);
        }
      }
    }

    // Save the current state for the next check cycle
    fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2));

  } catch (error) {
    console.error("Error fetching live scores:", error.message);
  }
}

checkLiveScores();
