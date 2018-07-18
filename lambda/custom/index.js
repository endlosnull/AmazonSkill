'use strict';
const Alexa = require('alexa-sdk');

const APP_ID = 'amzn1.ask.skill.a5fd0941-b888-4ffa-a394-c406fbf6f3da';
const TABLE_NAME = 'lemonadestanddata';
const SKILL_NAME = 'Lemonade Stand';
const DATA_NAME = 'lemonadestanddata.json';
const WELCOME_MESSAGE = 'Welcome to your new lemonade stand game.';
const STATS_MESSAGE = 'You have ';
const LOW_STATS = ' a few ';
const MED_STATS = ' some ';
const HIGH_STATS = ' a lot of ';
const HELP_MESSAGE = 'You can say yes or no to handle the situation. You can also say stats, save game, resume, or new game.';
const HELP_REPROMPT = 'What can I help you with?';
const STOP_MESSAGE = 'Goodbye!';
const ERROR_MESSAGE = 'You can say new game to start a new lemonade stand.';
const START_STATE_ID = 100;
const LOSE_STATE_ID = 101;
const WIN_STATE_ID = 102;
const MAX_DAY = 10;
const LOW_STATS_CHANGE = 1;
const MED_STATS_CHANGE = 2;
const HIGH_STATS_CHANGE = 3;

var $data = null;

//=========================================================================================================================================
//Editing anything below this line might break your skill.
//=========================================================================================================================================

