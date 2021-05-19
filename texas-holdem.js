const readline = require("readline");

const VALUE_INDEX = 0;
const SUIT_INDEX = 1;
const HAND_SIZE = 5;

const HandRankingEnum = Object.freeze({
	"ROYAL_FLUSH": 1,
	"STRAIGHT_FLUSH": 2,
	"FOUR_OF_A_KIND": 3,
	"FULL_HOUSE": 4,
	"FLUSH": 5,
	"STRAIGHT": 6,
	"THREE_OF_A_KIND": 7,
	"TWO_PAIR": 8,
	"PAIR": 9,
	"HIGH_CARD": 10,
});

function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    let communityString = "";
    let playerHandsString = [];

    rl.on('line', (input) => {
        if (input === "") {
            let communityPool = getCommunityPool(communityString);

			let playerHands = getPlayerHands(playerHandsString);

            let rankedHands = evaluateHands(communityPool, playerHands);
			rankedHands.sort(rankSort);

			output(rankedHands);

            rl.close();
        }

        if (communityString === "") {
            communityString = input;
        } else {
            playerHandsString.push(input);
        }
    });
}

function getCommunityPool(communityStringInput){
    let communityCardsByValue = {
        "2": [],
        "3": [],
        "4": [],
        "5": [],
        "6": [],
        "7": [],
        "8": [],
        "9": [],
        "T": [],
        "J": [],
        "Q": [],
        "K": [],
        "A": []
    };
    let communityCardsBySuit = {
        "S": [],
        "C": [],
        "H": [],
        "D": []
    };
	let duplicates = {};
	let sortedValues = [];

    commStrings = communityStringInput.split(" ");

    for (const communityCard of commStrings) {
        let cardValue = getValue(communityCard);
        let cardSuit = getSuit(communityCard);

        communityCardsByValue[cardValue].push(cardSuit);
        communityCardsBySuit[cardSuit].push(cardValue);

		if (communityCardsByValue[cardValue].length > 1) {
			duplicates[cardValue] = communityCardsByValue[cardValue].length;
		}

		sortedValues.push(cardValue);
    }

	sortedValues.sort(cardSort).reverse();

    return {
        "cardsByValue": communityCardsByValue,
        "cardsBySuit": communityCardsBySuit,
		"duplicates": duplicates,
		"sortedValues":  sortedValues
    };
}

function getPlayerHands(playerHandsString) {
	let playerHands = [];

	for (const playerHand of playerHandsString){
		let handStrings = playerHand.split(" ");

		let player = {
			"name": handStrings[0],
			"cardValues": [getValue(handStrings[1]), getValue(handStrings[2])],
			"cardSuits": [getSuit(handStrings[1]), getSuit(handStrings[2])],
			"kickers": [],
			"revealKicker": false
		};

		player.matchingValue = (player.cardValues[0] === player.cardValues[1] ? player.cardValues[0] : "none");
		player.matchingSuit = player.cardSuits[0] === player.cardSuits[1];

		playerHands.push(player);
	}

	return playerHands;
}

