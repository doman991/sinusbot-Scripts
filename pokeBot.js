registerPlugin({
    name: 'Poke Bot',
    version: '1.2',
    description: 'Pokes users in a list every X seconds and sends a message when they connect',
    author: 'doman991',
    vars: [
        {
            name: 'pokeMessage',
            title: 'Message to send when poking users',
            type: 'string'
        },
        {
            name: 'pokeInterval',
            title: 'Interval to poke users (in seconds)',
            type: 'number'
        },
        {
            name: 'userIds',
            title: 'User IDs to poke (comma separated)',
            type: 'string'
        }
    ]
}, function(_, config) {
    const engine = require('engine');
    const event = require('event');
    const backend = require('backend');

    const pokeMessage = config.pokeMessage || "Hello, this is a poke!";
    const pokeInterval = config.pokeInterval || 60; // default to 60 seconds
    const userIds = config.userIds ? config.userIds.split(',').map(id => id.trim()) : [];

    function pokeUsers() {
        userIds.forEach(uid => {
            const client = backend.getClientByUID(uid);
            if (client) {
                client.poke(pokeMessage);
                engine.log(`Poked user ID: ${uid}`);
            } else {
                engine.log(`User ID: ${uid} not found`);
            }
        });
    }

    // Poke users at specified interval
    setInterval(pokeUsers, pokeInterval * 1000);

    // Event listener for user connections
    event.on('clientMove', ev => {
        if (ev.fromChannel === 0 && userIds.includes(ev.clientUid)) { // User connected to the server
            const client = backend.getClientByUID(ev.clientUid);
            if (client) {
                client.poke(pokeMessage);
                engine.log(`Poked newly connected user ID: ${ev.clientUid}`);
            } else {
                engine.log(`Newly connected user ID: ${ev.clientUid} not found`);
            }
        }
    });

    // Initial poke on script load
    pokeUsers();
});
