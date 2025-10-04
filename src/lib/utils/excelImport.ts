import * as XLSX from 'xlsx'

export interface ImportResult<T> {
  success: boolean
  data: T[]
  errors: string[]
  totalRows: number
  validRows: number
}

export interface ImportColumn {
  key: string
  required?: boolean
  type?: 'string' | 'number' | 'date' | 'email' | 'phone'
  validator?: (value: any) => boolean | string
  transformer?: (value: any) => any
}

export interface ImportOptions {
  skipFirstRow?: boolean
  maxRows?: number
  requiredColumns?: string[]
}

// Generic Excel import function
export async function importFromExcel<T>(
  file: File,
  columns: Record<string, ImportColumn>,
  options: ImportOptions = {}
): Promise<ImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convert sheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        if (jsonData.length === 0) {
          resolve({
            success: false,
            data: [],
            errors: ['File Excel vuoto'],
            totalRows: 0,
            validRows: 0
          })
          return
        }

        const headers = jsonData[0] as string[]
        const dataRows = options.skipFirstRow !== false 
          ? jsonData.slice(1) 
          : jsonData

        const result = processExcelData<T>(
          headers,
          dataRows as any[][],
          columns,
          options
        )

        resolve(result)
      } catch (error) {
        resolve({
          success: false,
          data: [],
          errors: [`Errore nella lettura del file: ${error}`],
          totalRows: 0,
          validRows: 0
        })
      }
    }

    reader.onerror = () => {
      resolve({
        success: false,
        data: [],
        errors: ['Errore nella lettura del file'],
        totalRows: 0,
        validRows: 0
      })
    }

    reader.readAsArrayBuffer(file)
  })
}

function processExcelData<T>(
  headers: string[],
  rows: any[][],
  columns: Record<string, ImportColumn>,
  options: ImportOptions
): ImportResult<T> {
  const errors: string[] = []
  const validData: T[] = []
  const columnMapping: Record<number, string> = {}

  // Map headers to column definitions
  headers.forEach((header, index) => {
    const normalizedHeader = header?.toString().toLowerCase().trim()
    for (const [key, column] of Object.entries(columns)) {
      if (normalizedHeader === key.toLowerCase() || 
          normalizedHeader === column.key?.toLowerCase()) {
        columnMapping[index] = key
        break
      }
    }
  })

  // Check for required columns
  const foundColumns = Object.values(columnMapping)
  const missingRequired = Object.entries(columns)
    .filter(([key, col]) => col.required && !foundColumns.includes(key))
    .map(([key]) => key)

  if (missingRequired.length > 0) {
    errors.push(`Colonne richieste mancanti: ${missingRequired.join(', ')}`)
  }

  // Process each row
  const maxRows = options.maxRows || rows.length
  const rowsToProcess = rows.slice(0, maxRows)

  rowsToProcess.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2 // +2 because Excel rows start at 1 and we skip header
    const rowData: any = {}
    const rowErrors: string[] = []

    // Process each cell in the row
    Object.entries(columnMapping).forEach(([colIndex, columnKey]) => {
      const column = columns[columnKey]
      const cellValue = row[parseInt(colIndex)]
      
      try {
        const processedValue = processCellValue(cellValue, column, rowNumber, columnKey)
        if (processedValue.error) {
          rowErrors.push(processedValue.error)
        } else {
          rowData[columnKey] = processedValue.value
        }
      } catch (error) {
        rowErrors.push(`Riga ${rowNumber}, colonna ${columnKey}: ${error}`)
      }
    })

    // Check for required fields
    Object.entries(columns).forEach(([key, column]) => {
      if (column.required && (rowData[key] === undefined || rowData[key] === null || rowData[key] === '')) {
        rowErrors.push(`Riga ${rowNumber}: campo richiesto '${key}' mancante`)
      }
    })

    if (rowErrors.length === 0) {
      validData.push(rowData as T)
    } else {
      errors.push(...rowErrors)
    }
  })

  return {
    success: errors.length === 0,
    data: validData,
    errors,
    totalRows: rowsToProcess.length,
    validRows: validData.length
  }
}

