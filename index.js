var tcp = require('../../tcp');
var udp = require('../../udp');
var instance_skel = require('../../instance_skel');
var ping = require('ping');
//testing
const HIGHRED = Buffer.from([2, 5, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0]);
const HIGHGREEN = Buffer.from([2, 5, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0]);
const HIGHNONE = Buffer.from([2, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const INIT = Buffer.from([2, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const LOWRED = Buffer.from([5, 5, 1]);
const LOWGREEN = Buffer.from([5, 5, 2]);
const LOWNONE = Buffer.from([5, 5, 0]);
const LOWSTR = Buffer.from([5, 5, 4]);
const LOWREC = Buffer.from([5, 5, 3]);



function instance(system, id, config) {
    var self = this;

    // super-constructor
    instance_skel.apply(this, arguments);

    self.actions(); // export actions
    self.init_presets();
    this.sendBuf = INIT;
    return self;
}

instance.prototype.updateTallyInfo = function() {
    var self = this;
    if (this.config.control === 'Companion') {
        if (this.udp !== undefined && this.config.host !== undefined) {
            try {
                this.udp.send(this.sendBuf);
            } catch (err) {
                if (err.message === "Not running") {
                    console.log(err);
                    delete this.udp;
                }
            }

        }
    }
}

instance.prototype.searchAndConnect = function() {
    var self = this;
    this.debug("Not connected, searching...");
    self.status(self.STATE_WARNING, 'Connecting');
    (async() => {
        let res = await ping.promise.probe(self.config.hostname);
        if (res.numeric_host !== undefined) {
            //console.log(res.host + " on IP address: " + res.numeric_host)
            this.debug(res.host + " on IP address: " + res.numeric_host);
            self.config.host = res.numeric_host;
            if (self.config.host !== undefined) {
                self.udp = new udp(self.config.host, self.config.port);
                self.udp.send(INIT);
                self.sendBuf = HIGHNONE;
                self.status(self.STATE_OK);
                clearTimeout(this.tallyConnectTimeout);
                self.udp.on('error', function(err) {
                    self.debug("Network error", err);
                    self.status(self.STATE_ERROR, err);
                    self.log('error', "Network error: " + err.message);
                });

                // If we get data, thing should be good
                self.udp.on('data', function() {
                    self.status(self.STATE_OK);
                });

                self.udp.on('status_change', function(status, message) {
                    self.status(status, message);
                });
            }
            //console.log(self.config.host);
        }
        if (self.config.host !== undefined) {
            let cmd = 'http://' + self.config.host + '/' + this.config.funnyMode;
            this.sendHttp(cmd);
            cmd = 'http://' + self.config.host + '/' + this.config.brightness;
            this.sendHttp(cmd);
            cmd = 'http://' + self.config.host + '/' + this.config.opOnlyMode;
            this.sendHttp(cmd);
        }
        if (self.config.host !== undefined) {
            self.tallyUpdateTimer = setInterval(function() { self.updateTallyInfo() }, self.config.pooltime);
            self.status(self.STATE_OK, 'Connected');
        }
        if (self.config.host === undefined) {
            self.debug("Tally not found.");
            setTimeout(function() { self.searchAndConnect() }, 5000);
        }
    })();

}

instance.prototype.updateConfig = function(config) {
    var self = this;
    self.init_presets();

    if (self.udp !== undefined) {
        self.udp.destroy();
        delete self.udp;
    }

    if (self.socket !== undefined) {
        self.socket.destroy();
        delete self.socket;
    }

    self.config = config;

    clearInterval(this.tallyUpdateTimer);
    if (self.config.tallynumber !== undefined) {
        self.init_udp();
        self.init_presets();
    };

};

instance.prototype.sendHttp = function(cmd) {
    var self = this;
    self.system.emit('rest_get', cmd, function(err, result) {
        if (err !== null) {
            self.log('error', 'HTTP GET Request failed (' + result.error.code + ')');
            self.status(self.STATUS_ERROR, result.error.code);
            //self.onlineTallyChecker = setTimeout(function() { this.restart() }, 10000);
        }
        //clearTimeout(this.onlineTallyChecker);
    });

};

instance.prototype.init = function() {
    var self = this;

    self.debug();
    self.log();
    self.init_feedbacks();
    self.config.prot = 'udp'; //MANUALLY FORCED

    if (self.config.tallynumber !== undefined) {
        self.init_udp();
        self.init_presets();
    };

};


instance.prototype.init_udp = function() {
    var self = this;
    self.config.port = 21324;
    if (self.udp !== undefined) {
        self.udp.destroy();
        delete self.udp;
    }
    if (self.config.tallynumber !== 0) {
        if (self.config.tallynumber > 0 && self.config.tallynumber < 10) {
            self.config.hostname = 'tally0' + self.config.tallynumber + '.local';
        }
        if (self.config.tallynumber >= 10 && self.config.tallynumber < 100) {
            self.config.hostname = 'tally' + self.config.tallynumber + '.local';
        }
        this.debug("Searching for IP on", self.config.hostname);
        this.searchAndConnect(self.config.hostname);
    }
};

// Return config fields for web config
instance.prototype.config_fields = function() {
    var self = this;

    return [{
            type: 'text',
            id: 'info',
            label: 'Information',
            width: 12,
            value: `
				<div class="alert alert-danger">
					<h3>Tally-MA Wireless Tally Module Configuration</h3>
					<div>
						<strong>Please have your wireless tally previously setup with the WiFi network credentials and in ready mode (purple color) before proceeding. </strong>
						<br>
						Guidelines:
						<ul>
							<li>Input the tally number that you wish to connect to. (IP will be scanned automatically)</li>
                            <li>Set the refresh rate. (100 ms recomended)</li>
							<li>Choose who controls the tally. If "other" is selected (provided tally server for Atem/Vmix/General usage or any third party software) only auxiliar functions like call or setting color modes will work through Companion.</li>
							<li>Choose any other option you want to default on your tally.</li>
						</ul>
					</div>
				</div>
			`
        },
        {
            type: 'textinput',
            id: 'tallynumber',
            label: 'Tally Number',
            width: 2,
            default: 0,
            regex: self.REGEX_NUMBER
        },
        {
            type: 'textinput',
            id: 'pooltime',
            label: 'Refresh rate (ms)',
            width: 2,
            default: 100,
            regex: self.REGEX_NUMBER
        },

        {
            type: 'text',
            id: 'host',
            label: 'Ip Address',
            //width: 6,
            value: self.config.host,
            regex: self.REGEX_IP
        },
        {
            type: 'dropdown',
            id: 'control',
            label: 'Controlled by Companion or other server?',
            default: 'Companion',
            choices: [
                { id: 'Companion', label: 'Companion' },
                { id: 'Other', label: 'Other' }
            ]
        },
        {
            type: 'dropdown',
            id: 'opOnlyMode',
            label: 'Operator only mode?',
            default: 'OPONLYOFF',
            choices: [
                { id: 'OPONLYOFF', label: 'No' },
                { id: 'OPONLY', label: 'Yes' }
            ]
        },
        {
            type: 'dropdown',
            id: 'funnyMode',
            label: 'Funny PGM mode?',
            default: 'NORMAL',
            choices: [
                { id: 'NORMAL', label: 'Normal' },
                { id: 'FUNNY', label: 'Funny PGM' },
                { id: 'FUNNYSTATIC', label: 'Static Rainbow PGM' }
            ]
        },
        {
            type: 'dropdown',
            id: 'brightness',
            label: 'Tally brightness level',
            default: 'HIGH',
            choices: [
                { id: 'HIGH', label: 'HIGH' },
                { id: 'MEDIUM', label: 'MEDIUM' },
                { id: 'LOW', label: 'LOW' }
            ]
        }
    ]
};

// When module gets deleted
instance.prototype.destroy = function() {
    var self = this;
    clearInterval(this.tallyUpdateTimer);
    self.udp.destroy();

    if (self.socket !== undefined) {
        self.socket.destroy();
    }

    this.debug("destroy", self.id);;
};

instance.prototype.CHOICES_COLOR = [
    { id: 'HIGHNONE', label: 'DARK' },
    { id: 'HIGHRED', label: 'PGM / RED' },
    { id: 'HIGHGREEN', label: 'PRV / GREEN' },
    { id: 'LOWSTR', label: 'STREAMING' },
    { id: 'LOWREC', label: 'RECORDING' },
];

instance.prototype.CHOICES_MODE = [
    { id: 'NORMAL', label: 'Normal Mode' },
    { id: 'FUNNY', label: 'Funny Rainbow Mode' },
    { id: 'FUNNYSTATIC', label: 'Static Rainbow Mode' },
    { id: 'OPONLY', label: 'Operator Side Led Only Mode' },
    { id: 'OPONLYOFF', label: 'Full Led  Mode' },
    { id: 'HIGH', label: 'High Brightness' },
    { id: 'MEDIUM', label: 'Medium Brightness' },
    { id: 'LOW', label: 'Low Brightness' },
    { id: 'resetallsettings', label: '--CAUTION-- Reset ALL Tally Data' },

];

instance.prototype.init_presets = function() {
    var self = this;
    var presets = [];

    presets.push({
            category: 'Functions',
            label: 'PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' PGM',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'HIGHRED'
                }
            }],
            feedbacks: [{
                type: 'PGM',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(255, 0, 0)
                }
            }]
        }, {
            category: 'Functions',
            label: 'PRV',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' PRV',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'HIGHGREEN'
                }
            }],
            feedbacks: [{
                type: 'PRV',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(0, 255, 0)
                }
            }]
        }, {
            category: 'Functions',
            label: 'Off',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Dark',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'HIGHNONE'
                }
            }],
            feedbacks: [{
                type: 'DARK',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(0, 0, 0)
                }
            }]
        }, {
            category: 'Functions',
            label: 'Streaming',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' STR',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'LOWSTR'
                }
            }],
            feedbacks: [{
                type: 'LOWSTR',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(204, 0, 153)
                }
            }]
        }, {
            category: 'Functions',
            label: 'Recording',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' REC',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'LOWREC'
                }
            }],
            feedbacks: [{
                type: 'LOWREC',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(255, 0, 0)
                }
            }]
        }, {
            category: 'Functions',
            label: 'Custom Color',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' CUSTOM',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'sendcustomcolor',
                options: {
                    color: self.rgb(255, 0, 255)
                }
            }],
            feedbacks: [{
                type: 'CUSTOMCOLOR',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(255, 0, 255)
                }
            }]
        },

        {
            category: 'Functions',
            label: 'Tally Call',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' CALL',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'operatorcall',
                options: {
                    opcolor: self.rgb(255, 255, 255)
                }
            }]
        }, {
            category: 'Functions',
            label: 'Change Tally Mode',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Rear Led',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'OPONLY'
                }
            }]
        }, {
            category: 'Functions',
            label: 'Change Tally Mode',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Full Led',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'OPONLYOFF'
                }
            }]
        }, {
            category: 'Functions',
            label: 'Rainbow PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' RGB PGM',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'FUNNY'
                }
            }]
        }, {
            category: 'Functions',
            label: 'Static Rainbow PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' S.RGB PGM',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'FUNNYSTATIC'
                }
            }]
        }, {
            category: 'Functions',
            label: 'Normal PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Normal PGM',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'NORMAL'
                }
            }]
        }, {
            category: 'Functions',
            label: 'High Brightness',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' High Bright',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'HIGH'
                }
            }]
        }, {
            category: 'Functions',
            label: 'Medium Brightness',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Medium Bright',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'MEDIUM'
                }
            }]
        }, {
            category: 'Functions',
            label: 'Low Brightness',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Low Bright',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'LOW'
                }
            }]
        }, {
            category: 'Functions',
            label: '--CAUTION-- Reset ALL Tally Data',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' RESET ALL',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0)
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'resetallsettings'
                }
            }]
        },
    );

    self.setPresetDefinitions(presets);
}

