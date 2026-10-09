/**
 * Social Creative Studio -> Google Docs (one tab per piece, each with a two-column table).
 *
 * Setup: in the doc, Extensions > Apps Script, paste this file, then in the left rail
 * Services (+) > "Google Docs API" (identifier Docs) > Add. Deploy > Manage deployments > edit (pencil)
 * > Version: New version > Deploy. The web app URL ends in /exec.
 *
 * Each card becomes a tab named by the piece code. Re-syncing replaces the tab with that name by a fresh one
 * in the same place (no character positions to compute) and leaves every other tab alone.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)
    var existing = tabsByTitle(data.doc)
    var updated = 0

    // Pass 1: a fresh, empty tab per card. An existing tab with that name is removed and recreated at its old position.
    var requests = []
    var addedFor = []
    data.cards.forEach(function (card) {
      var old = existing[card.tab]
      var props = { title: card.tab }
      if (old) {
        props.index = old.index
        if (old.parent) props.parentTabId = old.parent
      }
      // Add the fresh tab before removing the old one, so the doc never runs out of tabs.
      requests.push({ addDocumentTab: { tabProperties: props } })
      addedFor[requests.length - 1] = card.tab
      if (old) {
        updated++
        requests.push({ deleteTab: { tabId: old.id } })
      }
    })
    var replies = Docs.Documents.batchUpdate({ requests: requests }, data.doc).replies
    replies.forEach(function (reply, i) {
      if (addedFor[i]) existing[addedFor[i]] = { id: reply.addDocumentTab.tabProperties.tabId, end: 1 }
    })

    // Pass 2: write the title and an empty table in each fresh tab.
    var layout = []
    data.cards.forEach(function (card) { layout = layout.concat(layoutRequests(existing[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: layout }, data.doc)

    // Pass 3: the table's real cell positions are only known now, so read them back and fill the cells.
    var fill = []
    var tables = tablesByTitle(data.doc)
    data.cards.forEach(function (card) { fill = fill.concat(fillRequests(existing[card.tab].id, tables[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: fill }, data.doc)
    return json({ ok: true, created: data.cards.length - updated, updated: updated })
  } catch (error) {
    return json({ error: String(error) })
  }
}

/** { title: { id, index, parent } } for every tab, child tabs included. */
function tabsByTitle(docId) {
  var doc = Docs.Documents.get(docId)
  var out = {}
  ;(function walk(tabs) {
    tabs.forEach(function (tab) {
      var props = tab.tabProperties
      out[props.title] = { id: props.tabId, index: props.index, parent: props.parentTabId }
      if (tab.childTabs) walk(tab.childTabs)
    })
  })(doc.tabs)
  return out
}

function layoutRequests(tab, card) {
  var requests = []
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