function processCellValue(
  value: any,
  column: ImportColumn,
  rowNumber: number,
  columnKey: string
): { value: any; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { value: null }
  }

  let processedValue = value

  // Apply transformer first
  if (column.transformer) {
    try {
      processedValue = column.transformer(processedValue)
    } catch (error) {
      return { value: null, error: `Riga ${rowNumber}, colonna ${columnKey}: errore trasformazione - ${error}` }
    }
  }

  // Type validation and conversion
  switch (column.type) {
    case 'string':
      processedValue = String(processedValue).trim()
      break
      
    case 'number':
      const num = Number(processedValue)
      if (isNaN(num)) {
        return { value: null, error: `Riga ${rowNumber}, colonna ${columnKey}: valore numerico non valido` }
      }
      processedValue = num
      break
      
    case 'date':
      const date = parseExcelDate(processedValue)
      if (!date) {
        return { value: null, error: `Riga ${rowNumber}, colonna ${columnKey}: data non valida` }
      }
      processedValue = date
      break
      
    case 'email':
      const email = String(processedValue).trim()
      if (!isValidEmail(email)) {
        return { value: null, error: `Riga ${rowNumber}, colonna ${columnKey}: email non valida` }
      }
      processedValue = email
      break
      
    case 'phone':
      const phone = String(processedValue).trim()
      if (!isValidPhone(phone)) {
        return { value: null, error: `Riga ${rowNumber}, colonna ${columnKey}: numero di telefono non valido` }
      }
      processedValue = phone
      break
  }

  // Custom validation
  if (column.validator) {
    const validationResult = column.validator(processedValue)
    if (validationResult !== true) {
      const errorMessage = typeof validationResult === 'string' 
        ? validationResult 
        : 'valore non valido'
      return { value: null, error: `Riga ${rowNumber}, colonna ${columnKey}: ${errorMessage}` }
    }
  }

  return { value: processedValue }
}

function parseExcelDate(value: any): string | null {
  if (!value) return null
  
  try {
    // Excel dates are stored as numbers (days since 1900-01-01)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value)
      if (date) {
        return new Date(date.y, date.m - 1, date.d).toISOString().split('T')[0]
      }
    }
    
    // Try to parse as string
    const parsed = new Date(value)
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]
    }
    
    return null
  } catch {
    return null
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidPhone(phone: string): boolean {
  // Accept various phone formats (Italian focus)
  const phoneRegex = /^(\+39|0039)?\s*[0-9\s\-\.]{8,15}$/
  return phoneRegex.test(phone.replace(/\s+/g, ''))
}

// Predefined column definitions for common imports
export const userImportColumns: Record<string, ImportColumn> = {
  first_name: {
    key: 'nome',
    required: true,
    type: 'string',
    validator: (value) => value && value.length >= 2 ? true : 'Il nome deve avere almeno 2 caratteri'
  },
  last_name: {
    key: 'cognome',
    required: true,
    type: 'string',
    validator: (value) => value && value.length >= 2 ? true : 'Il cognome deve avere almeno 2 caratteri'
  },
  email: {
    key: 'email',
    required: true,
    type: 'email'
  },
  phone_number: {
    key: 'telefono',
    type: 'phone'
  },
  date_of_birth: {
    key: 'data_nascita',
    type: 'date'
  },
  role: {
    key: 'ruolo',
    required: true,
    type: 'string',
    validator: (value) => ['admin', 'coach', 'athlete'].includes(value) ? true : 'Ruolo deve essere: admin, coach, athlete',
    transformer: (value) => String(value).toLowerCase()
  }
}

export const eventImportColumns: Record<string, ImportColumn> = {
  title: {
    key: 'titolo',
    required: true,
    type: 'string'
  },
  description: {
    key: 'descrizione',
    type: 'string'
  },
  location: {
    key: 'luogo',
    type: 'string'
  },
  start_date: {
    key: 'data_inizio',
    required: true,
    type: 'date'
  },
  start_time: {
    key: 'ora_inizio',
    required: true,
    type: 'string',
    validator: (value) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? true : 'Formato ora non valido (HH:MM)'
  },
  end_time: {
    key: 'ora_fine',
    required: true,
    type: 'string',
    validator: (value) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value) ? true : 'Formato ora non valido (HH:MM)'
  },
  team_codes: {
    key: 'codici_squadre',
    type: 'string',
    transformer: (value) => String(value).split(',').map(s => s.trim()).filter(s => s)
  }
}

export const teamMemberImportColumns: Record<string, ImportColumn> = {
  email: {
    key: 'email',
    required: true,
    type: 'email'
  },
  team_code: {
    key: 'codice_squadra',
    required: true,
    type: 'string'
  },
  jersey_number: {
    key: 'numero_maglia',
    type: 'number',
    validator: (value) => value > 0 && value <= 999 ? true : 'Numero maglia deve essere tra 1 e 999'
  },
  membership_number: {
    key: 'numero_tessera',
    type: 'string'
  },
  medical_certificate_expiry: {
    key: 'scadenza_certificato',
    type: 'date'
  }
}