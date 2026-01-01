# SinusBot Scripts
A collection of my SinusBot scripts for enhancing TeamSpeak automation and management.
---
## Username Checker Script
This script for SinusBot checks usernames upon user connection and when usernames are changed. If a username contains any of the specified banned phrases, the user will be kicked from the server.
**Warning:** When adding banned phrases, be cautious of substrings that might unintentionally match common parts of usernames. For example, short phrases like `"adm"` or `"ceo"` might unintentionally match parts of usernames and result in unintended kicks.
---
## Poke Bot
**Spam Poke Bot for SinusBot** allows you to repeatedly poke multiple users on a TeamSpeak server at set intervals. You can customize the message and time delay (in seconds) between pokes. This is useful for notifications, alerts, or simply grabbing attention in a persistent manner.
---
## Multi Rang
**Auto Assign and Remove Groups on Rank** is a SinusBot script that automates server group management on TeamSpeak. When a user joins a specific trigger group, the script assigns or removes predefined server groups.
### Features:
- **Dynamic Configuration:** Easily set the trigger group and manage group IDs via the SinusBot web interface.
- **Event-Driven:** Activates on the `serverGroupAdded` event for efficiency.
- **User-Friendly:** Intuitive UI with "Add" and "Remove" buttons for managing group IDs.
- **Robust Handling:** Includes error logging and type-safe group ID management.
Ideal for TeamSpeak admins looking to streamline role assignments and improve server organization.
---
## Expanding Channels
**Expanding Channels** is a modified version of the original script by [Multivitamin](https://forum.sinusbot.com/resources/expanding-channel.494/), which automatically creates and deletes subchannels under configured parent channels based on usage (e.g., "Talk 1", "Talk 2", etc.).

**My extensions:**
- Independent numbering and channel counting **per parent channel** – each expandable category (different parent ID) has its own separate counter and creates channels independently.
- Added a reset command (`!resetexp` with confirmation via `!confirmreset`) available only to Server Admins, which renumbers all channels sequentially starting from 1 and resets the internal counter.

Ideal for servers with multiple separate expandable channel categories that should not share a global counter.
