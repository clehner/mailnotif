#!/usr/bin/env node

/*
 * This file is part of mailnotif
 *
 * mailnotif is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * mailnotif is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with mailnotif.  If not, see <http://www.gnu.org/licenses/>.
 */

var fs = require('fs')
var spawn = require('child_process').spawn
var inbox = require('inbox')
var notifications = require('freedesktop-notifications')

var mailclient
var isOnline = false

try {
  var config = require('./config')
} catch(e) {
  console.log(e.stack || e)
  console.log('Please copy config.example.js to config.js' +
    'and edit as needed.')
  process.exit(1)
}

process.on('uncaughtException', function (err) {
  console.error(err.stack, err)
})

function escapeHTML (text) {
  return text.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
}

// Fetch a message and open it in a MUA
var actions = {
  open: function (msg) {
    var uid = msg.UID
    var filename = '/tmp/mail-' + uid + '-' + msg.modSeq + '.eml'
    mailclient.createMessageStream(uid)
    .on('end', function () {
      var args = config.mailer.args.concat(filename)
      var open = spawn(config.mailer.cmd, args, {stdio: 'inherit'})
      open.on('close', function (code) {
        if (code) return console.error('Mailer returned', code)
        mailclient.addFlags(uid, '\\Seen', function (err) {
          if (err) console.error('Error marking message as seen', err)
        })
      })
    })
    .pipe(fs.createWriteStream(filename))
  },
  read: function (msg) {
    mailclient.addFlags(msg.UID, '\\Seen', function (err) {
      if (err) console.error('Error marking message as seen', err)
    })
  }
}

var id = Math.random().toString(36).substr(2)
function handleMail (message) {
  var from = message.from ?
    message.from.name + ' <' + message.from.address + '>' : ''
  console.log('[' + message.date.toLocaleTimeString() + ']',
    'Handling message from', from)
  var body = '<span color="#D6A046">' + escapeHTML(from) + '</span>\n\n' +
    escapeHTML(message.title)
  var notif = notifications.createNotification({
    appName: 'mail',
    summary: 'New mail',
    body: body,
    actions: {
      open: 'Open',
      read: 'Mark as read'
    }
  })
  notif.on('action', function (action) {
    actions[action](message)
    notif.close()
  })
  notif.push()
}

function isMailRecent (message) {
  return message.flags.indexOf('\\Recent') > -1
}

function onMailClientConnect () {
  console.log('Successfully connected to server')
  mailclient.openMailbox('INBOX', {readOnly: false}, function (err, info) {
    if (err) return console.error(err)
    console.log('Opened ' + info.path + ':', info.count)
    mailclient.listMessages(-25, function (err, messages) {
      if (err) return console.error(err)
      messages.filter(isMailRecent).forEach(handleMail)
    })
  })
}

function onMailClientError (err) {
  if (err.code === 'EHOSTUNREACH') {
    console.error('Host unreachable')
  } else if (err.code === 'ETIMEDOUT' || err.errorType === 'TimeoutError') {
    console.log('Connection timed out. Reconnecting.')
    mailclient.connect()
  } else {
    console.error(err.stack, err)
  }
}

function onMailClientDisconnect (err) {
  console.log('Disconnected from server')
}

function connectMail() {
  console.log('Connecting to', config.imap.host)
  mailclient = inbox.createConnection(config.imap.port,
    config.imap.host, config.imap.options)
  mailclient.on('connect', onMailClientConnect)
  mailclient.on('error', onMailClientError)
  mailclient.on('disconnect', onMailClientDisconnect)
  mailclient.on('new', handleMail)
  mailclient.connect()
}

function onlineStateChanged(online) {
  if (online == isOnline) return;
  isOnline = online;
  if (isOnline) {
    setTimeout(connectMail, 250)
  } else {
    console.log('Disconnected')
    if (mailclient) mailclient._close()
  }
}

if (config.networkManager) {
  var nmState = require('nm-state')
  nmState(function (state) {
    if (state === nmState.CONNECTED_GLOBAL) {
      onlineStateChanged(true)
    } else if (state <= nmState.CONNECTING) {
      onlineStateChanged(false)
    }
  })
}

if (config.wpaSupplicant) {
  var WpaState = require('wpa_state')
  var iface = config.wpaSupplicant
  new WpaState(iface).on('state', function (state) {
    onlineStateChanged(state === 'completed')
  })
}

if (config.connman) {
  var ConnMan = require('connman-api')
  var connman = new ConnMan()
  connman.init(function() {
    function stateChanged(state) {
      onlineStateChanged(state === 'online')
    }
    connman.getProperties(function (err, props) {
      if (err) return console.error(err)
        stateChanged(props.State)
    });
    connman.on('PropertyChanged', function (name, value) {
      if (name === 'State')
        stateChanged(value)
    })
  })
}

if (!config.networkManager && !config.wpaSupplicant && !config.connman) {
  // no network service. connect immediately
  connectMail()
}
