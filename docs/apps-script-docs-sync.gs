/**
 * Social Creative Studio -> Google Docs.
 * Paste into the doc's Extensions > Apps Script, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Paste the web app URL into the app.
 *
 * Each card becomes its own tab, named by the piece code. Re-syncing replaces the content of
 * the tab with that name and leaves every other tab (and anything you wrote there) alone.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)
    var doc = DocumentApp.openById(data.doc)
    if (typeof doc.addTab !== 'function') throw new Error('Doc này chưa hỗ trợ tab trong Apps Script. Dùng nút "Sao chép cho Google Docs".')
    var existing = {}
    doc.getTabs().forEach(function (tab) { existing[tab.getTitle()] = tab })
    var created = 0, updated = 0
    data.cards.forEach(function (card) {
      var tab = existing[card.tab]
      if (tab) { updated++ } else { tab = doc.addTab(card.tab); existing[card.tab] = tab; created++ }
      render(tab.asDocumentTab().getBody(), card)
    })
    return json({ ok: true, created: created, updated: updated })
  } catch (error) {
    return json({ error: String(error) })
  }
}

function render(body, card) {
  body.clear()
  body.insertParagraph(0, card.title).setHeading(DocumentApp.ParagraphHeading.HEADING1)
  var table = body.appendTable(card.rows)
  for (var i = 0; i < table.getNumRows(); i++) {
    var label = table.getRow(i).getCell(0)
    label.setBackgroundColor('#f1f3f4').editAsText().setBold(true)
  }
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}
