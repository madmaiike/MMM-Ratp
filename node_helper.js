/* Timetable for Paris local transport Module */
/* Magic Mirror
 * Module: MMM-Ratp
 *
 * By Louis-Guillaume MORAND
 * based on a script from Benjamin Angst http://www.beny.ch and Georg Peters (https://lane6.de)
 * MIT Licensed.
 */
const NodeHelper = require("node_helper");
const forge = require('node-forge');
const unirest = require('unirest');

module.exports = NodeHelper.create({

    updateTimer: "",
    start: function() {
        this.started = false;
        console.log("MMM-Ratp- NodeHelper started");
    },



    /* updateTimetable(transports)
     * Calls processTransports on succesfull response.
     */
    updateTimetable: function() {
        var url = this.config.apiURL;
        var self = this;
        var retry = false;


        // calling this API
        unirest.get(url)
            .end(function(r) {
                if (r.error) {
                    console.log(self.name + " : " + r.error);
                    retry = true;
                } else {
                    self.processTransports(r.body);
                }

                if (retry) {
                    console.log("retrying");
                    self.scheduleUpdate((self.loaded) ? -1 : this.config.retryDelay);
                }
            });
    },
    // Help to retrieve a type which can be directly displayed
    getSanitizedName: function(type) {
        var t = "";
        switch (type) {
            case "bus":
                t = "Bus";
                break;
            case "rers":
                t = "RER";
                break;
            case "tramways":
                t = "Tramway";
                break;
            case "noctiliens":
                t = "Noctilien";
                break;
            case "metros":
                t = "Metro";
                break;
            default:
                t = "";
        }

        return t;
    },

    /* processTransports(data)
     * Uses the received data to set the various values.
     */
    processTransports: function(data) {

        this.transports = [];

        this.lineInfo = this.getSanitizedName(data.response.informations.type) + " " + data.response.informations.line + " (vers " + data.response.informations.destination.name + ")";
        for (var i = 0, count = data.response.schedules.length; i < count; i++) {

            var nextTransport = data.response.schedules[i];

            this.transports.push({
                name: nextTransport.destination,
                time: nextTransport.message
            });
        }
        this.loaded = true;
        this.sendSocketNotification("TRANSPORTS", {
            transports: this.transports,
            lineInfo: this.lineInfo
        });
    },


    /* scheduleUpdate()
     * Schedule next update.
     * argument delay number - Millis econds before next update. If empty, this.config.updateInterval is used.
     */
    scheduleUpdate: function(delay) {
        var nextLoad = this.config.updateInterval;

        if (typeof delay !== "undefined" && delay > 0) {
            nextLoad = delay;
        }

        var self = this;
        clearTimeout(this.updateTimer);
        this.updateTimer = setInterval(function() {
            self.updateTimetable();
        }, nextLoad);
    },

    socketNotificationReceived: function(notification, payload) {
        if (payload.debugging) {
            console.log("Notif received: " + notification);
            console.log(payload);
        }

        const self = this;
        if (notification === 'CONFIG' && this.started == false) {
            this.config = payload;
            this.started = true;
            self.scheduleUpdate(this.config.initialLoadDelay);
        }
    }
});