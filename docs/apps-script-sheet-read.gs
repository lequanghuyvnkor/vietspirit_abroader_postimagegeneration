/**
 * Social Creative Studio <- Google Sheet (the content plan).
 *
 * Setup: open the content plan Sheet, Extensions > Apps Script, paste this file, set TOKEN below to a long secret
 * of your own, Save. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone) and copy the /exec URL.
 * Paste the URL and the same token into the app. The token is what keeps the plan private: without it the URL answers "forbidden".
 *
 * It only reads. Edit the plan in the Sheet; the app pulls it (on a button, or by itself when the Sheet changes).
 * Every tab is returned (01_Strategy, 02_Calendar, 03_Captions, 04_Visual_Brief, 05_Sources...).
 */
var TOKEN = 'đổi-chuỗi-này-thành-mã-bí-mật-của-bạn'

function doGet(e) {
  try {
    if (!e || !e.parameter || e.parameter.token !== TOKEN || TOKEN.indexOf('đổi-chuỗi') === 0) return json({ error: 'forbidden' })
    var book = SpreadsheetApp.getActiveSpreadsheet()
    var zone = book.getSpreadsheetTimeZone()
    var sheets = {}
    book.getSheets().forEach(function (sheet) {
      var range = sheet.getDataRange()
      sheets[sheet.getName()] = range.getValues().map(function (row) {
        return row.map(function (cell) {
          if (cell instanceof Date) return Utilities.formatDate(cell, zone, 'yyyy-MM-dd')
          return cell === null || cell === undefined ? '' : String(cell)
        })
      })
    })
    var body = JSON.stringify(sheets)
    // A short fingerprint, so the app can ask "did anything change?" without downloading the plan every time.
    var hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, body)).slice(0, 16)
    if (e.parameter.check) return json({ ok: true, hash: hash })
    return ContentService.createTextOutput('{"ok":true,"hash":"' + hash + '","title":' + JSON.stringify(book.getName()) + ',"sheets":' + body + '}').setMimeType(ContentService.MimeType.JSON)
  } catch (error) {
    return json({ error: String(error) })
  }
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}
