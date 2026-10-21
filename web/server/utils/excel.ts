import type { H3Event } from 'h3'
import ExcelJS from 'exceljs'

export interface SheetSpec {
  /** File name without extension. */
  filename: string
  title: string
  /** Label/value rows written at the top (e.g. ["Time:", now]). */
  meta: [string, string | number][]
  header: string[]
  rows: (string | number | null)[][]
}

/**
 * Sends an .xlsx styled like the legacy exports: meta rows, a blank row, a dark
 * header, alternating row fills, centered text and an outline border.
 */
export async function sendExcel(event: H3Event, spec: SheetSpec): Promise<Buffer> {
  const book = new ExcelJS.Workbook()
  book.creator = 'SharIF Judge'
  book.title = spec.title
  const sheet = book.addWorksheet('Sheet1')

  for (const row of spec.meta)
    sheet.addRow(row)
  sheet.addRow([])
  const headerRow = sheet.addRow(spec.header)
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173C45' } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  })

  const first = headerRow.number + 1
  spec.rows.forEach((values, i) => {
    const row = sheet.addRow(values)
    const n = first + i
    for (let c = 1; c <= spec.header.length; c++) {
      const cell = row.getCell(c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: n % 2 ? 'FFF0F0F0' : 'FFFAFAFA' } }
      cell.border = {
        top: n === first ? { style: 'thin', color: { argb: 'FF444444' } } : undefined,
        bottom: i === spec.rows.length - 1 ? { style: 'thin', color: { argb: 'FF444444' } } : undefined,
        left: c === 1 ? { style: 'thin', color: { argb: 'FF444444' } } : undefined,
        right: c === spec.header.length ? { style: 'thin', color: { argb: 'FF444444' } } : undefined,
      }
    }
  })

  sheet.eachRow(row => row.eachCell((cell) => {
    cell.alignment = { horizontal: 'center' }
  }))
  sheet.columns.forEach((column, i) => {
    if (i < 2)
      return
    let width = 10
    column.eachCell?.({ includeEmpty: false }, cell => (width = Math.max(width, String(cell.value ?? '').length + 2)))
    column.width = Math.min(width, 60)
  })

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${spec.filename}.xlsx"`,
    'Cache-Control': 'max-age=0',
  })
  return Buffer.from(await book.xlsx.writeBuffer())
}
