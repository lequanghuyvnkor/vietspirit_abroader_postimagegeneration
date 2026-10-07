/**
 * Social Creative Studio -> Google Docs (one tab per piece).
 *
 * Setup: in the doc, Extensions > Apps Script, paste this file, then in the left rail
 * Services (+) > "Google Docs API" > Add. Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy
 * (first deploy: Execute as "Me", access "Anyone"). The web app URL ends in /exec.
 *
 * Each card becomes a tab named by the piece code. Re-syncing replaces the content of the tab with that name
 * and leaves every other tab alone.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)
    var existing = tabsByTitle(data.doc)
    var missing = data.cards.filter(function (card) { return !existing[card.tab] })

    if (missing.length) {
      var added = Docs.Documents.batchUpdate({
        requests: missing.map(function (card) { return { addDocumentTab: { tabProperties: { title: card.tab } } } })
      }, data.doc)
      added.replies.forEach(function (reply, i) {
        existing[missing[i].tab] = { id: reply.addDocumentTab.tabProperties.tabId, end: 1 }
      })
    }

    var requests = []
    data.cards.forEach(function (card) { requests = requests.concat(renderRequests(existing[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: requests }, data.doc)
    return json({ ok: true, created: missing.length, updated: data.cards.length - missing.length })
  } catch (error) {
    return json({ error: String(error) })
  }
}

/** { title: { id, end } } for every tab (child tabs included); end = index where the body ends. */
function tabsByTitle(docId) {
  var doc = Docs.Documents.get(docId, { includeTabsContent: true })
  var out = {}
  ;(function walk(tabs) {
    tabs.forEach(function (tab) {
      var content = tab.documentTab.body.content
      out[tab.tabProperties.title] = { id: tab.tabProperties.tabId, end: content[content.length - 1].endIndex }
      if (tab.childTabs) walk(tab.childTabs)
    })
  })(doc.tabs)
  return out
}

function renderRequests(tab, card) {
  var requests = []
  // The last newline of a tab body can't be deleted, so clear 1 .. end-1.
  if (tab.end > 2) requests.push({ deleteContentRange: { range: { tabId: tab.id, startIndex: 1, endIndex: tab.end - 1 } } })

  var text = card.title + '\n\n'
  var bold = []
  card.rows.forEach(function (row) {
    bold.push([text.length, text.length + row[0].length])
    text += row[0] + '\n' + row[1] + '\n\n'
  })
  requests.push({ insertText: { location: { tabId: tab.id, index: 1 }, text: text } })
  requests.push({ updateParagraphStyle: { range: { tabId: tab.id, startIndex: 1, endIndex: 1 + card.title.length + 1 }, paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType' } })
  bold.forEach(function (span) {
    requests.push({ updateTextStyle: { range: { tabId: tab.id, startIndex: 1 + span[0], endIndex: 1 + span[1] }, textStyle: { bold: true }, fields: 'bold' } })
  })
  return requests
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}
