exports.network = {
  // Uncomment one of these to enable auto-connecting
  // networkManager: true,
  // wpaSupplicant: 'wlan0',
  // connman: true
};

exports.imap = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  options: {
    secureConnection: true,
    auth: {
      user: 'example@gmail.com',
      pass: 'example'
    }
  },
  mailer: 'sylpheed',
  mailerArgs: ['--open']
}