function evaluateHands(communityPool, playerHands) {
	let rankedHands = []

	for (let playerHand of playerHands) {
		if (isRoyalOrStraightFlush(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (isFourKind(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (isFullHouse(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (isFlush(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (isStraight(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (isThreeKind(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (IsTwoPair(communityPool, playerHand, rankedHands)) {
			continue;
		} else if (IsPair(communityPool, playerHand, rankedHands)) {
			continue;
		} else {
			setHighCard(communityPool, playerHand, rankedHands);
		}
	}
	return rankedHands;
}

function isRoyalOrStraightFlush(communityPool, playerHand, rankedHands){
	if (!(playerHand.matchingSuit || communityPool.cardsBySuit[playerHand.cardSuits[0]].length >= 3)) {
		return false;
	}

	let allValues = playerHand.cardValues.concat(communityPool.cardsBySuit[playerHand.cardSuits[0]]);
	allValues.sort(cardSort);

	let consecutivity = isConsecutive(playerHand.cardValues, allValues);
	if (consecutivity.success) {
		if (consecutivity.highValue === "T") {
			playerHand.rank = "ROYAL_FLUSH";
			rankedHands.push(playerHand)
			return true;
		}
		playerHand.rank = "STRAIGHT_FLUSH";
		rankedHands.push(playerHand)
		return true;
	}
	return false;
}

function isFourKind(communityPool, playerHand, rankedHands) {
	if (playerHand.matchingValue !== "none") {
		if (communityPool.cardsByValue[playerHand.matchingValue].length !== 2) {
			return false;
		}

		for (const cardValue of communityPool.sortedValues){
			if (cardValue !== playerHand.matchingValue){
				var kicker = cardValue;
				break;
			}
		}

		playerHand.kickers.push(kicker);
		playerHand.rank = "FOUR_OF_A_KIND";
		playerHand.duplicateValue = playerHand.matchingValue;
		rankedHands.push(playerHand);
		return true;
	}

	let kickerCandidate = playerHand.cardValues[1];
	for (const cardValue of playerHand.cardValues) {
		if (communityPool.cardsByValue[cardValue].length == 3) {
			playerHand.kickers.push(kickerCandidate);
			playerHand.rank = "FOUR_OF_A_KIND";
			playerHand.duplicateValue = cardValue;
			rankedHands.push(playerHand);
			return true; 
		} else {
			kickerCandidate = cardValue;
		}
	}

	return false;
}

function isFullHouse(communityPool, playerHand, rankedHands) {
	if (playerHand.matchingValue !== "none") {
		let highestPair = "";
		let highestTrip = "";

		for (const dupeVal in communityPool.duplicates) {
			if (communityPool.duplicates[dupeVal] >= 2) {
				highestPair = getGreaterOrExistingFrom(highestPair, dupeVal);

				if (communityPool.duplicates[dupeVal] >= 3) {
					highestTrip = getGreaterOrExistingFrom(highestTrip, dupeVal);
				}
			}
		}

		if (highestTrip !== "" && numericValueOf(highestTrip) > numericValueOf(playerHand.matchingValue)) {
			playerHand.tripsValue = highestTrip;
			playerHand.pairValue = playerHand.matchingValue;
		} else if (highestPair !== "" && communityPool.cardsByValue[playerHand.matchingValue].length > 0) {
			playerHand.tripsValue = playerHand.matchingValue;
			playerHand.pairValue = highestPair;
		} else {
			return false;
		}

		playerHand.rank = "FULL_HOUSE";
		rankedHands.push(playerHand);
		return true; 
	}

	let possiblePairs = [];
	let possibleTrips = [];

	for (const cardValue of playerHand.cardValues) {
		if (communityPool.cardsByValue[cardValue].length >= 1) {
			possiblePairs.push(cardValue);

			if (communityPool.cardsByValue[cardValue].length >= 2) {
				possibleTrips.push(cardValue);
			}
		}
	}

	if (possibleTrips.length === 0) {
		return false;
	}

	possibleTrips.sort(cardSort);
	playerHand.tripsValue = possibleTrips.pop();

	possiblePairs = possiblePairs.filter(value => value !== playerHand.tripsValue);
	
	if (possiblePairs.length === 0) {
		return false;
	}

	playerHand.pairValue = possiblePairs.pop();
	playerHand.rank = "FULL_HOUSE";
	rankedHands.push(playerHand);
	return true; 
}

function isFlush(communityPool, playerHand, rankedHands) {
	let communityCardsSameSuit = communityPool.cardsBySuit[playerHand.cardSuits[0]];

	if (playerHand.matchingSuit && communityCardsSameSuit.length >= 3) {
		playerHand.rank = "FLUSH";
		playerHand.highCards = playerHand.cardValues.concat(communityCardsSameSuit.slice(0,3)).sort(cardSort);
		rankedHands.push(playerHand);
		return true;
	}
	return false;
}

function isStraight(communityPool, playerHand, rankedHands) {
	let allValues = playerHand.cardValues.concat(communityPool.sortedValues);
	allValues.sort(cardSort);

	let consecutivity = isConsecutive(playerHand.cardValues, allValues);
	if (consecutivity.success) {
		playerHand.highValue = consecutivity.highValue;
		playerHand.rank = "STRAIGHT";
		rankedHands.push(playerHand)
		return true;
	}
	return false;
}

function isThreeKind(communityPool, playerHand, rankedHands) {
	let highestTrip = "";
	let kickers = [];

	if (playerHand.matchingValue !== "none") {
		if (communityPool.cardsByValue[playerHand.matchingValue].length > 0) {
			highestTrip = playerHand.matchingValue;
			kickers = communityPool.sortedValues.filter(value => value !== highestTrip).slice(0,2);
		}
	}
	else {
		let kicker = playerHand.cardValues[1];
		for (const cardValue of playerHand.cardValues) {
			if (communityPool.cardsByValue[cardValue].length >= 2) {
				highestTrip = getGreaterOrExistingFrom(highestTrip, cardValue);
				kickers = communityPool.sortedValues.filter(value => value !== highestTrip).slice(0,1);
				kickers.push(kicker);
			}
			else {
				kicker = playerHand.cardValues[0];
			}
		}
	}

	for (const dupeVal in communityPool.duplicates) {
		if (communityPool.duplicates[dupeVal] >= 3) {
			highestTrip = getGreaterOrExistingFrom(highestTrip, dupeVal);
		}
	}
	if (highestTrip === "") {
		return false;
	}
	if (kickers.length === 0) {
		kickers = playerHand.cardValues;
	}

	kickers.sort(cardSort);
	playerHand.kickers = kickers;
	playerHand.duplicateValue = highestTrip;
	playerHand.rank = "THREE_OF_A_KIND";
	rankedHands.push(playerHand);
	return true;
}

function IsTwoPair(communityPool, playerHand, rankedHands) {
	let possiblePairs = [];

	for (const dupeVal in communityPool.duplicates) {
		if (communityPool.duplicates[dupeVal] >= 2) {
			possiblePairs.push(dupeVal);
		}
	}
	possiblePairs.sort(cardSort);

	if (playerHand.matchingValue !== "none") {
		if (possiblePairs.length < 1) {
			return false;
		}

		let highPair = possiblePairs.pop();
		let higherPairs = [playerHand.matchingValue, highPair];
		higherPairs.sort(cardSort);

		playerHand.pair1Value = higherPairs.pop();
		playerHand.pair2Value = higherPairs.pop();

		playerHand.kickers.push(communityPool.sortedValues.filter(value => value !== highPair)[0]);
	}
	else {
		let handPairs = [];
		let handPairsHigher = true;

		for (const cardValue of playerHand.cardValues) {
			if (communityPool.cardsByValue[cardValue].length >= 1) {
				handPairs.push(cardValue);
			}
		}
		if (handPairs.length == 0 || (handPairs.length == 1 && possiblePairs.length == 0)) {
			return false;
		}
		handPairs.sort(cardSort);
		
		if (possiblePairs >= 1) {
			let combinedPairs = handPairs.concat(possiblePairs);
			
			combinedPairs.sort(cardSort);
			combinedPairs = combinedPairs.slice(2,4);

			for (const pair of handPairs) {
				if (!combinedPairs.includes(pair)) {
					handPairsHigher = false;
				}
			}
		}

		if (handPairs.length > 1 && handPairsHigher) {
			playerHand.pair1Value = handPairs.pop();
			playerHand.pair2Value = handPairs.pop();
			playerHand.kickers.push(communityPool.sortedValues.filter(value => !playerHand.cardValues.includes(value))[0]);
		} else {
			let handPair = handPairs.pop();
			let viablePairs = [possiblePairs.pop(), handPair];
			viablePairs.sort(cardSort);

			playerHand.pair1Value = viablePairs.pop();
			playerHand.pair2Value = viablePairs.pop();

			playerHand.kickers.push(playerHand.cardValues.filter(value => value !== handPair).pop());
		}
	}

	playerHand.rank = "TWO_PAIR";
	rankedHands.push(playerHand);
	return true;
}

function IsPair(communityPool, playerHand, rankedHands) {
	let highestPair = "";
	let kickers = [];

	if (playerHand.matchingValue !== "none") {
		highestPair = playerHand.matchingValue;
		kickers = communityPool.sortedValues.slice(0,3);
	}
	else {
		let kicker = playerHand.cardValues[1];
		for (const cardValue of playerHand.cardValues) {
			if (communityPool.cardsByValue[cardValue].length >= 1) {
				highestPair = getGreaterOrExistingFrom(highestPair, cardValue);
				kickers = communityPool.sortedValues.filter(value => value !== highestPair).slice(0,2);
				kickers.push(kicker);
			}
			else {
				kicker = playerHand.cardValues[0];
			}
		}
	}

	for (const dupeVal in communityPool.duplicates) {
		if (communityPool.duplicates[dupeVal] >= 2) {
			highestPair = getGreaterOrExistingFrom(highestPair, dupeVal);
		}
	}

	if (highestPair === "") {
		return false;
	}

	if (kickers.length === 0) {
		kickers = playerHand.cardValues;
		kickers.push(communityPool.sortedValues.filter(value => value !== highestPair)[0]);
	}

	kickers.sort(cardSort);
	playerHand.kickers = kickers;
	playerHand.duplicateValue = highestPair;
	playerHand.rank = "PAIR";
	rankedHands.push(playerHand);
	return true;
}

function setHighCard(communityPool, playerHand, rankedHands) {
	let highCards = playerHand.cardValues.concat(communityPool.sortedValues.slice(0,3)).sort(cardSort);
	playerHand.highCards = highCards;
	playerHand.kickers = highCards.slice(0,4);
	playerHand.rank = "HIGH_CARD";
	rankedHands.push(playerHand);
}

function isConsecutive(mandatoryValues, values) {
	let possibleHand = [];

	for (i = 0; i < values.length; i++) {
		if (i === values.length-1) {
			possibleHand.push(values[i]);
		} else if (getValueDifference(values[i], values[i+1]) === 0) {
			continue;
		}
		else {
			if (getValueDifference(values[i], values[i+1]) === 1) {
				if (possibleHand.length === HAND_SIZE-1) {
					if (!mandatoryValues.includes(possibleHand[0])) {
						possibleHand.shift();
					} else {
						possibleHand.push(values[i]);
						break;
					}
				} 
				possibleHand.push(values[i]);
			}
			else if (possibleHand.length !== HAND_SIZE-1) {
				possibleHand = [];
			}
		}
	}

	return {
		"success": (possibleHand.length === HAND_SIZE
					&& possibleHand.includes(mandatoryValues[0])
					&& possibleHand.includes(mandatoryValues[1])),
		"highValue": (possibleHand.length > 0 ? possibleHand[HAND_SIZE-1] : 0)
	};
}

function getValue(card) {
	return card.charAt(VALUE_INDEX);
}

function getSuit(card) {
	return card.charAt(SUIT_INDEX);
}

function numericValueOf(value){
	switch(value) {
		case "T":
			value = 10;
			break;
		case "J":
			value = 11;
			break;
		case "Q":
			value = 12;
			break;
		case "K":
			value = 13;
			break;
		case "A":
			value = 14;
			break;
		default:
			value = parseInt(value);
	}
	return value
}

function getWrittenValue(value) {
	switch(value) {
		case "T":
			value = "10";
			break;
		case "J":
			value = "Jack";
			break;
		case "Q":
			value = "Queen";
			break;
		case "K":
			value = "King";
			break;
		case "A":
			value = "Ace";
	}
	return value
}

function stringOf(rank) {
	let stringRanks = {
		"ROYAL_FLUSH": "Royal Flush",
		"STRAIGHT_FLUSH": "Straight Flush",
		"FOUR_OF_A_KIND": "Four of a Kind",
		"FULL_HOUSE": "Full House",
		"FLUSH": "Flush",
		"STRAIGHT": "Straight",
		"THREE_OF_A_KIND": "Three of a Kind",
		"TWO_PAIR": "Two Pair",
		"PAIR": "Pair",
		"HIGH_CARD": "High Card",
	};
	return stringRanks[rank];
}

function getValueDifference(card1, card2) {
	return Math.abs(numericValueOf(card1) - numericValueOf(card2));
}

function getGreaterOrExistingFrom(newValue, oldValue) {
	if (oldValue === "") {
		return newValue;
	} else if (numericValueOf(newValue) > numericValueOf(oldValue)) {
		return newValue;
	}
	return oldValue;
}

function cardSort(a, b) {
	return numericValueOf(a) - numericValueOf(b);
}

function rankSort(a, b) {
	let difference = HandRankingEnum[a.rank] - HandRankingEnum[b.rank];
	if (difference === 0) {
		switch(HandRankingEnum[a.rank]) {
			case HandRankingEnum.STRAIGHT_FLUSH:
			case HandRankingEnum.STRAIGHT:
				return numericValueOf(b.highValue) - numericValueOf(a.highValue);
			case HandRankingEnum.FOUR_OF_A_KIND:
			case HandRankingEnum.THREE_OF_A_KIND:
			case HandRankingEnum.PAIR:
				if (numericValueOf(b.duplicateValue) - numericValueOf(a.duplicateValue) === 0) {
					for (i = b.kickers.length-1; i >= 0; i--) {
						let valueDiff = numericValueOf(b.kickers[i]) - numericValueOf(a.kickers[i]);
						if (valueDiff !== 0) {
							a.revealKicker = true;
							b.revealKicker = true;
							return valueDiff;
						}
					}
				}
				return numericValueOf(a.duplicateValue) - numericValueOf(a.duplicateValue);
			case HandRankingEnum.FULL_HOUSE:
				if (numericValueOf(b.tripsValue) - numericValueOf(a.tripsValue) === 0) {
					return numericValueOf(b.pairValue) - numericValueOf(a.pairValue);
				}
				return numericValueOf(b.tripsValue) - numericValueOf(a.tripsValue);
			case HandRankingEnum.FLUSH:
			case HandRankingEnum.HIGH_CARD:
				for (i = b.kickers.length-1; i >= 0; i--) {
					let valueDiff = numericValueOf(b.highCards[i]) - numericValueOf(a.highCards[i]);
					if (valueDiff !== 0) {
						a.revealKicker = true;
						b.revealKicker = true;
						return valueDiff;
					}
				}
				return 0;
			case HandRankingEnum.TWO_PAIR:
				if (numericValueOf(b.pair1Value) - numericValueOf(a.pair1Value) === 0) {
					if (numericValueOf(b.pair2Value) - numericValueOf(a.pair2Value) === 0) {
						a.revealKicker = true;
						b.revealKicker = true;
						return numericValueOf(b.kickers[0]) - numericValueOf(a.kickers[0])
					}
					return numericValueOf(b.pair2Value) - numericValueOf(a.pair2Value);
				}
				return numericValueOf(b.pair1Value) - numericValueOf(a.pair1Value);
		}
	}
	return difference;
}

function output(rankedHands) {
	for (i = 0; i < rankedHands.length; i++) {
		let kickerString = "";
		if (rankedHands[i].revealKicker) {
			let kickerStrings = [];
			for (j = rankedHands[i].kickers.length-1; j >= 0; j--) {
				kickerStrings.push(`${getWrittenValue(rankedHands[i].kickers[j])}`);
			}
			kickerString = `(Kickers: ${kickerStrings.join(" ")})`;
		}
		previousRank = rankedHands[i].rank;

		let condition = "";

		switch (rankedHands[i].rank) {
			case "STRAIGHT_FLUSH":
				condition = getWrittenValue(rankedHands[i].highValue);
				break;
			case "FOUR_OF_A_KIND":
				condition = getWrittenValue(rankedHands[i].duplicateValue);
				break;
			case "FULL_HOUSE":
				condition = `${getWrittenValue(rankedHands[i].tripsValue)} ${getWrittenValue(rankedHands[i].pairValue)}`;
				break;
			case "STRAIGHT":
				condition = getWrittenValue(rankedHands[i].highValue);
				break;
			case "THREE_OF_A_KIND":
				condition = getWrittenValue(rankedHands[i].duplicateValue);
				break;
			case "TWO_PAIR":
				condition = `${getWrittenValue(rankedHands[i].pair1Value)} ${getWrittenValue(rankedHands[i].pair2Value)}`;
				break;
			case "PAIR":
				condition = getWrittenValue(rankedHands[i].duplicateValue);
				break;
			case "HIGH_CARD":
				condition = getWrittenValue(rankedHands[i].highCards[HAND_SIZE-1]);
				break;
		}

		console.log(`${i+1} ${rankedHands[i].name} ${stringOf(rankedHands[i].rank)} ${condition} ${kickerString}`);
	}
}

main();