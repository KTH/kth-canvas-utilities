const csvFile = require('./csvFile')
const terms = require('./terms')
const departmentCodeMapping = require('./departmentCodeMapping')
const moment = require('moment')
const Promise = require('bluebird')
const parseStringP = Promise.promisify(require('xml2js').parseString)
const rp = require('request-promise')
let canvasApi

function _courseTerm (courseRoundObj) {
  const startTerm = courseRoundObj.courseRound.$.startTerm
  const startTermCanonical = startTerm[4] === '1' ? 'VT' : 'HT'
  return `${startTermCanonical}${startTerm.substring(2, 4)}`
}

function _createTitle (courseObj, courseRoundObj, xmlLang) {
  const courseTitle = courseObj.course.title.find(title => title.$['xml:lang'] === xmlLang)._
  const term = _courseTerm(courseRoundObj)
  return `${term}-${courseRoundObj.courseRound.$.roundId} ${courseTitle}`
}

function _wrapWithCourseRound (courseObj, courseRoundObj) {
  let xmlLang = 'en'
  if (courseRoundObj.courseRound.tutoringLanguage.find(round => round.$['xml:lang'] === 'sv')._ === 'Svenska') {
    xmlLang = 'sv'
  }

  let name = _createTitle(courseObj, courseRoundObj, xmlLang)

  const courseCode = courseObj.course.$.code

  let sisCourseId = `${courseCode}${_courseTerm(courseRoundObj)}${courseRoundObj.courseRound.$.roundId}`

  const [year, weekNumber] = courseRoundObj.courseRound.$.startWeek.split('-')
  const startAt = moment().year(year).isoWeek(weekNumber).isoWeekday(1).toISOString()

  const course = {name, courseCode, sisCourseId, startAt}
  return {course}
}
function getCourseFromKopps (courseCode) {
  const url = `http://www.kth.se/api/kopps/v1/course/${courseCode}`
  // console.log('get course from kopps', url)
  return rp({
    url,
    method: 'GET'
  })
}

function getCourseRoundFromKopps (courseCode, startTerm, round) {
  const url = `http://www.kth.se/api/kopps/v1/course/${courseCode}/round/${startTerm}/${round}`
  // console.log('get course round from kopps', url)

  return rp({
    url,
    method: 'GET'
  })
}

function getCourseAndCourseRoundFromKopps ({courseCode, startTerm, round}) {
  let course
  return getCourseFromKopps(courseCode)
    .then(parseStringP)
    .then(_course => {
      course = _course
    })
    .then(() => getCourseRoundFromKopps(courseCode, startTerm, round))
    .then(parseStringP)
    .then(courseRound => {
      return {
        courseRound, course}
    })
}

function createCanvasCourseObject ({course, courseRound}) {
  const wrappedCourseObj = _wrapWithCourseRound(course, courseRound)
  const departmentCode = course.course.departmentCode[0]._
  const firstChar = departmentCode[0]
  const mappedDepartmentCode = departmentCodeMapping[firstChar]
  const shortName = courseRound.courseRound.shortName && courseRound.courseRound.shortName[0]._
  return canvasApi.getRootAccount()
    .then(canvasApi.listSubaccounts)
    .then(subAccounts => subAccounts.find(subAccount => subAccount.name === mappedDepartmentCode))
    .then(subAccount => canvasApi.listSubaccounts(subAccount.id))
    .then(subAccounts => subAccounts.find(subAccount => subAccount.name === 'Imported course rounds'))
    .then(subAccount => ({course: wrappedCourseObj, subAccountId: subAccount.id, subAccount, courseRound: courseRound.courseRound.$, shortName}))
}

function createSimpleCanvasCourseObject ({course, courseRound}) {
  const wrappedCourseObj = _wrapWithCourseRound(course, courseRound)
  const departmentCode = course.course.departmentCode[0]._
  const firstChar = departmentCode[0]
  const mappedDepartmentCode = departmentCodeMapping[firstChar]
  const shortName = courseRound.courseRound.shortName && courseRound.courseRound.shortName[0]._
  const sisAccountId = `${mappedDepartmentCode} - Imported course rounds`
  return {course: wrappedCourseObj, sisAccountId, courseRound: courseRound.courseRound.$, shortName}
}

function init (canvasApiUrl, canvasapiKey) {
  const CanvasApi = require('kth-canvas-api')
  canvasApi = new CanvasApi(canvasApiUrl, canvasapiKey)
}

module.exports = {
  getCourseAndCourseRoundFromKopps,
  init,
  createCanvasCourseObject,
  createSimpleCanvasCourseObject,
  csvFile,
  terms,
  departmentCodeMapping}
