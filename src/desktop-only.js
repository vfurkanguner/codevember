const fatal = require('./fatal-error')()

module.exports = error
function error (err) {
  if (err) console.error(err)
  return fatal(`
    <div>Only supported on Desktop Chrome & FireFox.</div>
  `)
}