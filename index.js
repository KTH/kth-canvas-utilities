const departmentCodeMapping = require('./departmentCodeMapping')
const config = require('./server/init/configuration')
const canvasApi = require('./canvasApi')(config.full.canvas.apiUrl, config.secure.canvas.apiKey)
const moment = require('moment')

const subAccounts = canvasApi.getRootAccount()
  .then(canvasApi.listSubaccounts)

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

module.exports = {
  createCanvasCourseObject({course, courseRound}) {
  const wrappedCourseObj = _wrapWithCourseRound(course, courseRound)
  const departmentCode = course.course.departmentCode[0]._
  const firstChar = departmentCode[0]
  const mappedDepartmentCode = departmentCodeMapping[firstChar]

  return subAccounts
    .then(subAccounts => subAccounts.find(subAccount => subAccount.name === mappedDepartmentCode))
    .then(subAccount => canvasApi.listSubaccounts(subAccount.id))
    .then(subAccounts => subAccounts.find(subAccount => subAccount.name === 'Imported course rounds'))
    .then(subAccount => subAccount.id)
    .then(subAccountId => ({course: wrappedCourseObj, subAccountId}))
}}
