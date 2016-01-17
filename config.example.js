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
