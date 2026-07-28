import { sanitizeHtml } from './sanitizeHtml'

describe('sanitizeHtml', () => {
  it('removes scripts, handlers and javascript URLs', () => {
    const result = sanitizeHtml('<p onclick="alert(1)">Ciao</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>')
    expect(result).toContain('<p>Ciao</p>')
    expect(result).not.toMatch(/script|onclick|javascript:/i)
  })

  it('keeps safe formatting and http images', () => {
    const result = sanitizeHtml('<strong>Ok</strong><img src="https://example.com/a.png" alt="x" style="display:none">')
    expect(result).toContain('<strong>Ok</strong>')
    expect(result).toContain('src="https://example.com/a.png"')
    expect(result).not.toContain('style=')
  })

  it('removes images without a safe source', () => {
    const result = sanitizeHtml('<p>Test</p><img src=""><img onerror="alert(1)">')
    expect(result).toBe('<p>Test</p>')
  })
})
