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
import { InstanceElement, ObjectType, ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { ZENDESK, ARTICLE_TYPE_NAME, SECTION_TYPE_NAME, BRAND_TYPE_NAME } from '../../../src/constants'
import {
  extractDomainsAndFieldsFromScripts,
  extractNumericValueIdsFromScripts,
} from '../../../src/filters/template_engines/javascript_extractor'

describe('extractNumericValueIdsFromScripts', () => {
  const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
    id: 123456,
  })
  const section = new InstanceElement('section', new ObjectType({ elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME) }), {
    id: 789012,
  })

  const idsToElements = {
    '123456': article,
    '789012': section,
  }

  it('should return a TemplateExpression with references from the script', () => {
    const script = `
      // Some script code
      const id1 = 123456;
      const id2 = 789012;
      // More script code
    `
    const result = extractNumericValueIdsFromScripts(idsToElements, script, 6)
    expect(result).toEqual({
      parts: [
        expect.stringMatching(/\s+\/\/ Some script code\s+const id1 = /),
        new ReferenceExpression(article.elemID, article),
        expect.stringMatching(/;\s+const id2 = /),
        new ReferenceExpression(section.elemID, section),
        expect.stringMatching(/;\s+\/\/ More script code\s+/),
      ],
    })
  })

  it('should return the input if no potential IDs are found', () => {
    const script = `
      // Some script code
      const id1 = '456789';
      const id2 = 'some id?';
      // More script code
    `
    const result = extractNumericValueIdsFromScripts(idsToElements, script, 6)
    expect(result).toEqual(script)
  })
})

describe('extractDomainsAndFieldsFromScripts', () => {
  const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
    id: 123456,
  })
  const section = new InstanceElement('section', new ObjectType({ elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME) }), {
    id: 789012,
  })

  const idsToElements = {
    '123456': article,
    '789012': section,
  }

  const brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
    id: 654321,
    brand_url: 'https://brand.com',
  })

  const matchBrandSubdomain = (url: string): InstanceElement | undefined => {
    if (url.includes('https://brand.com')) {
      return brand
    }
    return undefined
  }

  it('should return a TemplateExpression with references from the script', () => {
    const script = `
      // Some script code
      const request_custom_fields_123456 = 'some value';
      const brandDomain = 'https://brand.com/';
      // More script code
    `
    const result = extractDomainsAndFieldsFromScripts(idsToElements, matchBrandSubdomain, script)
    expect(result).toEqual({
      parts: [
        expect.stringMatching(/\s+\/\/ Some script code\s+const request_custom_fields_/),
        new ReferenceExpression(article.elemID, article),
        expect.stringMatching(/ = 'some value';\s+const brandDomain = /),
        new ReferenceExpression(brand.elemID, brand),
        expect.stringMatching(/\/';\s+\/\/ More script code\s+/),
      ],
    })
  })

  it('should return the input if no potential IDs are found', () => {
    const script = `
      // Some script code
      const request_custom_fields_654321 = 'some value';
      // More script code
    `
    const result = extractDomainsAndFieldsFromScripts(idsToElements, matchBrandSubdomain, script)
    expect(result).toEqual(script)
  })
})
