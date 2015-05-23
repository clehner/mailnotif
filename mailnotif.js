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
var libnotify = require('libnotify')
var nmState = require('nm-state')

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

function handleMail (message) {
  var from = message.from ?
    message.from.name + ' <' + message.from.address + '>' : ''
  console.log('[' + message.date.toLocaleTimeString() + ']',
    'Handling message from', from)
  var body = '<span color="#D6A046">' + escapeHTML(from) + '</span>\n\n' +
    escapeHTML(message.title)
  libnotify.notify(body, {
    title: 'New mail',
    time: 86400
  })
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
  console.error('error', err)
})

var mailclient

nmState(function (state) {
  if (state === nmState.CONNECTED_GLOBAL) {
    setTimeout(function () {
      console.log('Connecting to', config.imap.host)
      mailclient = inbox.createConnection(config.imap.port,
        config.imap.host, config.imap.options)
      initMailClient(mailclient)
      mailclient.connect()
    }, 250)
  } else if (state <= nmState.CONNECTING) {
    console.log('Disconnected')
    if (mailclient) mailclient._close()
  }
})

/*
process.stdin.on('data', function () {})
process.stdin.on('end', function () {
  console.log('Closing connection')
  mailclient.close()
  mailclient.on('close', function () {
    console.log('Disconnected.')
  })
})
*/
