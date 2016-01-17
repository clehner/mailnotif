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

var inbox = require('inbox')
var nmState = require('nm-state')
var WpaState = require('wpa_state')
var ConnMan = require('connman-api')
var pkg = require('./package')
var gir = require('gir')
var Gio = gir.load('Gio')
var GLib = gir.load('GLib')

// var loop = new GLib.MainLoop(null, false)

var app = new Gio.Application(pkg.name)
app.on('activate', function() {
  console.log('app activated')
  handleMail(require("./msg"))
})
/*
app.on('startup', function() {
  console.log('startup')
})
*/
app.register()

var openAction = new Gio.SimpleAction({
  name: 'open',
  'parameter-type': new GLib.VariantType('s')
})
openAction.on('activate', function() {
  console.log('activate open');
})
app.add_action(openAction)
// openAction.activate(new GLib.Variant('s', 'hi'))
//

var markReadAction = new Gio.SimpleAction({
  name: 'markread'
})
markReadAction.on('activate', function() {
  console.log('activate markread');
})
app.add_action(markReadAction)

console.log('hold')
app.hold()
console.log('run')
app.run(null)
console.log('done')

/*
var actionEntries = [
  {
    activate: null,
    change_state: null,
    name: 'open',
    padding: [0],
    parameter_type: 's',
    state: null
  }
]
// app.add_action_entries(actionEntries, actionEntries.length, null)
*/

try {
  var config = require('./config')
} catch(e) {
  console.log(e.stack || e)
  console.log('Please copy config.example.js to config.js' +
    'and edit as needed.')
  process.exit(1)
}

function escapeHTML (text) {
  return text.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
}

var id = Math.random().toString(36).substr(2)
function handleMail (message) {
  var from = message.from ?
    message.from.name + ' <' + message.from.address + '>' : ''
  console.log('[' + message.date.toLocaleTimeString() + ']',
    'Handling message from', from)
  var body = '<span color="#D6A046">' + escapeHTML(from) + '</span>\n\n' +
    escapeHTML(message.title)
  var n = new Gio.Notification('')
  n.set_title('New mail')
  n.set_body(body)
  n.add_button("Open", "app.open::" + message.UID)
  n.add_button("Mark as read", "app.markread")
  // n.add_button("Quit", "app.shutdown")
  app.send_notification(id, n)
  // loop.run()
}

if (process.argv[2] == 'test') {
  setTimeout(function () {
  }, 10);

  /*
  process.on('SIGINT', function () {
      console.log('withdraw', id)
    app.withdraw_notification(id)
    setTimeout(function () {
      process.exit()
    }, 500)
  });
  */
}

function isMailRecent (message) {
  return message.flags.indexOf('\\Recent') > -1
}

function onMailClientConnect () {
  console.log('Successfully connected to server')
  mailclient.openMailbox('INBOX', {readOnly: true}, function (err, info) {
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

function initMailClient (client) {
  client.on('connect', onMailClientConnect)
  client.on('error', onMailClientError)
  client.on('disconnect', function () {
    console.log('Disconnected from server')
  })
  client.on('new', handleMail)
}

process.on('uncaughtException', function (err) {
  console.error(err.stack, err)
})

var mailclient
var isOnline = false

function connectMail() {
  console.log('Connecting to', config.imap.host)
  mailclient = inbox.createConnection(config.imap.port,
    config.imap.host, config.imap.options)
  initMailClient(mailclient)
  mailclient.connect()
}

function onlineStateChanged(online) {
  if (online == isOnline) return;
  isOnline = online;
  if (isOnline) {
    setTimeout(connectMail, 250)
  } else {
    onlineStateChanged(false)
    console.log('Disconnected')
    if (mailclient) mailclient._close()
  }
}

if (0) {
nmState(function (state) {
  if (state === nmState.CONNECTED_GLOBAL) {
    onlineStateChanged(true)
  } else if (state <= nmState.CONNECTING) {
    onlineStateChanged(false)
  }
})

new WpaState('wlan0').on('state', function (state) {
  onlineStateChanged(state === 'completed')
})

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
