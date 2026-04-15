import * as XLSX from 'xlsx'
import './style.css'

// Virtual scroll: row height must match CSS (td height 40px + 1px border = 41px)
const ROW_HEIGHT = 41
const OVERSCAN = 8

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <div class="container">
    <header>
      <h1>CSV Viewer</h1>
      <p>Upload a <code>.csv</code> file to visualize it as a table</p>
    </header>

    <div class="upload-zone" id="upload-zone">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
      <p>Drag &amp; drop a CSV file here, or <label for="file-input" class="browse-label">browse</label></p>
      <input type="file" id="file-input" accept=".csv" />
    </div>

    <div id="output" class="output hidden"></div>
  </div>
`

const uploadZone = document.getElementById('upload-zone')!
const fileInput = document.getElementById('file-input') as HTMLInputElement
const output = document.getElementById('output')!

let allRows: unknown[][] = []
let headers: string[] = []
let colWidths: number[] = []
let rafId = 0

function processFile(file: File) {
  if (!file.name.endsWith('.csv')) {
    showError('Please upload a valid .csv file.')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const buffer = e.target?.result as ArrayBuffer
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

    if (rows.length === 0) {
      showError('The CSV file appears to be empty.')
      return
    }

    renderTable(file.name, rows)
  }
  reader.readAsArrayBuffer(file)
}

function renderTable(filename: string, rows: unknown[][]) {
  headers = rows[0] as string[]
  allRows = rows.slice(1)

  // Default column width of 150
  colWidths = new Array(headers.length).fill(150)

  /* Create the <colgroup>
   * Each column is its own group
   * Allows each column to adjust its own width
  */
  const colgroup = headers
    .map((_, i) => `<col id="col-${i}" style="width:${colWidths[i]}px">`)
    .join('')

  /* Create table headers
   * Header names in <span> elements
   * Add <div> elements for resizing
  */
  const ths = headers
    .map((h, i) => `
      <th>
        <span class="th-text">${escapeHtml(String(h ?? ''))}</span>
        <div class="resizer" data-col="${i}"></div>
      </th>`)
    .join('')

  // Load table (headers) in "output" <div>
  output.innerHTML = `
    <div class="table-meta">
      <span class="filename">${escapeHtml(filename)}</span>
      <span class="stats">${allRows.length} rows &times; ${headers.length} columns</span>
    </div>
    <div class="table-scroll" id="table-scroll">
      <table id="data-table">
        <colgroup>${colgroup}</colgroup>
        <thead><tr>${ths}</tr></thead>
        <tbody id="tbody">
          <tr id="top-spacer"><td colspan="${headers.length}"></td></tr>
          <tr id="bottom-spacer"><td colspan="${headers.length}"></td></tr>
        </tbody>
      </table>
    </div>
  `

  updateTableWidth()
  output.classList.remove('hidden')

  document
    .getElementById('table-scroll')!
    .addEventListener('scroll', scheduleUpdate, { passive: true })

  setupColumnResize()
  updateVisibleRows()
}

function scheduleUpdate() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(updateVisibleRows)
}

function updateVisibleRows() {
  const tableScroll = document.getElementById('table-scroll')
  const tbody = document.getElementById('tbody')
  const topSpacer = document.getElementById('top-spacer')
  const bottomSpacer = document.getElementById('bottom-spacer')
  if (!tableScroll || !tbody || !topSpacer || !bottomSpacer) return

  // Figure out which rows should be visible
  const scrollTop = tableScroll.scrollTop
  const containerHeight = tableScroll.clientHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT)
  const endIndex = Math.min(allRows.length, startIndex + visibleCount + OVERSCAN * 2)

  // Resize spacers (empty <tr> elements for taking up vertical space)
  const topTd = topSpacer.querySelector('td') as HTMLTableCellElement
  const bottomTd = bottomSpacer.querySelector('td') as HTMLTableCellElement
  topTd.style.height = startIndex > 0 ? `${startIndex * ROW_HEIGHT}px` : ''
  bottomTd.style.height = endIndex < allRows.length
    ? `${(allRows.length - endIndex) * ROW_HEIGHT}px`
    : ''

  // Swap in new rows in table (store in document fragment)
  tbody.querySelectorAll('tr.data-row').forEach(r => r.remove())  // Remove all currently rendered rows
  const fragment = document.createDocumentFragment()
  for (let i = startIndex; i < endIndex; i++) {                   // Create each new rendered row
    const tr = document.createElement('tr')
    tr.className = i % 2 === 0 ? 'data-row' : 'data-row even'
    const row = allRows[i] as unknown[]
    for (let j = 0; j < headers.length; j++) {                    // Add data for each column to row
      const td = document.createElement('td')
      td.textContent = String(row[j] ?? '')
      tr.appendChild(td)
    }
    fragment.appendChild(tr)
  }
  topSpacer.after(fragment)
}

function setupColumnResize() {
  const table = document.getElementById('data-table')!

  // Listen to any 'mousedown' event inside the table
  table.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('resizer')) return

    const colIndex = parseInt(target.getAttribute('data-col') ?? '0')
    const startX = e.clientX
    const startWidth = colWidths[colIndex]

    document.body.classList.add('col-resizing')

    const onMove = (ev: MouseEvent) => {
      colWidths[colIndex] = Math.max(60, startWidth + (ev.clientX - startX))
      const col = document.getElementById(`col-${colIndex}`) as HTMLElement
      if (col) col.style.width = `${colWidths[colIndex]}px`
      updateTableWidth()
    }

    const onUp = () => {
      document.body.classList.remove('col-resizing')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    /* Event listeners for 'mousedown' and 'mouseup' on document
     * Cursor is allowed to leave table while resizing
    */
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  })
}

// Keep table width equal to sum of column widths so horizontal scroll works correctly
function updateTableWidth() {
  const table = document.getElementById('data-table') as HTMLElement
  if (!table) return
  const total = colWidths.reduce((sum, w) => sum + w, 0)
  table.style.width = `${total}px`
}

function showError(msg: string) {
  output.innerHTML = `<div class="error">${escapeHtml(msg)}</div>`
  output.classList.remove('hidden')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) processFile(file)
})

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadZone.classList.add('drag-over')
})

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over')
})

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadZone.classList.remove('drag-over')
  const file = e.dataTransfer?.files[0]
  if (file) processFile(file)
})