instance.prototype.actions = function(system) {
    var self = this;

    self.system.emit('instance_actions', self.id, {

        'send': {
            label: 'Send Tally Color',
            options: [{
                    type: 'dropdown',
                    id: 'color',
                    label: 'Tally Color:',
                    default: 'HIGHNONE',
                    choices: self.CHOICES_COLOR
                }

            ]
        },
        'sendcustomcolor': {
            label: 'Send Custom Tally Color',
            options: [{
                    type: 'colorpicker',
                    id: 'color',
                    label: 'Custom Tally Color:',
                    default: self.rgb(255, 0, 0)
                }

            ]
        },
        'changetallymode': {
            label: 'Change Tally Mode',
            options: [{
                    type: 'dropdown',
                    id: 'tallymode',
                    label: 'Custom Tally Mode:',
                    default: 'NORMAL',
                    choices: self.CHOICES_MODE
                }

            ]
        },
        'operatorcall': {
            label: 'Operator Call',
            options: [{
                    type: 'colorpicker',
                    id: 'opcolor',
                    label: 'Operator Led Color:',
                    default: self.rgb(150, 150, 150)
                }

            ]
        }

    });
}

instance.prototype.action = function(action) {
    var self = this;

    switch (action.action) {

        case 'send':
            if (action.options.color === 'HIGHRED') {
                this.sendBuf = HIGHRED;
                this.states = 'PGM';
                this.checkFeedbacks();
            }
            if (action.options.color === 'HIGHGREEN') {
                this.sendBuf = HIGHGREEN;
                this.states = 'PRV';
                this.checkFeedbacks();
            }
            if (action.options.color === 'HIGHNONE') {
                this.sendBuf = HIGHNONE;
                this.states = 'DARK';
                this.checkFeedbacks();
            }
            if (action.options.color === 'LOWSTR') {
                this.sendBuf = LOWSTR;
                this.states = 'LOWSTR';
                this.checkFeedbacks();
            }
            if (action.options.color === 'LOWREC') {
                this.sendBuf = LOWREC;
                this.states = 'LOWREC';
                this.checkFeedbacks();
            }
            break;
        case 'sendcustomcolor':
            let temphex = action.options.color.toString(16);
            while (temphex.length !== 6) {
                temphex = '0' + temphex;
            }
            let arrayHolder = [];
            arrayHolder[0] = '0x02';
            arrayHolder[1] = '0x05';
            arrayHolder[2] = '0x' + temphex.slice(0, 2);
            arrayHolder[3] = '0x' + temphex.slice(2, 4);
            arrayHolder[4] = '0x' + temphex.slice(4, 6);
            arrayHolder[5] = arrayHolder[2];
            arrayHolder[6] = arrayHolder[3];
            arrayHolder[7] = arrayHolder[4];
            arrayHolder[8] = arrayHolder[2];
            arrayHolder[9] = arrayHolder[3];
            arrayHolder[10] = arrayHolder[4];
            arrayHolder[11] = arrayHolder[2];
            arrayHolder[12] = arrayHolder[3];
            arrayHolder[13] = arrayHolder[4];
            arrayHolder[14] = arrayHolder[2];
            arrayHolder[15] = arrayHolder[3];
            arrayHolder[16] = arrayHolder[4];
            arrayHolder[17] = arrayHolder[2];
            arrayHolder[18] = arrayHolder[3];
            arrayHolder[19] = arrayHolder[4];
            arrayHolder[20] = arrayHolder[2];
            arrayHolder[21] = arrayHolder[3];
            arrayHolder[22] = arrayHolder[4];
            arrayHolder[23] = arrayHolder[2];
            arrayHolder[24] = arrayHolder[3];
            arrayHolder[25] = arrayHolder[4];
            arrayHolder[26] = arrayHolder[2];
            arrayHolder[27] = arrayHolder[3];
            arrayHolder[28] = arrayHolder[4];
            this.sendBuf = Buffer.from(arrayHolder, 'utf-8');
            this.states = 'CUSTOMCOLOR';
            this.checkFeedbacks();
            break;
        case 'operatorcall':
            let temphex2 = action.options.opcolor.toString(16);
            while (temphex2.length !== 6) {
                temphex2 = '0' + temphex2;
            }
            let cmd = 'http://' + this.config.host + '/OPCOLOR?HEX=' + temphex2;
            let cmd2 = 'http://' + this.config.host + '/OPCOLOR?HEX=000000';
            this.sendHttp(cmd);
            setTimeout(function() { self.sendHttp(cmd2) }, 100);
            setTimeout(function() { self.sendHttp(cmd) }, 200);
            setTimeout(function() { self.sendHttp(cmd2) }, 400);
            setTimeout(function() { self.sendHttp(cmd) }, 500);
            setTimeout(function() { self.sendHttp(cmd2) }, 600);
            setTimeout(function() { self.sendHttp(cmd) }, 700);
            setTimeout(function() { self.sendHttp(cmd2) }, 800);
            setTimeout(function() { self.sendHttp(cmd) }, 900);
            setTimeout(function() { self.sendHttp(cmd2) }, 1000);
            break;

        case 'changetallymode':
            let cmd3 = 'http://' + self.config.host + '/' + action.options.tallymode;
            self.sendHttp(cmd3);
            break;

    }

}

