/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../../src/constants'
import {
  parseUrlPotentialReferencesFromString,
  parseTagsFromHtml,
  parseHtmlPotentialReferences,
} from '../../../src/filters/template_engines/html_parser'

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
            end: 46,
            start: 7,
          },
        },
        {
          value: 'https://example.com/image.jpg',
          loc: {
            end: 106,
            start: 54,
          },
        },
        {
          value: 'https://example.com/styles.css',
          loc: {
            end: 174,
            start: 114,
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

describe('parseUrlPotentialReferencesFromString', () => {
  let urlBrandInstance: InstanceElement
  let matchBrandSubdomain: (url: string) => InstanceElement | undefined
  let article: InstanceElement
  let instancesById: Record<string, InstanceElement>
  beforeEach(() => {
    urlBrandInstance = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
      id: 1,
      name: 'brand',
    })
    matchBrandSubdomain = jest.fn().mockReturnValue(urlBrandInstance)
    article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
      id: 222552,
    })
    instancesById = {
      [urlBrandInstance.value.id]: urlBrandInstance,
      [article.value.id]: article,
    }
  })

  it('should extract URL references from a string', () => {
    const content = 'This is a string with a URL reference: {{help_center.url}}/hc/en-us/articles/222552'
    const result = parseUrlPotentialReferencesFromString(content, { matchBrandSubdomain, instancesById })
    expect(result).toEqual({
      parts: [
        'This is a string with a URL reference: {{help_center.url}}/hc/en-us/articles/',
        new ReferenceExpression(article.elemID, article),
      ],
    })
  })

  it('should extract URL references from a string with multiple references', () => {
    const content =
      'This is a string with multiple URL references: https://some.domain.com/hc/en-us/articles/222552 and {{help_center.url}}/hc/en-us/articles/222552'
    const result = parseUrlPotentialReferencesFromString(content, { matchBrandSubdomain, instancesById })
    expect(result).toEqual({
      parts: [
        'This is a string with multiple URL references: ',
        new ReferenceExpression(urlBrandInstance.elemID, urlBrandInstance),
        '/hc/en-us/articles/',
        new ReferenceExpression(article.elemID, article),
        ' and {{help_center.url}}/hc/en-us/articles/',
        new ReferenceExpression(article.elemID, article),
      ],
    })
  })

  it('should handle missing references when enableMissingReferences is true', () => {
    const content = 'This is a string with a missing URL reference: {{help_center.url}}/hc/en-us/articles/360001234568'
    const missingArticle = new InstanceElement(
      'missing_360001234568',
      new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
      { id: '360001234568' },
      undefined,
      { salto_missing_ref: true },
    )
    const result = parseUrlPotentialReferencesFromString(content, {
      matchBrandSubdomain,
      instancesById,
      enableMissingReferences: true,
    })
    expect(result).toEqual({
      parts: [
        'This is a string with a missing URL reference: {{help_center.url}}/hc/en-us/articles/',
        new ReferenceExpression(missingArticle.elemID, missingArticle),
      ],
    })
  })

  it('should handle missing references when enableMissingReferences is false', () => {
    const content = 'This is a string with a missing URL reference: {{help_center.url}}/hc/en-us/articles/360001234568'
    const result = parseUrlPotentialReferencesFromString(content, {
      matchBrandSubdomain,
      instancesById,
      enableMissingReferences: false,
    })
    expect(result).toEqual(
      'This is a string with a missing URL reference: {{help_center.url}}/hc/en-us/articles/360001234568',
    )
  })
})

describe('parseHtmlPotentialReferences', () => {
  let urlBrandInstance: InstanceElement
  let matchBrandSubdomain: (url: string) => InstanceElement | undefined
  let article: InstanceElement
  let instancesById: Record<string, InstanceElement>
  beforeEach(() => {
    urlBrandInstance = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
      id: 1,
      name: 'brand',
    })
    matchBrandSubdomain = jest.fn().mockReturnValue(urlBrandInstance)
    article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
      id: 222552,
    })
    instancesById = {
      [urlBrandInstance.value.id]: urlBrandInstance,
      [article.value.id]: article,
    }
  })

  it('should extract URL references from HTML content', () => {
    const htmlContent = `
      <a href="{{help_center.url}}/hc/en-us/articles/222552">Link 1</a>
      <img src="{{help_center.url}}/image.jpg" alt="Image">
      <link href="{{help_center.url}}/styles.css" rel="stylesheet">
    `
    const result = parseHtmlPotentialReferences(htmlContent, { matchBrandSubdomain, instancesById })
    expect(result.urls).toEqual([
      {
        value: {
          parts: ['{{help_center.url}}/hc/en-us/articles/', new ReferenceExpression(article.elemID, article)],
        },
        loc: { start: 7, end: 71 },
      },
      {
        value: '{{help_center.url}}/image.jpg',
        loc: { start: 79, end: 131 },
      },
      {
        value: '{{help_center.url}}/styles.css',
        loc: { start: 139, end: 199 },
      },
    ])
  })

  it('should handle Angular ng-href and ng-src', () => {
    const htmlContent = `
      <a ng-href="{{help_center.url}}/hc/en-us/articles/222552">Link 1</a>
      <img ng-src="{{help_center.url}}/image.jpg" alt="Image">
    `
    const result = parseHtmlPotentialReferences(htmlContent, { matchBrandSubdomain, instancesById })
    expect(result.urls).toEqual([
      {
        value: {
          parts: ['{{help_center.url}}/hc/en-us/articles/', new ReferenceExpression(article.elemID, article)],
        },
        loc: { start: 7, end: 74 },
      },
      {
        value: '{{help_center.url}}/image.jpg',
        loc: { start: 82, end: 137 },
      },
    ])
  })

  it('should handle missing references when enableMissingReferences is true', () => {
    const htmlContent = `
      <a href="{{help_center.url}}/hc/en-us/articles/360001234568">Link 1</a>
      <a href="https://some.zendesk.subdomain/hc/en-us/articles/36000987654">Link 1</a>
    `
    const missingArticle = new InstanceElement(
      'missing_360001234568',
      new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
      { id: '360001234568' },
      undefined,
      { salto_missing_ref: true },
    )
    const missingBrandArticle = new InstanceElement(
      'missing_brand_36000987654',
      new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
      { id: '36000987654' },
      undefined,
      { salto_missing_ref: true },
    )
    const result = parseHtmlPotentialReferences(htmlContent, {
      matchBrandSubdomain,
      instancesById,
      enableMissingReferences: true,
    })
    expect(result.urls).toEqual([
      {
        value: {
          parts: [
            '{{help_center.url}}/hc/en-us/articles/',
            new ReferenceExpression(missingArticle.elemID, missingArticle),
          ],
        },
        loc: { start: 7, end: 77 },
      },
      {
        value: {
          parts: [
            new ReferenceExpression(urlBrandInstance.elemID, urlBrandInstance),
            '/hc/en-us/articles/',
            new ReferenceExpression(missingBrandArticle.elemID, missingBrandArticle),
          ],
        },
        loc: { start: 85, end: 165 },
      },
    ])
  })

  it('should extract string content from script tags', () => {
    const htmlContent = `
      <script>
        const someVar = 'some value';
      </script>
    `
    const result = parseHtmlPotentialReferences(htmlContent, { matchBrandSubdomain, instancesById })
    expect(result.scripts).toEqual([
      {
        value: expect.stringMatching(/\s+const someVar = 'some value';\s+/),
        loc: { start: 15, end: 59 },
      },
    ])
  })
})
