const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HR', 'IMG', 'LI', 'OL', 'P', 'PRE', 'SPAN', 'STRONG',
  'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL',
])

const ALLOWED_ATTRIBUTES = new Set(['class', 'colspan', 'height', 'rowspan', 'width'])

function isSafeUrl(value: string, allowMailto = false) {
  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'https:' || url.protocol === 'http:' || (allowMailto && url.protocol === 'mailto:')
  } catch {
    return false
  }
}

function sanitizeHtmlWithoutDom(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi, (full, rawTag: string, rawAttributes: string) => {
      const tag = rawTag.toUpperCase()
      if (!ALLOWED_TAGS.has(tag)) return ''
      if (full.startsWith('</')) return `</${rawTag}>`

      const attributes: string[] = []
      const attributePattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
      let match: RegExpExecArray | null
      while ((match = attributePattern.exec(rawAttributes))) {
        const name = match[1].toLowerCase()
        const value = (match[2] ?? match[3] ?? match[4] ?? '').trim()
        const isLink = name === 'href' && tag === 'A'
        const isImage = name === 'src' && tag === 'IMG'
        if (name.startsWith('on') || name === 'style' || (!ALLOWED_ATTRIBUTES.has(name) && !isLink && !isImage)) continue
        if ((isLink || isImage) && !/^(https?:|mailto:)/i.test(value)) continue
        attributes.push(`${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;') }"`)
      }
      if (tag === 'A') attributes.push('rel="noopener noreferrer"', 'target="_blank"')
      return `<${rawTag}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`
    })
}

/** Sanitizes user/template HTML before it reaches dangerouslySetInnerHTML or innerHTML. */
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return sanitizeHtmlWithoutDom(html)

  const document = window.document
  const parsed = new DOMParser().parseFromString(html, 'text/html')

  for (const element of Array.from(parsed.body.querySelectorAll('*'))) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      const isLink = name === 'href' && element.tagName === 'A'
      const isImage = name === 'src' && element.tagName === 'IMG'

      if (name.startsWith('on') || name === 'style' || (!ALLOWED_ATTRIBUTES.has(name) && !isLink && !isImage)) {
        element.removeAttribute(attribute.name)
        continue
      }
      if (isLink && !isSafeUrl(value, true)) element.removeAttribute(attribute.name)
      if (isImage && !isSafeUrl(value)) element.removeAttribute(attribute.name)
    }

    // Un IMG senza src valido genera warning e richieste vuote in html2canvas.
    if (element.tagName === 'IMG' && !element.getAttribute('src')) {
      element.remove()
      continue
    }

    if (element.tagName === 'A') {
      element.setAttribute('rel', 'noopener noreferrer')
      element.setAttribute('target', '_blank')
    }
  }

  return parsed.body.innerHTML
}
