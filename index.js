//1.0.4
var udp = require('../../udp')
var instance_skel = require('../../instance_skel')
var ping = require('ping')
const mqtt = require('mqtt')

const HIGHRED = Buffer.from([
    2, 5, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0,
])
const HIGHGREEN = Buffer.from([
    2, 5, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0,
])
const HIGHNONE = Buffer.from([2, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const INIT = Buffer.from([2, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    // const LOWRED = Buffer.from([5, 5, 1])
    // const LOWGREEN = Buffer.from([5, 5, 2])
    // const LOWNONE = Buffer.from([5, 5, 0])
const LOWSTR = Buffer.from([5, 5, 4])
const LOWREC = Buffer.from([5, 5, 3])

function instance(system, id, config) {
    var self = this

    // super-constructor
    instance_skel.apply(this, arguments)

    self.actions() // export actions
    self.init_presets()
    self.sendBuf = INIT
    self.cloudMsg = INIT
    self.mqttClient = INIT
    return self
}


instance.prototype.updateTallyInfo = function() {
    var self = this
    if (self.config.control === 'Companion') {
        if (self.udp !== undefined && self.config.host !== undefined) {
            try {
                self.udp.send(self.sendBuf)
            } catch (err) {
                if (err.message === 'Not running') {
                    console.log(err)
                    delete self.udp
                }
            }
        }
    }
}

instance.prototype.searchAndConnect = function() {
    var self = this
    self.debug('Not connected, searching...')
    self.status(self.STATE_WARNING, 'Connecting')
    if (self.config.manualip === '') {
        self.config.manualip = '0.0.0.0'
    }
    if (self.config.control !== 'Cloud') {
        (async() => {
            if (self.config.manualip === '0.0.0.0') {
                self.debug("Auto IP mode.")
                let res = await ping.promise.probe(self.config.hostname)
                if (res.numeric_host !== undefined) {
                    //console.log(res.host + " on IP address: " + res.numeric_host)
                    self.debug(res.host + ' on IP address: ' + res.numeric_host)
                    self.config.host = res.numeric_host
                    if (self.config.host !== undefined) {
                        self.udp = new udp(self.config.host, self.config.port)
                        self.udp.send(INIT)
                        self.sendBuf = HIGHNONE
                        self.status(self.STATE_OK)
                        clearTimeout(self.tallyConnectTimeout)
                        self.udp.on('error', function(err) {
                            self.debug('Network error', err)
                            self.status(self.STATE_ERROR, err)
                            self.log('error', 'Network error: ' + err.message)
                        })

                        // If we get data, thing should be good
                        self.udp.on('data', function() {
                            self.status(self.STATE_OK)
                        })

                        self.udp.on('status_change', function(status, message) {
                            self.status(status, message)
                        })
                    }
                    //console.log(self.config.host);
                }
                if (self.config.host !== undefined) {
                    let cmd = 'http://' + self.config.host + '/' + self.config.funnyMode
                    self.sendHttp(cmd)
                    cmd = 'http://' + self.config.host + '/' + self.config.brightness
                    self.sendHttp(cmd)
                    cmd = 'http://' + self.config.host + '/' + self.config.opOnlyMode
                    self.sendHttp(cmd)
                }
                if (self.config.host !== undefined) {
                    if (self.config.control == 'Companion') {
                        self.tallyUpdateTimer = setInterval(function() {
                            self.updateTallyInfo()
                        }, self.config.pooltime)
                    }
                    self.status(self.STATE_OK, 'Connected')
                }
                if (self.config.host === undefined) {
                    self.debug('Tally not found.')
                    setTimeout(function() {
                        self.searchAndConnect()
                    }, 5000)
                }
            } else {
                self.debug("Manual IP mode.")
                self.config.host = self.config.manualip
                self.udp = new udp(self.config.host, self.config.port)
                self.udp.send(INIT)
                self.sendBuf = HIGHNONE
                self.status(self.STATE_OK)
                clearTimeout(self.tallyConnectTimeout)
                self.udp.on('error', function(err) {
                    self.debug('Network error', err)
                    self.status(self.STATE_ERROR, err)
                    self.log('error', 'Network error: ' + err.message)
                })

                // If we get data, thing should be good
                self.udp.on('data', function() {
                    self.status(self.STATE_OK)
                })

                self.udp.on('status_change', function(status, message) {
                    self.status(status, message)
                })
                if (self.config.host !== undefined) {
                    let cmd = 'http://' + self.config.host + '/' + self.config.funnyMode
                    self.sendHttp(cmd)
                    cmd = 'http://' + self.config.host + '/' + self.config.brightness
                    self.sendHttp(cmd)
                    cmd = 'http://' + self.config.host + '/' + self.config.opOnlyMode
                    self.sendHttp(cmd)
                }
                if (self.config.host !== undefined) {
                    if (self.config.control == 'Companion') {
                        self.tallyUpdateTimer = setInterval(function() {
                            self.updateTallyInfo()
                        }, self.config.pooltime)
                    }
                    self.status(self.STATE_OK, 'Connected')
                }
                if (self.config.host === undefined) {
                    self.debug('Tally not found.')
                    setTimeout(function() {
                        self.searchAndConnect()
                    }, 5000)
                }
            }
        })()
    }
}

instance.prototype.updateConfig = function(config) {
    var self = this
    self.init_presets()


    if (self.udp !== undefined) {
        self.udp.destroy()
        delete self.udp
    }

    if (self.socket !== undefined) {
        self.socket.destroy()
        delete self.socket
    }

    if (self.mqttClient.connected == true) {
        self.mqttClient.end()
            //delete self.mqttClient
    }
    self.config = config

    clearInterval(self.tallyUpdateTimer)
    if (self.config.tallynumber !== undefined) {
        if (self.config.control == 'Companion') {
            self.init_udp()
            self.init_presets()
        }
        if (self.config.control == 'Cloud') {
            self.initMqtt()
            self.init_presets()
        }
    }
}

instance.prototype.sendHttp = function(cmd) {
    var self = this
    self.system.emit('rest_get', cmd, function(err, result) {
        if (err !== null) {
            self.log('error', 'HTTP GET Request failed (' + result.error.code + ')')
            self.status(self.STATUS_ERROR, result.error.code)
                //self.onlineTallyChecker = setTimeout(function() { self.restart() }, 10000);
        }
        //clearTimeout(self.onlineTallyChecker);
    })
}

instance.prototype.destroyMqtt = function() {
    var self = this
    if (self.mqttClient !== undefined) {
        self.debug("Clean up: MQTT client exists.")
        if (self.mqttClient.connected) {
            self.publishMessage(self.config.cloudmac.toUpperCase(), "10")
            self.debug("Clean up: MQTT client is connected. Disconnection started!")
            self.mqttClient.end()
            self.debug("Clean up: MQTT client is disconnected from server.")
        }
        delete self.mqttClient
        self.debug("Clean up: MQTT client gone..")
    }
}

instance.prototype.destroy = function() {
    var self = this
    clearInterval(self.tallyUpdateTimer)

    if (self.udp !== undefined) {
        self.udp.destroy()
        delete self.udp
    }

    if (self.socket !== undefined) {
        self.socket.destroy()
        delete self.socket
    }
    self.destroyMqtt()
}

instance.prototype.init_udp = function() {
    var self = this
    self.config.port = 21324
    if (self.udp !== undefined) {
        self.udp.destroy()
        delete self.udp
    }
    if (self.config.tallynumber !== 0) {
        if (self.config.tallynumber > 0 && self.config.tallynumber < 10) {
            self.config.hostname = 'tally0' + self.config.tallynumber + '.local'
        }
        if (self.config.tallynumber >= 10 && self.config.tallynumber < 100) {
            self.config.hostname = 'tally' + self.config.tallynumber + '.local'
        }
        self.debug('Searching for IP on', self.config.hostname)
        self.searchAndConnect(self.config.hostname)
    }
}

instance.prototype.initMqtt = function() {
    var self = this

    self.destroyMqtt()

    self.mqttClient = mqtt.connect({
        host: "jnsl.asuscomm.com",
        port: 18069,
        clientId: 'CMPNSRV_' + Math.random().toString(16).substr(2, 8),
        keepalive: 60,
        clean: true,
        queueQoSZero: false
    });
    self.mqttClient.on('connect', () => {
        self.status(self.STATUS_OK)
        self.publishMessage(self.config.cloudmac.toUpperCase(), "10")
    })

    self.mqttClient.on('error', (error) => {
        self.status(self.STATUS_ERROR, error.toString())
        self.log('error', error.toString())
        self.mqttClient.end()
    })

    self.mqttClient.on('offline', () => {
        self.status(self.STATUS_WARNING, 'Offline')
    })

    self.mqttClient.on('message', (topic, message) => {
        try {
            if (topic) {
                self.handleMqttMessage(topic, message ? message.toString() : '')
            }
        } catch (e) {
            self.log('error', `Handle message faaailed: ${e.toString()}`)
        }
    })
}

instance.prototype.init = function() {
    var self = this

    self.debug()
    self.log()
    self.init_feedbacks()
    self.config.prot = 'udp' //MANUALLY FORCED

    if (self.config.tallynumber !== undefined) {
        if (self.config.control == 'Companion') {
            self.init_udp()
            self.init_presets()
        }
        if (self.config.control == 'Cloud') {
            self.initMqtt()
            self.init_presets()
        }
    }
}

instance.prototype.publishMessage = function(topic, payload) {
    var self = this
        //self.debug('Sending MQTT message', [topic, payload])
    self.mqttClient.publish(topic, payload, { qos: 0, retain: true })
}
instance.prototype.handleMqttMessage = function(topic, message) {
    this.debug('MQTT message received:', {
        topic: topic,
        message: message,
    })
}

// Return config fields for web config
instance.prototype.config_fields = function() {
    var self = this

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
                            <li><strong>Local mode: </strong></li>
							<li>Input the tally number that you wish to connect to. </li>
                            <li>Set the refresh rate. (100 ms recomended)</li>
                            <li>If you wish to auto detect your Tally IP: leave the manual ip box at 0.0.0.0 .Otherwise specify your Tally IP address.</li>
                            <li>If you want to switch from manual IP to auto IP: delete the manual IP address or input 0.0.0.0 </li>
							<li>Choose who controls the tally. If "other" is selected (provided tally server for Atem/Vmix/OBS/Tricaster/General usage or any third party software) only auxiliar functions like call or setting color modes will work through Companion.</li>
							<li>Choose any other option you want to default on your tally.</li>
                            <li><strong>Cloud mode: </strong></li>
                            <li>Write Tally number, input your tally MAC address and do not input any IP address. </li>
                            <li>Select "Cloud" on "Controlled by Companion or other server?"</li>
                            <li>Enable Cloud Mode on tally (on the Tally webpage - http://tally01.local)
                            <li>Press "Save". Tally should now display a purple and red color, meaning it's listening for cloud data.</li>
                            <li><strong>Notes on cloud tally:</strong></li>
                            <li>Only PGM, PRV, DARK, STR and REC colors are available on cloud mode. Other color settings available directly on Tally options (check Tally webpage for listing).</li>
                            <li>STR and REC are colored red on tally while on cloud mode./li>
                            <li>Call function available</li>
						</ul>
					</div>
				</div>
			`,
        },
        {
            type: 'textinput',
            id: 'tallynumber',
            label: 'Tally Number',
            width: 1,
            default: 0,
            regex: self.REGEX_NUMBER,
        },
        {
            type: 'textinput',
            id: 'pooltime',
            label: 'Refresh rate (ms)',
            width: 1,
            default: 100,
            regex: self.REGEX_NUMBER,
        },

        {
            type: 'text',
            id: 'host',
            label: 'Ip Address',
            //width: 6,
            value: self.config.host,
            regex: self.REGEX_IP,
        },
        {
            type: 'textinput',
            id: 'manualip',
            label: 'Manual Ip Address',
            default: '0.0.0.0',
            value: self.config.manualip,
            regex: self.REGEX_IP,
        },
        {
            type: 'textinput',
            id: 'cloudmac',
            label: 'Tally mac address for cloud control',
            default: '',
            width: 6,
            value: self.config.cloudmac,
        },
        {
            type: 'dropdown',
            id: 'control',
            label: 'Controlled by Companion or other server?',
            default: 'Companion',
            width: 4,
            choices: [
                { id: 'Companion', label: 'Companion' },
                { id: 'Other', label: 'Other' },
                { id: 'Cloud', label: 'Cloud' },
            ],
        },
        {
            type: 'dropdown',
            id: 'opOnlyMode',
            label: 'Tally LED Mode',
            default: 'OPONLYOFF',
            width: 4,
            choices: [
                { id: 'OPONLYOFF', label: 'Full LED' },
                { id: 'OPONLY', label: 'Operator Only' },
                { id: 'TLONLY', label: 'Talent Only' },
            ],
        },
        {
            type: 'dropdown',
            id: 'funnyMode',
            label: 'Funny PGM mode?',
            default: 'NORMAL',
            width: 4,
            choices: [
                { id: 'NORMAL', label: 'Normal' },
                { id: 'FUNNY', label: 'Funny PGM' },
                { id: 'FUNNYSTATIC', label: 'Static Rainbow PGM' },
            ],
        },
        {
            type: 'dropdown',
            id: 'brightness',
            label: 'Tally brightness level',
            default: 'HIGH',
            width: 4,
            choices: [
                { id: 'HIGH', label: 'HIGH' },
                { id: 'MEDIUM', label: 'MEDIUM' },
                { id: 'LOW', label: 'LOW' },
            ],
        },
    ]
}

// When module gets deleted


instance.prototype.CHOICES_COLOR = [
    { id: 'HIGHNONE', label: 'DARK' },
    { id: 'HIGHRED', label: 'PGM / RED' },
    { id: 'HIGHGREEN', label: 'PRV / GREEN' },
    { id: 'LOWSTR', label: 'STREAMING' },
    { id: 'LOWREC', label: 'RECORDING' },
]

instance.prototype.CHOICES_MODE = [
    { id: 'NORMAL', label: 'Normal Mode' },
    { id: 'FUNNY', label: 'Funny Rainbow Mode' },
    { id: 'FUNNYSTATIC', label: 'Static Rainbow Mode' },
    { id: 'OPONLY', label: 'Operator Side Led Only Mode' },
    { id: 'TLONLY', label: 'Talent Side Led Only Mode' },
    { id: 'OPONLYOFF', label: 'Full Led  Mode' },
    { id: 'HIGH', label: 'High Brightness' },
    { id: 'MEDIUM', label: 'Medium Brightness' },
    { id: 'LOW', label: 'Low Brightness' },
    { id: 'resetallsettings', label: '--CAUTION-- Reset ALL Tally Data' },
]

instance.prototype.init_presets = function() {
    var self = this
    var presets = []

    presets.push({
            category: 'Functions',
            label: 'PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' PGM',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'HIGHRED',
                },
            }, ],
            feedbacks: [{
                type: 'PGM',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(255, 0, 0),
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'PRV',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' PRV',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'HIGHGREEN',
                },
            }, ],
            feedbacks: [{
                type: 'PRV',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(0, 255, 0),
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Off',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Dark',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'HIGHNONE',
                },
            }, ],
            feedbacks: [{
                type: 'DARK',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(0, 0, 0),
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Streaming',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' STR',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'LOWSTR',
                },
            }, ],
            feedbacks: [{
                type: 'LOWSTR',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(204, 0, 153),
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Recording',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' REC',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'send',
                options: {
                    color: 'LOWREC',
                },
            }, ],
            feedbacks: [{
                type: 'LOWREC',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(255, 0, 0),
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Custom Color',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' CUSTOM',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'sendcustomcolor',
                options: {
                    color: self.rgb(255, 0, 255),
                },
            }, ],
            feedbacks: [{
                type: 'CUSTOMCOLOR',
                style: {
                    color: self.rgb(255, 255, 255),
                    bgcolor: self.rgb(255, 0, 255),
                },
            }, ],
        },

        {
            category: 'Functions',
            label: 'Tally Call',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' CALL',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'operatorcall',
                options: {
                    opcolor: self.rgb(255, 255, 255),
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Change Tally Mode',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Talent Led',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'TLONLY',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Change Tally Mode',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Operator Led',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'OPONLY',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Change Tally Mode',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Full Led',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'OPONLYOFF',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Rainbow PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' RGB PGM',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'FUNNY',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Static Rainbow PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' S.RGB PGM',
                size: '18',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'FUNNYSTATIC',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Normal PGM',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Normal PGM',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'NORMAL',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'High Brightness',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' High Bright',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'HIGH',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Medium Brightness',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Medium Bright',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'MEDIUM',
                },
            }, ],
        }, {
            category: 'Functions',
            label: 'Low Brightness',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' Low Bright',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'LOW',
                },
            }, ],
        }, {
            category: 'Functions',
            label: '--CAUTION-- Reset ALL Tally Data',
            bank: {
                style: 'text',
                text: 'Tally ' + self.config.tallynumber + ' RESET ALL',
                size: '15',
                color: '16777215',
                bgcolor: self.rgb(0, 0, 0),
            },
            actions: [{
                action: 'changetallymode',
                options: {
                    tallymode: 'resetallsettings',
                },
            }, ],
        }
    )

    self.setPresetDefinitions(presets)
}

instance.prototype.actions = function(system) {
    var self = this

    self.system.emit('instance_actions', self.id, {
        send: {
            label: 'Send Tally Color',
            options: [{
                type: 'dropdown',
                id: 'color',
                label: 'Tally Color:',
                default: 'HIGHNONE',
                choices: self.CHOICES_COLOR,
            }, ],
        },
        sendcustomcolor: {
            label: 'Send Custom Tally Color',
            options: [{
                type: 'colorpicker',
                id: 'color',
                label: 'Custom Tally Color:',
                default: self.rgb(255, 0, 0),
            }, ],
        },
        changetallymode: {
            label: 'Change Tally Mode',
            options: [{
                type: 'dropdown',
                id: 'tallymode',
                label: 'Custom Tally Mode:',
                default: 'NORMAL',
                choices: self.CHOICES_MODE,
            }, ],
        },
        operatorcall: {
            label: 'Operator Call',
            options: [{
                type: 'colorpicker',
                id: 'opcolor',
                label: 'Operator Led Color:',
                default: self.rgb(150, 150, 150),
            }, ],
        },
    })
}

instance.prototype.action = function(action) {
    var self = this

    switch (action.action) {
        case 'send':
            if (action.options.color === 'HIGHRED') {
                self.sendBuf = HIGHRED
                self.states = 'PGM'
                if (self.config.control === 'Cloud') {
                    self.cloudMsg = "1"
                }
                self.checkFeedbacks()
            }
            if (action.options.color === 'HIGHGREEN') {
                self.sendBuf = HIGHGREEN
                self.states = 'PRV'
                if (self.config.control === 'Cloud') {
                    self.cloudMsg = "2"
                }
                self.checkFeedbacks()
            }
            if (action.options.color === 'HIGHNONE') {
                self.sendBuf = HIGHNONE
                self.states = 'DARK'
                if (self.config.control === 'Cloud') {
                    self.cloudMsg = "0"
                }
                self.checkFeedbacks()
            }
            if (action.options.color === 'LOWSTR') {
                self.sendBuf = LOWSTR
                self.states = 'LOWSTR'
                if (self.config.control === 'Cloud') {
                    self.cloudMsg = "4"
                }
                self.checkFeedbacks()
            }
            if (action.options.color === 'LOWREC') {
                self.sendBuf = LOWREC
                self.states = 'LOWREC'
                if (self.config.control === 'Cloud') {
                    self.cloudMsg = "3"
                }
                self.checkFeedbacks()
            }
            break
        case 'sendcustomcolor':
            let temphex = action.options.color.toString(16)
            while (temphex.length !== 6) {
                temphex = '0' + temphex
            }
            let arrayHolder = []
            arrayHolder[0] = '0x02'
            arrayHolder[1] = '0x05'
            arrayHolder[2] = '0x' + temphex.slice(0, 2)
            arrayHolder[3] = '0x' + temphex.slice(2, 4)
            arrayHolder[4] = '0x' + temphex.slice(4, 6)
            arrayHolder[5] = arrayHolder[2]
            arrayHolder[6] = arrayHolder[3]
            arrayHolder[7] = arrayHolder[4]
            arrayHolder[8] = arrayHolder[2]
            arrayHolder[9] = arrayHolder[3]
            arrayHolder[10] = arrayHolder[4]
            arrayHolder[11] = arrayHolder[2]
            arrayHolder[12] = arrayHolder[3]
            arrayHolder[13] = arrayHolder[4]
            arrayHolder[14] = arrayHolder[2]
            arrayHolder[15] = arrayHolder[3]
            arrayHolder[16] = arrayHolder[4]
            arrayHolder[17] = arrayHolder[2]
            arrayHolder[18] = arrayHolder[3]
            arrayHolder[19] = arrayHolder[4]
            arrayHolder[20] = arrayHolder[2]
            arrayHolder[21] = arrayHolder[3]
            arrayHolder[22] = arrayHolder[4]
            arrayHolder[23] = arrayHolder[2]
            arrayHolder[24] = arrayHolder[3]
            arrayHolder[25] = arrayHolder[4]
            arrayHolder[26] = arrayHolder[2]
            arrayHolder[27] = arrayHolder[3]
            arrayHolder[28] = arrayHolder[4]
            self.sendBuf = Buffer.from(arrayHolder, 'utf-8')
            self.states = 'CUSTOMCOLOR'
            self.checkFeedbacks()
            break
        case 'operatorcall':
            if (self.config.control !== 'Cloud') {
                let temphex2 = action.options.opcolor.toString(16)
                while (temphex2.length !== 6) {
                    temphex2 = '0' + temphex2
                }
                let cmd = 'http://' + self.config.host + '/OPCOLOR?HEX=' + temphex2
                let cmd2 = 'http://' + self.config.host + '/OPCOLOR?HEX=000000'
                self.sendHttp(cmd)
                setTimeout(function() {
                    self.sendHttp(cmd2)
                }, 100)
                setTimeout(function() {
                    self.sendHttp(cmd)
                }, 200)
                setTimeout(function() {
                    self.sendHttp(cmd2)
                }, 400)
                setTimeout(function() {
                    self.sendHttp(cmd)
                }, 500)
                setTimeout(function() {
                    self.sendHttp(cmd2)
                }, 600)
                setTimeout(function() {
                    self.sendHttp(cmd)
                }, 700)
                setTimeout(function() {
                    self.sendHttp(cmd2)
                }, 800)
                setTimeout(function() {
                    self.sendHttp(cmd)
                }, 900)
                setTimeout(function() {
                    self.sendHttp(cmd2)
                }, 1000)
            }
            if (self.config.control === 'Cloud') {
                self.cloudMsg = "9"
            }
            break

        case 'changetallymode':
            let cmd3 = 'http://' + self.config.host + '/' + action.options.tallymode
            self.sendHttp(cmd3)
            break
    }
    if (self.config.control == 'Cloud') {
        try {
            self.mqttClient.publish(self.config.cloudmac.toUpperCase(), self.cloudMsg)
        } catch (err) {
            if (err.message === 'Not running') {
                console.log('Not running: ', err)
            }
        }
    }
}

instance.prototype.init_feedbacks = function() {
    var self = this
        // feedbacks
    var feedbacks = {}
    feedbacks['PGM'] = {
        type: 'boolean', // Add this
        label: 'PGM State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(255, 0, 0),
        },
    }

    feedbacks['PRV'] = {
        type: 'boolean', // Add this
        label: 'PRV State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(0, 255, 0),
        },
    }
    feedbacks['DARK'] = {
        type: 'boolean', // Add this
        label: 'DARK State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(0, 0, 0),
        },
    }
    feedbacks['LOWSTR'] = {
        type: 'boolean', // Add this
        label: 'Streaming State',
        description: 'Reflects the Tally color',
        style: {
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(204, 0, 153),
        },
    }
    feedbacks['LOWREC'] = {
        type: 'boolean', // Add this
        label: 'Recording State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(255, 255, 255),
            bgcolor: self.rgb(255, 0, 0),
        },
    }
    feedbacks['CUSTOMCOLOR'] = {
        type: 'boolean', // Add this
        label: 'Custom Color State',
        description: 'Reflects the Tally color',
        style: {
            // Move the values from options to here
            color: self.rgb(100, 100, 100),
            bgcolor: self.rgb(0, 0, 0),
        },
    }
    self.setFeedbackDefinitions(feedbacks)
}

instance.prototype.feedback = function(feedback) {
    var self = this
    self.debug('feedback type', feedback.type)
    self.debug('feedback state', self.states)
    if (self.states === undefined) {
        return
    }
    if (feedback.type === 'PGM') {
        if (self.sendBuf === HIGHRED) {
            return true
        }
        return false
    }
    if (feedback.type === 'PRV') {
        if (self.sendBuf === HIGHGREEN) {
            return true
        }
        return false
    }
    if (feedback.type === 'DARK') {
        if (self.sendBuf === HIGHNONE) {
            return true
        }
        return false
    }
    if (feedback.type === 'LOWSTR') {
        if (self.sendBuf === LOWSTR) {
            return true
        }
        return false
    }
    if (feedback.type === 'LOWREC') {
        if (self.sendBuf === LOWREC) {
            return true
        }
        return false
    }
    if (feedback.type === 'CUSTOMCOLOR') {
        if (
            self.sendBuf !== HIGHNONE &&
            self.sendBuf !== HIGHRED &&
            self.sendBuf !== HIGHGREEN &&
            self.sendBuf !== LOWREC &&
            self.sendBuf !== LOWSTR
        ) {
            return true
        }
        return false
    }
    return false
}

instance_skel.extendedBy(instance)
exports = module.exports = instance