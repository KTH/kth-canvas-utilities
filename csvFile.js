const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))
const log = require('./server/init/logging')

function escapeCsvData (str) {
  str = '' + str

  if (str.includes('"')) {
    log.warn('oh no! bad data!', str)
  }

  if (str.includes(',')) {
    log.info('escaping ', str)
    str = `"${str}"`
  }

  return str
}

function writeLine (strArr, fileName) {
  const line = createLine(strArr)
  return fs.appendFileAsync(fileName, line)
}

function createLine (strArr) {
  return strArr.map(escapeCsvData).join(',') + '\n'
}

module.exports = {
  escapeCsvData, writeLine, createLine
}
