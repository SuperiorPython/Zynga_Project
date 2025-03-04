const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const port = 3000;
const path = require('path');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/../client/index.html'));
});

app.use(express.static(path.join(__dirname, '/../client')));

const players = {};

// Helper Functions
function createDeck() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(deck, numCards = 26) {
    const hand = [];
    for (let i = 0; i < numCards; i++) {
        const card = deck.shift();
        if (card) {
            hand.push(card);
        } else {
            break;
        }
    }
    return hand;
}

function determineWinner(card1, card2) {
    if (card1.rank > card2.rank) {
        return 1; // Player 1 wins
    } else if (card1.rank < card2.rank) {
        return 2; // Player 2 wins
    } else {
        return 0; // Tie (War)
    }
}

function refillHand(player) {
    if (player.hand.length === 0 && player.deck.length === 0) {
        if (player.wonCards.length > 0) {
            player.deck = shuffleDeck(player.wonCards);
            player.wonCards = [];
            player.hand = dealCards(player.deck, 26);
            io.to(player.socketId).emit('dealCards', player.hand.length);
        }
    }
}


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    const deck = shuffleDeck(createDeck());
    const playerDeck = deck.slice();

    players[socket.id] = {
        hand: dealCards(playerDeck),
        deck: playerDeck,
        wonCards: [], // Separate stack for won cards
        score: 0,
        socketId: socket.id,
        playedCard: null,
        opponentId: null
    };

    socket.emit('dealCards', players[socket.id].hand.length);

    const opponentId = Object.keys(players).find(id => id !== socket.id);
    if (opponentId) {
        players[socket.id].opponentId = opponentId;
        players[opponentId].opponentId = socket.id;
        io.to(opponentId).emit('opponentConnected', socket.id);
        socket.emit('opponentConnected', opponentId);
    }

    socket.on('playCard', () => {
        const player = players[socket.id];
        if (!player || player.hand.length === 0) return;

        const card = player.hand.shift();
        player.playedCard = card;

        const opponent = players[player.opponentId];

        if (!opponent) {
            socket.emit('waitingForOpponent');
            return;
        }

        // Check if both players have played a card
        if (player.playedCard && opponent.playedCard) {
            resolveRound(player, opponent);
        } else {
            // Inform the player that they've played, but are waiting for the opponent
            socket.emit("waitingForOpponentPlay");
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        const opponentId = players[socket.id]?.opponentId;
        if (opponentId) {
            io.to(opponentId).emit('opponentDisconnected');
            players[opponentId].opponentId = null;
        }
        delete players[socket.id];
    });
});

function resolveRound(player1, player2) {
    const card1 = player1.playedCard;
    const card2 = player2.playedCard;

    io.to(player1.socketId).emit('cardPlayed', card1);
    io.to(player2.socketId).emit('cardPlayed', card2);

    const winnerNum = determineWinner(card1, card2);
    let winner, loser;

    if (winnerNum === 1) {
        winner = player1;
        loser = player2;
    } else if (winnerNum === 2) {
        winner = player2;
        loser = player1;
    } else {
        // Handle War (not implemented yet)
        console.log("WAR!");
        player1.playedCard = null;
        player2.playedCard = null;
        return;
    }

    // Winner keeps their card and gains the loser's card
    winner.wonCards.push(winner.playedCard, loser.playedCard);

    refillHand(winner);
    refillHand(loser);

    // Emit the UPDATED hand sizes and wonCards sizes
    io.emit('roundOver', winner.socketId, loser.socketId,
        player1.hand.length + player1.deck.length + player1.wonCards.length,
        player2.hand.length + player2.deck.length + player2.wonCards.length,
        player1.wonCards.length,
        player2.wonCards.length
    );

    player1.playedCard = null;
    player2.playedCard = null;
}

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});