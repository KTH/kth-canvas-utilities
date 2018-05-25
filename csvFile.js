const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs'))

function escapeCsvData (str) {
  str = '' + str

  str = `"${str}"`

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
