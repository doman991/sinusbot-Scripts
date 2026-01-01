"use strict";
///<reference path="../node_modules/sinusbot/typings/global.d.ts" />
registerPlugin({
    name: "Expanding Channels",
    engine: ">= 1.0.0",
    version: "1.6.0",
    description: "Automatic channel creation with persistent infinite numbering – per parent channel + reset via command",
    author: "Multivitamin + modifications, expanded by doman991",
    backends: ["ts3"],
    vars: [{
        type: "array",
        name: "channels",
        title: "Channels",
        default: [],
        vars: [{
            type: "channel",
            name: "parent",
            title: "Parent Channel",
            default: "0"
        }, {
            type: "string",
            name: "name",
            title: "Channel Name, use % to indicate the position of the number (e.g. 'Talk %')",
            default: ""
        }, {
            type: "select",
            name: "numerals",
            title: "Number format",
            options: ["Decimal", "Roman", "Binary"],
            default: "0"
        }, {
            type: "number",
            name: "minKeep",
            title: "Minimum amount of channels to keep",
            default: 1
        }, {
            type: "number",
            name: "minfree",
            title: "Minimum amount of free channels to generate",
            default: 1
        }, {
            type: "number",
            name: "maximumChannels",
            title: "Maximum amount of channels to create (0 = unlimited)",
            default: 0
        }, {
            type: "number",
            name: "deleteDelay",
            title: "Delay in seconds till the channel gets deleted after empty (0 = disable)",
            default: 0
        }, {
            type: "select",
            name: "deleteMode",
            title: "Delete Mode",
            options: ["just delete", "wait for bottom channels to empty"],
            default: "0"
        }, {
            type: "select",
            name: "codec",
            title: "Audio codec",
            options: ["Opus Voice", "Opus Music"],
            default: "0"
        }, {
            type: "select",
            name: "quality",
            title: "Codec Quality",
            options: ["1","2","3","4","5","6","7","8","9","10"],
            default: "9"
        }, {
            type: "number",
            name: "maxClients",
            title: "Max clients (-1 = unlimited)",
            default: -1
        }, {
            type: "string",
            name: "topic",
            title: "Channel Topic",
            default: ""
        }, {
            type: "multiline",
            name: "description",
            title: "Channel description",
            default: ""
        }, {
            type: "checkbox",
            name: "disableEncryption",
            title: "Disable voice encryption?",
            default: false
        }, {
            type: "array",
            name: "names",
            title: "Custom channel names",
            default: [],
            vars: [{
                type: "number",
                name: "number",
                title: "Number to replace",
                default: -1
            }, {
                type: "string",
                name: "value",
                title: "Channel name",
                default: "__NO_TEXT_GIVEN__"
            }]
        }, {
            type: "array",
            name: "permissions",
            title: "Custom Permissions",
            default: [],
            vars: [{
                type: "string",
                name: "name",
                title: "Permission name",
                default: "__INVALID__"
            }, {
                type: "number",
                name: "value",
                title: "Value",
                default: 0
            }, {
                type: "checkbox",
                name: "skip",
                title: "Skip flag?",
                default: false
            }, {
                type: "checkbox",
                name: "negate",
                title: "Negate flag?",
                default: false
            }]
        }]
    }, {
        type: "number",
        name: "resetGroupId",
        title: "Server Group ID uprawniona do resetu liczników (0 = wszyscy, puste = nikt)",
        default: 0
    }]
}, (_, config) => {
    const { channels, resetGroupId = 0 } = config;
    const event = require("event");
    const backend = require("backend");
    const store = require("store");
    const engine = require("engine");
    const INT32_MAX = 2147483647;

    class Roman {
        static upToTen(num, one, five, ten) {
            let value = "";
            switch (num) {
                case 0: return value;
                case 9: return one + ten;
                case 4: return one + five;
            }
            if (num >= 5) value = five, num -= 5;
            while (num-- > 0) value += one;
            return value;
        }
        static toRoman(arabic) {
            arabic = Math.floor(arabic);
            if (arabic < 0) throw new Error("Negative numbers not supported");
            if (arabic > 3999) throw new Error("Numbers over 3999 not supported");
            if (arabic === 0) return "nulla";
            let roman = "";
            roman += Roman.upToTen(Math.floor(arabic / 1000), "M", "", ""), arabic %= 1000;
            roman += Roman.upToTen(Math.floor(arabic / 100), "C", "D", "M"), arabic %= 100;
            roman += Roman.upToTen(Math.floor(arabic / 10), "X", "L", "C"), arabic %= 10;
            roman += Roman.upToTen(arabic, "I", "V", "X");
            return roman;
        }
        static toArabic(roman) {
            if (/^nulla$/i.test(roman) || !roman.length) return 0;
            const match = roman.toUpperCase().match(/^(M{0,3})(CM|DC{0,3}|CD|C{0,3})(XC|LX{0,3}|XL|X{0,3})(IX|VI{0,3}|IV|I{0,3})$/);
            if (!match) throw new Error("Invalid roman numeral");
            let arabic = 0;
            arabic += match[1].length * 1000;
            arabic += (match[2] === "CM") ? 900 : (match[2] === "CD") ? 400 : match[2].length * 100 + (match[2][0] === "D" ? 400 : 0);
            arabic += (match[3] === "XC") ? 90 : (match[3] === "XL") ? 40 : match[3].length * 10 + (match[3][0] === "L" ? 40 : 0);
            arabic += (match[4] === "IX") ? 9 : (match[4] === "IV") ? 4 : match[4].length * 1 + (match[4][0] === "V" ? 4 : 0);
            return arabic;
        }
    }

    const DeleteMode = { SIMPLE: "0", WAIT_EMPTY: "1" };
    const Numeral = { DECIMAL: "0", ROMAN: "1", BINARY: "2" };

    class ExpandingChannel {
        constructor(config) {
            this.channelName = config.name;
            this.parentChannel = config.parent;
            this.minimumKeep = config.minimumKeep;
            this.maximumChannels = config.maximumChannels;
            this.minimumFree = config.minimumFree;
            this.regex = config.regex;
            this.deleteDelay = config.deleteDelay;
            this.channelOpts = config.channelOpts;
            this.numeralMode = config.numeralMode;
            this.permissions = config.permissions;
            this.names = config.names;
            this.deleteMode = config.deleteMode;

            const safeName = this.channelName.replace(/[^a-zA-Z0-9_-]/g, "_");
            this.storeKey = `expanding_lastnum_${this.parentChannel.id()}_${safeName}`;

            this.handleMoveEvent();
            setTimeout(() => this.checkFreeChannels(), 2000);
            setInterval(() => this.checkFreeChannels(), 60000);
        }

        static from(config) {
            if (!/%/.test(config.name)) throw new Error(`No "%" in channel name "${config.name}"`);
            const parent = backend.getChannelByID(config.parent);
            if (!parent) throw new Error(`Parent channel not found: ${config.parent}`);

            const channelOpts = {
                codec: config.codec === "0" ? 4 : 5,
                codecQuality: parseInt(config.quality, 10) + 1,
                maxClients: config.maxClients,
                description: config.description,
                topic: config.topic,
                encrypted: !config.disableEncryption
            };

            const permissions = (config.permissions || [])
                .filter(p => p.name !== "__INVALID__")
                .map(p => p.name === "i_icon_id" && p.value > INT32_MAX ? {...p, value: p.value - 0xFFFFFFFF - 1} : p);

            const numeralMode = { "0": Numeral.DECIMAL, "1": Numeral.ROMAN, "2": Numeral.BINARY }[config.numerals] || Numeral.DECIMAL;
            const deleteMode = config.deleteMode === "1" ? DeleteMode.WAIT_EMPTY : DeleteMode.SIMPLE;

            const maximumChannels = config.maximumChannels > 0
                ? Math.max(config.minfree, config.maximumChannels)
                : 0;

            const regex = new RegExp(`^${config.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, "(.*)")}$`);

            return new ExpandingChannel({
                name: config.name,
                parent,
                minimumKeep: Math.max(config.minKeep, config.minfree),
                minimumFree: config.minfree,
                maximumChannels,
                deleteDelay: config.deleteDelay * 1000,
                deleteMode,
                channelOpts,
                permissions,
                names: (config.names || []).filter(n => n.number > 0),
                numeralMode,
                regex
            });
        }

        handleMoveEvent() {
            event.on("channelDelete", (channel, invoker) => {
                if (invoker && invoker.isSelf()) return;
                if (!channel.parent() || !channel.parent().equals(this.parentChannel)) return;
                this.checkFreeChannels();
            });
            event.on("clientMove", ({ fromChannel, toChannel }) => {
                const toP = toChannel && toChannel.parent();
                const fromP = fromChannel && fromChannel.parent();
                if ((toP && toP.equals(this.parentChannel)) || (fromP && fromP.equals(this.parentChannel))) {
                    this.checkFreeChannels();
                }
            });
        }

        getSubChannels() {
            return backend.getChannels().filter(ch => ch.parent() && ch.parent().equals(this.parentChannel));
        }

        getEmptyChannels() {
            return this.getSubChannels().filter(ch => ch.getClientCount() === 0);
        }

        checkFreeChannels() {
            const channels = this.getSubChannels();
            this.updateChannels(channels);
            const free = this.getEmptyChannels().length;

            if (free > this.minimumFree && channels.length > this.minimumKeep) {
                if (this.deleteDelay === 0) this.deleteChannels();
                else this.deleteWithDelay();
            } else if (free < this.minimumFree || channels.length < this.minimumKeep) {
                if (this.channelLimitReached(channels.length)) return;
                clearTimeout(this.deleteTimeout);
                this.createChannels(channels, free);
            } else {
                clearTimeout(this.deleteTimeout);
            }
        }

        channelLimitReached(count) {
            return this.maximumChannels > 0 && count >= this.maximumChannels;
        }

        updateChannels(channels) {
            channels.forEach(ch => {
                const num = this.getNumberFromName(ch.name());
                if (num === 0) return ch.delete();
                const correctName = this.getChannelName(num);
                if (ch.name() !== correctName) ch.setName(correctName);
            });
        }

        deleteWithDelay() {
            clearTimeout(this.deleteTimeout);
            this.deleteTimeout = setTimeout(() => this.deleteChannels(), this.deleteDelay);
        }

        deleteChannels() {
            const channels = this.getSubChannels();
            const structure = this.getChannelStructureInfo(channels);

            if (this.deleteMode === DeleteMode.SIMPLE) {
                const empty = structure.filter(s => s.channel.getClientCount() === 0);
                while (empty.length > this.minimumFree && channels.length > this.minimumKeep) {
                    empty.pop().channel.delete();
                }
            } else {
                let reversed = structure.slice().reverse();
                let flag = false;
                reversed = reversed.filter(s => {
                    flag = flag || s.channel.getClientCount() > 0;
                    return !flag && s.channel.getClientCount() === 0;
                });
                while (reversed.length > 0 && channels.length > this.minimumKeep) {
                    reversed.shift().channel.delete();
                }
            }
        }

        createChannels(channels, freeCount) {
            while ((freeCount++ < this.minimumFree || channels.length < this.minimumKeep) && !this.channelLimitReached(channels.length)) {
                const structure = this.getChannelStructureInfo(channels);
                const nextNum = this.getNextFreeNumber(structure);
                const lastId = structure.length === 0 ? "0" : structure[structure.length - 1].channel.id();
                channels.push(this.createChannel(nextNum, lastId));
            }
        }

        getChannelStructureInfo(channels) {
            return channels
                .map(ch => ({ channel: ch, n: this.getNumberFromName(ch.name()) }))
                .filter(item => item.n > 0)
                .sort((a, b) => a.n - b.n);
        }

        createChannel(num, position) {
            const channel = backend.createChannel({
                name: this.getChannelName(num),
                parent: this.parentChannel.id(),
                permanent: true,
                position,
                ...this.channelOpts
            });
            if (!channel) throw new Error("Failed to create channel");

            this.permissions.forEach(p => {
                const perm = channel.addPermission(p.name);
                perm.setValue(p.value);
                if (p.skip) perm.setSkip(true);
                if (p.negate) perm.setNegated(true);
                perm.save();
            });

            return channel;
        }

        getNextFreeNumber(structure) {
            let lastUsed = parseInt(store.get(this.storeKey) || "0", 10);
            let currentMax = structure.length > 0 ? Math.max(...structure.map(s => s.n)) : 0;
            let next = Math.max(lastUsed, currentMax) + 1;
            store.set(this.storeKey, next.toString());
            return next;
        }

        getNumberFromName(name) {
            const custom = this.names.find(n => n.value === name);
            if (custom) return custom.number;

            const match = name.match(this.regex);
            if (!match) return 0;

            const val = match[1];
            if (/^\d+$/.test(val)) return parseInt(val, 10);
            if (/^[IVXLCDM]+$/i.test(val)) return Roman.toArabic(val);
            if (/^[01\s]+$/.test(val)) return parseInt(val.replace(/\s/g, ""), 2);
            return 0;
        }

        getChannelName(num) {
            const custom = this.names.find(n => n.number === num);
            if (custom) return custom.value;

            let str = "";
            switch (this.numeralMode) {
                case Numeral.BINARY:
                    str = num.toString(2);
                    while (str.length % 8 !== 0) str = "0" + str;
                    str = str.replace(/(.{4})/g, "$1 ").trim();
                    break;
                case Numeral.ROMAN:
                    str = Roman.toRoman(num);
                    break;
                default:
                    str = num.toString();
            }
            return this.channelName.replace(/%/, str);
        }

        resetNumbers() {
            const channels = this.getSubChannels();
            const structure = channels
                .map(ch => ({ channel: ch, n: this.getNumberFromName(ch.name()) }))
                .filter(item => item.n > 0)
                .sort((a, b) => a.channel.position() - b.channel.position());

            structure.forEach((item, index) => {
                const newNum = index + 1;
                if (item.n !== newNum) {
                    const newName = this.getChannelName(newNum);
                    item.channel.setName(newName);
                }
            });

            // Reset licznika - ustawiamy na aktualną liczbę kanałów
            store.set(this.storeKey, structure.length.toString());

            // Dodajemy log do konsoli SinusBota
            engine.log(`[Expanding Channels] Zresetowano licznik dla parent: ${this.parentChannel.name()} (ID: ${this.parentChannel.id()}), kanałów: ${structure.length}`);

            // Odświeżamy stan (dodaje puste jeśli potrzeba)
            this.checkFreeChannels();
        }
    }

    const instances = [];

    function init() {
        instances.length = 0;
        channels.forEach(cfg => {
            try {
                const inst = ExpandingChannel.from(cfg);
                instances.push(inst);
            } catch (e) {
                engine.log("Expanding Channels error: " + e);
            }
        });
    }

    event.on("chat", ev => {
        if (ev.mode !== 1) return; // tylko wiadomości prywatne
        const text = ev.text.trim().toLowerCase();
        const client = ev.client;

        if (text === "!resetexp") {
            if (resetGroupId !== 0) { // zmienione != na !== dla bezpieczeństwa
                const hasGroup = client.getServerGroups().some(g => parseInt(g.id()) === resetGroupId);
                if (!hasGroup) {
                    client.chat("Nie masz uprawnień do użycia tej komendy.");
                    return;
                }
            }

            client.chat("Czy na pewno chcesz zresetować liczniki wszystkich expandable channels? Wpisz !confirm w ciągu 30 sekund, aby potwierdzić.");
            const pendingKey = `pending_reset_${client.uid()}`;
            store.set(pendingKey, "true"); // ustawiamy wartość string
            setTimeout(() => {
                if (store.get(pendingKey)) {
                    store.set(pendingKey, ""); // czyścimy zamiast delete
                }
            }, 30000);
        }

        if (text === "!confirm") {
            const pendingKey = `pending_reset_${client.uid()}`;
            if (store.get(pendingKey) === "true") {
                store.set(pendingKey, ""); // czyścimy
                instances.forEach(inst => inst.resetNumbers());
                client.chat("Liczniki wszystkich expandable channels zostały zresetowane. Kanały zostały ponumerowane od 1 według pozycji.");
            } else {
                client.chat("Nie masz aktywnego żądania resetu lub minął czas potwierdzenia.");
            }
        }
    });

    if (backend.isConnected()) {
        init();
    } else {
        event.on("connect", init);
    }
});
