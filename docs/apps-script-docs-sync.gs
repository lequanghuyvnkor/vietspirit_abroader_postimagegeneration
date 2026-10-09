/**
 * Social Creative Studio -> Google Docs (one tab per piece: a two-column info table, then the images / reel scenes).
 *
 * Setup: in the doc, Extensions > Apps Script, paste this file, then in the left rail
 * Services (+) > "Google Docs API" (identifier Docs) > Add. Deploy > Manage deployments > edit (pencil)
 * > Version: New version > Deploy. The web app URL ends in /exec.
 *
 * The app sends one piece at a time. Each piece becomes a tab named by its code; re-syncing replaces that tab by a
 * fresh one in the same place (no character positions to compute) and leaves every other tab alone.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents)
    var existing = tabsByTitle(data.doc)
    var updated = 0

    // Pass 1: a fresh, empty tab per card. An existing tab with that name is removed and recreated at its old position.
    var requests = []
    var addedFor = {}
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
    var replies = Docs.Documents.batchUpdate({ requests: requests }, data.doc).replies || []
    var ids = {}
    replies.forEach(function (reply, i) {
      if (addedFor[i] !== undefined && reply.addDocumentTab) ids[addedFor[i]] = reply.addDocumentTab.tabProperties.tabId
    })

    // Pass 2: the title and an empty table in each fresh tab.
    var layout = []
    data.cards.forEach(function (card) { layout = layout.concat(layoutRequests(ids[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: layout }, data.doc)

    // Pass 3: the table's real cell positions are only known now, so read them back and fill the cells.
    var fill = []
    var tables = tablesByTitle(data.doc)
    data.cards.forEach(function (card) { fill = fill.concat(fillRequests(ids[card.tab], tables[card.tab], card)) })
    Docs.Documents.batchUpdate({ requests: fill }, data.doc)

    // Pass 4: images / reel scenes. This part uses the DocumentApp service, which can take image bytes directly.
    var warnings = []
    data.cards.forEach(function (card) {
      try { addImages(data.doc, ids[card.tab], card) } catch (error) { warnings.push(card.tab + ': ' + String(error)) }
    })
    return json({ ok: true, created: data.cards.length - updated, updated: updated, warnings: warnings })
  } catch (error) {
    return json({ error: String(error) })
  }
}

/** { title: { id, index, parent } } for every tab, child tabs included. */
function tabsByTitle(docId) {
  // includeTabsContent is what makes the response list the tabs at all.
  var doc = Docs.Documents.get(docId, { includeTabsContent: true })
  var out = {}
  ;(function walk(tabs) {
    ;(tabs || []).forEach(function (tab) {
      var props = tab.tabProperties
      out[props.title] = { id: props.tabId, index: props.index, parent: props.parentTabId }
      if (tab.childTabs) walk(tab.childTabs)
    })
  })(doc.tabs)
  return out
}

function layoutRequests(tabId, card) {
  var requests = []
  requests.push({ insertText: { location: { tabId: tabId, index: 1 }, text: card.title + '\n' } })
  requests.push({ updateParagraphStyle: { range: { tabId: tabId, startIndex: 1, endIndex: 2 + card.title.length }, paragraphStyle: { namedStyleType: 'HEADING_1' }, fields: 'namedStyleType' } })
  requests.push({ insertTable: { location: { tabId: tabId, index: 2 + card.title.length }, rows: card.rows.length, columns: 2 } })
  return requests
}

/** { title: table element } for the first table of every tab. */
function tablesByTitle(docId) {
  var doc = Docs.Documents.get(docId, { includeTabsContent: true })
  var out = {}
  ;(function walk(tabs) {
    ;(tabs || []).forEach(function (tab) {
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

/** A heading and a 3-column grid of images (each with its caption) after the info table. */
function addImages(docId, tabId, card) {
  if (!card.images || !card.images.length) return
  var doc = DocumentApp.openById(docId)
  var tab = doc.getTab(tabId)
  if (!tab) throw new Error('không tìm thấy tab ' + tabId)
  var body = tab.asDocumentTab().getBody()
  body.appendParagraph(card.imagesTitle || 'Hình ảnh').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  var cols = 3
  var matrix = []
  for (var r = 0; r < Math.ceil(card.images.length / cols); r++) matrix.push(['', '', ''].slice(0, cols))
  var table = body.appendTable(matrix)
  var width = 135
  card.images.forEach(function (image, i) {
    var cell = table.getCell(Math.floor(i / cols), i % cols)
    var blob = Utilities.newBlob(Utilities.base64Decode(image.data), 'image/jpeg', image.name + '.jpg')
    var picture = cell.getChild(0).asParagraph().appendInlineImage(blob)
    picture.setWidth(width).setHeight(Math.round(width * image.h / image.w))
    if (image.caption) cell.appendParagraph(image.caption).editAsText().setFontSize(8)
  })
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}
