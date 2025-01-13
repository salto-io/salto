/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { parseTagsFromHtml } from '../src/html_parser'

describe('parseTagsFromHtml', () => {
  describe('should extract URLs from HTML tags', () => {
    it('should extract URLs from HTML content', () => {
      const htmlContent = `
      <a href="https://example.com">Link 1</a>
      <img src="https://example.com/image.jpg" alt="Image">
      <link href="https://example.com/styles.css" rel="stylesheet">
    `
      const { urls } = parseTagsFromHtml(htmlContent)
      expect(urls).toEqual([
        {
          value: 'https://example.com',
          loc: {
            end: 35,
            start: 16,
          },
        },
        {
          value: 'https://example.com/image.jpg',
          loc: {
            end: 93,
            start: 64,
          },
        },
        {
          value: 'https://example.com/styles.css',
          loc: {
            end: 156,
            start: 126,
          },
        },
      ])
    })

    it('should handle empty HTML content', () => {
      const htmlContent = ''
      const { urls } = parseTagsFromHtml(htmlContent)
      expect(urls).toEqual([])
    })

    it('should handle HTML content without any URLs', () => {
      const htmlContent = `
      <div>Hello, world!</div>
      <p>This is a paragraph.</p>
    `
      const { urls } = parseTagsFromHtml(htmlContent)
      expect(urls).toEqual([])
    })
  })

  describe('should extract text from script tags', () => {
    it('should extract text from script tags', () => {
      const htmlContent = `
      <script>
        const someVar = 'some value';
      </script>
    `
      const { scripts } = parseTagsFromHtml(htmlContent)
      expect(scripts.map(s => s.value.trim())).toEqual(["const someVar = 'some value';"])
    })
  })
})