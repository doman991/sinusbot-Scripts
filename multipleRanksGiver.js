registerPlugin({
    name: 'Auto Assign and Remove Groups for MultiRank',
    version: '1.5',
    description: 'Assigns ranks to users in the specified server group and removes them from groups after assignment. Checks every specified seconds.',
    author: 'doman991',
    vars: [
        {
            name: 'checkInterval',
            title: 'Check Interval (in seconds)',
            type: 'number',
            placeholder: '1'
        },
        {
            name: 'triggerGroupId',
            title: 'Trigger Server Group ID (MultiRank)',
            type: 'number'
        },
        {
            name: 'assignGroups',
            title: 'Server Group IDs to Assign',
            type: 'array',
            vars: [{ name: 'groupId', type: 'number', placeholder: 'Enter a server group ID to assign' }]
        },
        {
            name: 'removeGroups',
            title: 'Server Group IDs To Be Removed',
            type: 'array',
            vars: [{ name: 'groupId', type: 'number', placeholder: 'Enter a server group ID to remove' }]
        }
    ]
}, function(sinusbot, config) {
    const engine = require('engine');
    const backend = require('backend');

    // Ensure all required configurations are set
    if (!config.triggerGroupId || !config.assignGroups || !config.removeGroups) {
        engine.log('Error: One or more required configurations are missing. Please set Trigger Server Group ID, Server Group IDs to Assign, and Server Group IDs To Be Removed.');
        return;
    }

    // Load configuration values
    const checkInterval = (config.checkInterval || 1) * 1000; // Convert seconds to milliseconds
    const triggerGroupId = String(config.triggerGroupId);
    const assignGroups = config.assignGroups.map(g => String(g.groupId));
    const removeGroups = config.removeGroups.map(g => String(g.groupId));

    // Log startup information
    engine.log('[INFO] Script started successfully.');
    engine.log(`[INFO] Check Interval: ${config.checkInterval || 1} seconds, Trigger Group ID: ${triggerGroupId}, Assign: ${assignGroups.join(', ')}, Remove: ${removeGroups.join(', ')}`);

    // Track clients in the trigger group
    let clientsInTriggerGroup = new Set();

    // Function to process users in the trigger group
    function processUsersInTriggerGroup() {
        try {
            engine.log('[DEBUG] Interval check running...');
            const currentClients = backend.getClients().filter(client => {
                const groups = client.getServerGroups().map(g => String(g.id()));
                return groups.includes(triggerGroupId);
            });

            // Find new clients not previously in the trigger group
            const newClients = currentClients.filter(client => !clientsInTriggerGroup.has(client));

            newClients.forEach(client => {
                engine.log(`[INFO] Processing user ${client.name()} (UID: ${client.uniqueId}) in trigger group ${triggerGroupId}.`);

                // Assign specified groups
                assignGroups.forEach(assignGroupId => {
                    if (!client.getServerGroups().some(g => String(g.id()) === assignGroupId)) {
                        try {
                            client.addToServerGroup(assignGroupId);
                            engine.log(`[INFO] Assigned group ${assignGroupId} to ${client.name()}`);
                        } catch (e) {
                            engine.log(`[ERROR] Failed to assign group ${assignGroupId} to ${client.name()}: ${e}`);
                        }
                    } else {
                        engine.log(`[DEBUG] User ${client.name()} already has group ${assignGroupId}.`);
                    }
                });

                // Remove from trigger group and specified groups
                const groupsToRemove = [triggerGroupId, ...removeGroups];
                groupsToRemove.forEach(removeGroupId => {
                    if (client.getServerGroups().some(g => String(g.id()) === removeGroupId)) {
                        try {
                            client.removeFromServerGroup(removeGroupId);
                            engine.log(`[INFO] Removed group ${removeGroupId} from ${client.name()}`);
                        } catch (e) {
                            engine.log(`[ERROR] Failed to remove group ${removeGroupId} from ${client.name()}: ${e}`);
                        }
                    }
                });

                // Add to tracked clients
                clientsInTriggerGroup.add(client);
            });

            // Update tracked clients (remove those no longer in the group)
            clientsInTriggerGroup = new Set(currentClients);
        } catch (e) {
            engine.log(`[ERROR] Error in interval function: ${e}`);
        }
    }

    // Set interval to check every 'checkInterval' milliseconds
    setInterval(processUsersInTriggerGroup, checkInterval);
});