instance.prototype.init_feedbacks = function() {
    var self = this;
    // feedbacks
    var feedbacks = {}
    feedbacks['PGM'] = {
        type: 'boolean', // Add this
        label: 'PGM State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(255, 0, 0)
        }
    }

    feedbacks['PRV'] = {
        type: 'boolean', // Add this
        label: 'PRV State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(0, 255, 0)
        }
    }
    feedbacks['DARK'] = {
        type: 'boolean', // Add this
        label: 'DARK State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(0, 0, 0)
        }
    }
    feedbacks['LOWSTR'] = {
        type: 'boolean', // Add this
        label: 'Streaming State',
        description: 'Reflects the Tally color',
        style: {
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(204, 0, 153)
        }
    }
    feedbacks['LOWREC'] = {
        type: 'boolean', // Add this
        label: 'Recording State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(255, 0, 0)
        }
    }
    feedbacks['CUSTOMCOLOR'] = {
        type: 'boolean', // Add this
        label: 'Custom Color State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(100, 100, 100),
            bgcolor: self.rgb(0, 0, 0)
        }
    }
    self.setFeedbackDefinitions(feedbacks)
}

instance.prototype.feedback = function(feedback) {
    var self = this
    this.debug("feedback type", feedback.type);
    this.debug("feedback state", this.states);
    if (this.states === undefined) {
        return
    }
    if (feedback.type === 'PGM') {
        if (this.sendBuf === HIGHRED) {
            return true
        }
        return false
    }
    if (feedback.type === 'PRV') {
        if (this.sendBuf === HIGHGREEN) {
            return true
        }
        return false
    }
    if (feedback.type === 'DARK') {
        if (this.sendBuf === HIGHNONE) {
            return true
        }
        return false
    }
    if (feedback.type === 'LOWSTR') {
        if (this.sendBuf === LOWSTR) {
            return true
        }
        return false
    }
    if (feedback.type === 'LOWREC') {
        if (this.sendBuf === LOWREC) {
            return true
        }
        return false
    }
    if (feedback.type === 'CUSTOMCOLOR') {
        if (this.sendBuf !== HIGHNONE && this.sendBuf !== HIGHRED && this.sendBuf !== HIGHGREEN && this.sendBuf !== LOWREC && this.sendBuf !== LOWSTR) {
            return true
        }
        return false
    }
    return false

}



instance_skel.extendedBy(instance);
exports = module.exports = instance;