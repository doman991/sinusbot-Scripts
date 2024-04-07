registerPlugin({
    name: 'Username Checker',
    version: '1.1',
    description: 'Checks for banned phrases in usernames and kicks users if found.',
    author: 'doman991',
    vars: [{
        name: 'bannedPhrases',
        title: 'Banned Phrases',
        type: 'array',
        vars: [{
            name: 'phrase',
            title: 'Phrase',
            type: 'string',
            placeholder: 'Enter banned phrase'
        }]
    }, {
        name: 'kickMessage',
        title: 'Kick Message',
        type: 'string',
        placeholder: 'Enter kick message'
    }]
}, function(sinusbot, config) {
    const engine = require('engine');
    const event = require('event');

    engine.log('Username Checker script loaded');
  
    event.on('clientMove', function(ev) {
        checkUsername(ev.client);
    });

    function checkUsername(client) {
        var username = client.nick();
        for (var i = 0; i < config.bannedPhrases.length; i++) {
            var bannedPhrase = config.bannedPhrases[i].phrase.toLowerCase();
            if (username.toLowerCase().includes(bannedPhrase)) {
                engine.log('Kicking user ' + username + ' for using banned phrase: ' + bannedPhrase);
                client.kickFromServer(config.kickMessage || 'Your username contains a banned phrase.');
                return;
            }
        }
    }
});
