const departmentCodeMapping = require('./departmentCodeMapping')
const moment = require('moment')
const Promise = require('bluebird')
const parseStringP = Promise.promisify(require('xml2js').parseString)
const rp = require('request-promise')
let canvasApi

let subAccounts

function _courseTerm (courseRoundObj) {
  const startTerm = courseRoundObj.courseRound.$.startTerm
  const startTermCanonical = startTerm[4] === '1' ? 'VT' : 'HT'
  return `${startTermCanonical}${startTerm.substring(2, 4)}`
}

function _createTitle (courseObj, courseRoundObj, xmlLang) {
  const courseTitle = courseObj.course.title.find(title => title.$['xml:lang'] === xmlLang)._
  const term = _courseTerm(courseRoundObj)
  return `${courseTitle} ${term}`
}

function _wrapWithCourseRound (courseObj, courseRoundObj) {
  let xmlLang = 'en'
  if (courseRoundObj.courseRound.tutoringLanguage.find(round => round.$['xml:lang'] === 'sv')._ === 'Svenska') {
    xmlLang = 'sv'
  }

  let name = _createTitle(courseObj, courseRoundObj, xmlLang)

  const course_code = courseObj.course.$.code

  let sis_course_id = `${course_code}${_courseTerm(courseRoundObj)}${courseRoundObj.courseRound.$.roundId}`

  const [year, weekNumber] = courseRoundObj.courseRound.$.startWeek.split('-')
  const start_at = moment().year(year).isoWeek(weekNumber).isoWeekday(1).toISOString()

  const course = {name, course_code, sis_course_id, start_at}
  return {course}
}

function getCourseFromKopps (courseCode) {
  const url = `http://www.kth.se/api/kopps/v1/course/${courseCode}`
  console.log('get course from kopps', url)
  return rp({
    url,
    method: 'GET'
  })
}

function getCourseRoundFromKopps (courseCode, startTerm, round) {
  const url = `http://www.kth.se/api/kopps/v1/course/${courseCode}/round/${startTerm}/${round}`
  console.log('get course round from kopps', url)

  return rp({
    url,
    method: 'GET'
  })
}

function getCourseAndCourseRoundFromKopps ({courseCode, startTerm, round}) {
  let course, courseRound, canvasCourse
  console.log('courseCode, startTerm, round}', courseCode, startTerm, round)
  return getCourseFromKopps(courseCode)
    .then(parseStringP)
    .then(_course => course = _course)
    .then(() => getCourseRoundFromKopps(courseCode, startTerm, round))
    .then(parseStringP)
    .then(courseRound => {
      return {
        courseRound, course}
    })
}

function createCanvasCourseObject ({course, courseRound}) {
  if (!canvasApi) {
    console.error('No canvas api set. Call init() first')
    return
  }

  const wrappedCourseObj = _wrapWithCourseRound(course, courseRound)
  const departmentCode = course.course.departmentCode[0]._
  const firstChar = departmentCode[0]
  const mappedDepartmentCode = departmentCodeMapping[firstChar]

  return subAccounts
  .then(subAccounts => subAccounts.find(subAccount => subAccount.name === mappedDepartmentCode))
  .then(subAccount => canvasApi.listSubaccounts(subAccount.id))
  .then(subAccounts => subAccounts.find(subAccount => subAccount.name === 'Imported course rounds'))
  .then(subAccount => ({course: wrappedCourseObj, subAccountId:subAccount.id, subAccount}))
}

function init (canvasApiUrl, canvasapiKey) {
  canvasApi = require('canvas-api')(canvasApiUrl, canvasapiKey)
  subAccounts = canvasApi.getRootAccount()
    .then(canvasApi.listSubaccounts)
}

module.exports = {
  getCourseAndCourseRoundFromKopps,
  init,
  createCanvasCourseObject}
