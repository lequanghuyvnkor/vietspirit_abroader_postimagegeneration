/**
 * Social Creative Studio -> Google Docs (one tab per piece, each with a two-column table).
 *
 * Setup: in the doc, Extensions > Apps Script, paste this file, then in the left rail
 * Services (+) > "Google Docs API" (identifier Docs) > Add. Deploy > Manage deployments > edit (pencil)
 * > Version: New version > Deploy. The web app URL ends in /exec.
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

    // Pass 1: clear each tab, write the title and an empty table.
    var layout = []
    data.cards.forEach(function (card) { layout = layout.concat(layoutRequests(existing[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: layout }, data.doc)

    // Pass 2: the table's real cell positions are only known now, so read them back and fill the cells.
    var fill = []
    var tables = tablesByTitle(data.doc)
    data.cards.forEach(function (card) { fill = fill.concat(fillRequests(existing[card.tab].id, tables[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: fill }, data.doc)
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

function layoutRequests(tab, card) {
  var requests = []
  // The last newline of a tab body can't be deleted, so clear 1 .. end-1.
  if (tab.end > 2) requests.push({ deleteContentRange: { range: { tabId: tab.id, startIndex: 1, endIndex: tab.end - 1 } } })
  requests.push({ insertText: { location: { tabId: tab.id, index: 1 }, text: card.title + '\n' } })
  requests.push({ updateParagraphStyle: { range: { tabId: tab.id, startIndex: 1, endIndex: 2 + card.title.length }, paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType' } })
  requests.push({ insertTable: { location: { tabId: tab.id, index: 2 + card.title.length }, rows: card.rows.length, columns: 2 } })
  return requests
}

/** { title: table element } for the first table of every tab. */
function tablesByTitle(docId) {
  var doc = Docs.Documents.get(docId, { includeTabsContent: true })
  var out = {}
  ;(function walk(tabs) {
    tabs.forEach(function (tab) {
      var table = tab.documentTab.body.content.filter(function (element) { return element.table })[0]
      if (table) out[tab.tabProperties.title] = table
      if (tab.childTabs) walk(tab.childTabs)
    })
  })(doc.tabs)
  return out
}

function fillRequests(tabId, table, card) {
  var start = { tabId: tabId, index: table.startIndex }
  var requests = [
    { updateTableColumnProperties: { tableStartLocation: start, columnIndices: [0], tableColumnProperties: { widthType: 'FIXED_WIDTH', width: { magnitude: 120, unit: 'PT' } }, fields: 'widthType,width' } },
    { updateTableCellStyle: { tableRange: { tableCellLocation: { tableStartLocation: start, rowIndex: 0, columnIndex: 0 }, rowSpan: card.rows.length, columnSpan: 1 }, tableCellStyle: { backgroundColor: { color: { rgbColor: { red: 0.945, green: 0.953, blue: 0.957 } } } }, fields: 'backgroundColor' } }
  ]
  // Fill from the last cell backwards so earlier positions don't shift.
  for (var r = card.rows.length - 1; r >= 0; r--) {
    for (var c = 1; c >= 0; c--) {
      var text = card.rows[r][c]
      var at = table.table.tableRows[r].tableCells[c].content[0].startIndex
      requests.push({ insertText: { location: { tabId: tabId, index: at }, text: text } })
      if (c === 0) requests.push({ updateTextStyle: { range: { tabId: tabId, startIndex: at, endIndex: at + text.length }, textStyle: { bold: true }, fields: 'bold' } })
    }
  }
  return requests
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}