const handlers = {
    'LaunchRequest': function () {
        if (this.event.session.attributes['stateId'] !== undefined) {
            var speechOutput = 'Hello, you were playing before. Would you like to resume? ';
            var reprompt = 'Say, resume game, or, new game.';
            speechOutput = speechOutput + reprompt;
            var cardTitle = 'Restart';
            var cardContent = speechOutput;
            var imageObj = undefined;
            
            this.response.speak(speechOutput).listen(reprompt).cardRenderer(cardTitle, cardContent, imageObj);
            this.emit(':responseReady');
        } else {
            this.emit('RestartGameIntent');
        }
    },
    'RestartGameIntent': function () {
        // New game
        this.event.session.attributes['stateId'] = START_STATE_ID;
        this.event.session.attributes['day'] = 0;
        this.event.session.attributes['stats'] = {
            "money": 5,
            "supply": 5,
            "popularity": 5
        };
        
        // Read start game state
        var state = currentState(this.event);
        var description = state['description'];
        var speechOutput = WELCOME_MESSAGE + ' ' + description;
            
        // Continue to a random state
        this.event.session.attributes['stateId'] = getRandomState(this.event);
        state = currentState(this.event);
        description = state['description'];
        speechOutput = speechOutput + ' ' + description;
        
        var reprompt = description.replace('\n',' ').split('. ').pop();
        
        var cardTitle = 'Lemonade Stand';
        var cardContent = speechOutput;
        var imageObj = undefined;
        
        this.response.speak(speechOutput).listen(reprompt).cardRenderer(cardTitle, cardContent, imageObj);
        this.emit(':responseReady');
    },
    'ResumeGameIntent': function () {
        this.emit('ReadState');
    },
    'StatsIntent': function () {
        var speechOutput = STATS_MESSAGE;
        
        var money = this.event.session.attributes['stats']['money'];
        var supply = this.event.session.attributes['stats']['supply'];
        var popularity = this.event.session.attributes['stats']['popularity'];
        
        if (money > 0 && money <= 3) {
            speechOutput = speechOutput + LOW_STATS;
        } else if (money > 3 && money <= 6) {
            speechOutput = speechOutput + MED_STATS;
        } else {
            speechOutput = speechOutput + HIGH_STATS;
        }
        
        speechOutput = speechOutput + ' money, ';
        
        if (supply > 0 && supply <= 3) {
            speechOutput = speechOutput + LOW_STATS;
        } else if (supply > 3 && supply <= 6) {
            speechOutput = speechOutput + MED_STATS;
        } else {
            speechOutput = speechOutput + HIGH_STATS;
        }
        
        speechOutput = speechOutput + ' supply, ';
        
        if (popularity > 0 && popularity <= 3) {
            speechOutput = speechOutput + LOW_STATS;
        } else if (popularity > 3 && popularity <= 6) {
            speechOutput = speechOutput + MED_STATS;
        } else {
            speechOutput = speechOutput + HIGH_STATS;
        }
        
        speechOutput = speechOutput + ' popularity.';
        
        var reprompt = 'You can say repeat to hear your situation.';
        var cardTitle = 'Stats';
        var cardContent = speechOutput;
        var imageObj = undefined;
        
        this.response.speak(speechOutput).listen(reprompt).cardRenderer(cardTitle, cardContent, imageObj);
        this.emit(':responseReady');
    },
    'DecisionIntent': function () {
        if (this.event.session.attributes['stateId'] === undefined) {
            this.response.speak(ERROR_MESSAGE);
            this.emit(':responseReady');
            return;
        }
        
        var slotValues = getSlotValues(this.event.request.intent.slots);
        var decision = doDecision(this.event, [slotValues['decision']['resolved'], slotValues['decision']['synonym']]);
        
        // Increment day
        this.event.session.attributes['day'] = this.event.session.attributes['day'] + 1;
        
        var speechOutput = decision['description'];
        var didWin = isWin(this.event);
        var didLose = isLose(this.event);
        
        if (didWin) {
            this.event.session.attributes['stateId'] = WIN_STATE_ID;
        } else if (didLose) {
            this.event.session.attributes['stateId'] = LOSE_STATE_ID;
        } else {
            // Continue to a random state
            this.event.session.attributes['stateId'] = getRandomState(this.event);
            
            speechOutput = speechOutput + ' Dawn of a new day.';
        }
        
        var state = currentState(this.event);
        var description = state['description'];
        speechOutput = speechOutput + ' ' + description;
        var reprompt = description.replace('\n',' ').split('. ').pop();
        
        var cardTitle = state['name'];
        var cardContent = speechOutput;
        var imageObj = undefined;
        
        this.response.speak(speechOutput).listen(reprompt).cardRenderer(cardTitle, cardContent, imageObj);
        
        if (didWin || didLose) {
            // Clear attributes
            this.event.session.attributes['stateId'] = undefined;
            this.event.session.attributes['day'] = undefined;
            this.event.session.attributes['stats'] = undefined;
        }
        
        this.emit(':responseReady');
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = HELP_MESSAGE;
        const reprompt = HELP_REPROMPT;

        this.response.speak(speechOutput).listen(reprompt);
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        this.emit('Exit');
    },
    'AMAZON.StopIntent': function () {
        this.emit('Exit');
    },
    'AMAZON.RepeatIntent': function () {
        this.emit('ReadState');
    },
    'ReadState': function () {
        var state = currentState(this.event);
        var description = state['description'];
        var speechOutput = description;
        var reprompt = description.replace('\n',' ').split('. ').pop();
        
        var cardTitle = state['name'];
        var cardContent = speechOutput;
        var imageObj = undefined;
        
        this.response.speak(speechOutput).listen(reprompt).cardRenderer(cardTitle, cardContent, imageObj);
        this.emit(':responseReady');
    },
    'Exit': function () {
        var speechOutput = STOP_MESSAGE;
        if (TABLE_NAME) {
            speechOutput = `Your progress has been saved. ${speechOutput}`;
        }
        
        var cardTitle = 'Exit';
        var cardContent = speechOutput;
        var imageObj = undefined;
        
        this.response.speak(speechOutput).cardRenderer(cardTitle, cardContent, imageObj);
        this.emit(':responseReady');
    },
    'Unhandled': function () {
        // Handle any intent in interaction model with no handler code
        console.log('Unhandled');
        
        if (this.event.session.attributes['stateId'] === undefined) {
            // Unhandled but no session data
            this.emit('RestartGameIntent');
        } else {
            this.emit('ReadState');
        }
    },
    'SessionEndedRequest': function() {
        // "exit", timeout or error. Cannot send back a response
        console.log(`Session ended: ${this.event.request.reason}`);
    }
};

