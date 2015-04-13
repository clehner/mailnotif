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

try {
  var config = require('./config')
} catch(e) {
  console.log(e.stack || e)
  console.log('Please copy config.example.js to config.js' +
    'and edit as needed.')
  process.exit(1)
}

var mailclient = inbox.createConnection(config.imap.port,
  config.imap.host, config.imap.options)

function escapeHTML (text) {
  return text.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
}

function handleMail (message) {
  var from = message.from.name + ' <' + message.from.address + '>'
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

mailclient.on('connect', function () {
  console.log('Successfully connected to server')
  mailclient.openMailbox('INBOX', {readOnly: true}, function (err, info) {
    if (err) return console.error(err)
    console.log('Opened ' + info.path + ':', info.count)
    mailclient.listMessages(-25, function (err, messages) {
      if (err) return console.error(err)
      messages.filter(isMailRecent).forEach(handleMail)
    })
  })
})

mailclient.on('disconnect', function () {
  console.log('Disconnected from server')
})

mailclient.on('error', function (err) {
  console.error(err.stack, err)
})

mailclient.on('new', function (message) {
  handleMail(message)
})

mailclient.connect()
console.log('Connecting to', config.imap.host)

process.stdin.on('data', function () {})
process.stdin.on('end', function () {
  console.log('Closing connection')
  mailclient.close()
  mailclient.on('close', function () {
    console.log('Disconnected.')
  })
})
