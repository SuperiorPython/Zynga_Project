const socket = io();

const playerHand = document.getElementById('player-hand');
const table = document.getElementById('table');
const opponentHand = document.getElementById('opponent-hand');
const warZone = document.getElementById('war-zone');
const playerScoreDisplay = document.getElementById('player-score');
const opponentScoreDisplay = document.getElementById('opponent-score');
const messageDisplay = document.getElementById('message'); // Get the message display element

let playerHandData = [];
let opponentHandSize = 0;
let playerScore = 0;
let opponentScore = 0;
let inWar = false;
let myId = null;
let opponentId = null;

socket.on('connect', () => {
    console.log('Connected to server');
    myId = socket.id;
    opponentId = null;
    messageDisplay.textContent = ""; // Clear message on connect
});

socket.on('dealCards', (hand) => {
    playerHandData = hand;
    updatePlayerHand();
});

socket.on('opponentConnected', (id) => {
    opponentId = id;
    messageDisplay.textContent = "Opponent connected!";
});

socket.on('opponentDisconnected', () => {
    opponentId = null;
    opponentHandSize = 0;
    opponentHand.innerHTML = ''; // Clear opponent's hand display
    messageDisplay.textContent = "Opponent disconnected.";
    table.innerHTML = '';
    warZone.innerHTML = '';
});

socket.on('cardPlayed', (card, player) => {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');
    cardElement.textContent = card ? `${card.rank} of ${card.suit}` : '';

    if (player === myId) {
        table.appendChild(cardElement);
    } else {
        opponentHand.appendChild(cardElement);
    }
});

socket.on('warStarted', (warCards) => {
    inWar = true;
    warZone.innerHTML = '';
    warCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        cardElement.textContent = `${card.rank} of ${card.suit}`;
        warZone.appendChild(cardElement);
    });
});

socket.on('roundOver', (winnerId, capturedCards, playerHandSize, opponentHandSize) => {
    inWar = false;
    table.innerHTML = ''; // Clear played cards from table
    warZone.innerHTML = ''; // Clear war zone

    if (winnerId === myId) {
        playerScore += capturedCards.length;
    } else {
        opponentScore += capturedCards.length;
    }

    updateScores();

    myHandSize = playerHandSize; // Directly update myHandSize
    opponentHandSize = opponentHandSize; // Directly update opponentHandSize

    updatePlayerHand(); // Update the player's hand display
    updateOpponentHand(); // Update the opponent's hand display
});


socket.on('updateOpponentHand', (size, opponentSocketId) => {
    if (opponentSocketId !== myId) {
        opponentHandSize = size;
        updateOpponentHand();
    }
});

function updatePlayerHand() {
    playerHand.innerHTML = '';
    playerHandData.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        cardElement.textContent = `${card.rank} of ${card.suit}`;
        const playButton = document.createElement('button');
        playButton.textContent = "Play Card";
        playButton.addEventListener('click', () => {
            if (!inWar && opponentId) { // Ensure opponent is connected
                socket.emit('playCard', card);
            }
        });
        cardElement.appendChild(playButton);
        playerHand.appendChild(cardElement);
    });
}

function updateOpponentHand() {
    opponentHand.innerHTML = '';
    for (let i = 0; i < opponentHandSize; i++) {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card');
        opponentHand.appendChild(cardElement);
    }
}

function updateScores() {
    playerScoreDisplay.textContent = `Player Score: ${playerScore}`;
    opponentScoreDisplay.textContent = `Opponent Score: ${opponentScore}`;
}

updateScores();