exports.handler = function (event, context, callback) {
    // Load json data
    var fs = require('fs');
    var contents = fs.readFileSync(DATA_NAME, 'utf8');
    $data = JSON.parse(contents);
    
    const alexa = Alexa.handler(event, context, callback);
    alexa.APP_ID = APP_ID;
    alexa.dynamoDBTableName = TABLE_NAME;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function currentState(event) {
    var currentStateData = undefined;
    var stateType = 'uniqueStates';
    
    // Check unique states
    for (var i = 0; i < $data[stateType].length; i++) {
        if ($data[stateType][i]['id'] === event.session.attributes['stateId']) {
            currentStateData = $data[stateType][i];
            break;
        }
    }
    
    if (currentStateData === undefined)
    {
        // Check random states
        stateType = 'randomStates';
        for (var i = 0; i < $data[stateType].length; i++) {
            if ($data[stateType][i]['id'] === event.session.attributes['stateId']) {
                currentStateData = $data[stateType][i];
                break;
            }
        }
    }
    
    return currentStateData;
}

function getRandomState(event)
{
    const currentId = event.session.attributes['stateId'];
    const randomStatesLength = $data['randomStates'].length;
    var randomId = Math.floor(Math.random() * randomStatesLength);
    
    // Don't repeat the current state
    while (randomId === currentId)
    {
        randomId = Math.floor(Math.random() * randomStatesLength);
    }
    
    return randomId;
}

function addLowMoney(event) {
    event.session.attributes['stats']['money'] = event.session.attributes['stats']['money'] + LOW_STATS_CHANGE;
}

function addLowSupply(event) {
    event.session.attributes['stats']['supply'] = event.session.attributes['stats']['supply'] + LOW_STATS_CHANGE;
}

function addLowPopularity(event) {
    event.session.attributes['stats']['popularity'] = event.session.attributes['stats']['popularity'] + LOW_STATS_CHANGE;
}

function subLowMoney(event) {
    event.session.attributes['stats']['money'] = event.session.attributes['stats']['money'] - LOW_STATS_CHANGE;
}

function subLowSupply(event) {
    event.session.attributes['stats']['supply'] = event.session.attributes['stats']['supply'] - LOW_STATS_CHANGE;
}

function subLowPopularity(event) {
    event.session.attributes['stats']['popularity'] = event.session.attributes['stats']['popularity'] - LOW_STATS_CHANGE;
}

function addMedSupply(event) {
    event.session.attributes['stats']['supply'] = event.session.attributes['stats']['supply'] + MED_STATS_CHANGE;
}

function subMedSupply(event) {
    event.session.attributes['stats']['supply'] = event.session.attributes['stats']['supply'] - MED_STATS_CHANGE;
}

function addHighPopularity(event) {
    event.session.attributes['stats']['popularity'] = event.session.attributes['stats']['popularity'] + HIGH_STATS_CHANGE;
}

const effectsMap = [
    { name: 'AddLowMoney', func: addLowMoney },
    { name: 'AddLowSupply', func: addLowSupply },
    { name: 'AddLowPopularity', func: addLowPopularity },
    { name: 'SubLowMoney', func: subLowMoney },
    { name: 'SubLowSupply', func: subLowSupply },
    { name: 'SubLowPopularity', func: subLowPopularity },
    { name: 'AddMedSupply', func: addMedSupply },
    { name: 'SubMedSupply', func: subMedSupply },
    { name: 'AddHighPopularity', func: addHighPopularity }
];

function doDecision(event, decision_or_array) {
    var decisionData = undefined;
    var state = currentState(event);
    var decisions = [];
    
    if (decision_or_array instanceof Array) {
        decisions = decision_or_array;
    } else {
        decisions = [decision_or_array];
    }
    
    decisions.every(function(decision, index, _arr) {
       console.log(`doDecision: try '${decision}' from ${state['id']}`); 
       for (var i = 0; i < state['decisions'].length; i++) {
           if (state['decisions'][i]['decision'].toLowerCase() === decision.toLowerCase()) {
               // Found the matching decision
               decisionData = state['decisions'][i];
               break;
           }
       }
    });
    
    // Do the effects of the decision
    for (var i = 0; i < decisionData['effects'].length; i++) {
        for (var j = 0; j < effectsMap.length; j++) {
            if (decisionData['effects'][i].toLowerCase() === effectsMap[j]['name'].toLowerCase()) {
                // Do the effect
                effectsMap[j]['func'](event);
                break;
            }
        }
    }
    
    return decisionData;
}

function isLose(event) {
    return (event.session.attributes['stats']['money'] <= 0
        || event.session.attributes['stats']['supply'] <= 0
        || event.session.attributes['stats']['popularity'] <= 0);
}

function isWin(event) {
    return (event.session.attributes['day'] >= MAX_DAY);
}

/* HELPER FUNCTIONS */

function getSlotValues(filledSlots) {
    const slotValues = {};
    
    Object.keys(filledSlots).forEach((item) => {
        const name = filledSlots[item].name;
        
        if (filledSlots[item] &&
            filledSlots[item].resolutions &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
            case 'ER_SUCCESS_MATCH':
                slotValues[name] = {
                    synonym: filledSlots[item].value,
                    resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
                    isValidated: true,
                };
                break;
            case 'ER_SUCCESS_NO_MATCH':
                slotValues[name] = {
                    synonym: filledSlots[item].value,
                    resolved: filledSlots[item].value,
                    isValidated: false,
                };
                break;
            default:
                break;
            }
        } else {
            slotValues[name] = {
                synonym: filledSlots[item].value,
                resolved: filledSlots[item].value,
                isValidated: false,
            };
        }
    }, this);
    
    return slotValues;
}
