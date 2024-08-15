/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { ZENDESK, ARTICLE_TYPE_NAME } from '../../../src/constants'
import {
  parseHandlebarPotentialReferences,
  parseHandlebarPotentialReferencesFromString,
} from '../../../src/filters/template_engines/handlebar_parser'

describe('parse', () => {
  it('should parse a template with a relevant helper function', () => {
    const template = 'Hello {{#is id 12345}}good name{{else}}bad name{{/is}}'
    const parsed = parseHandlebarPotentialReferencesFromString(template)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].value).toEqual(12345)
  })

  it('should parse a template with a relevant helper function and a sub expression', () => {
    const template = 'Hello {{#is (lookup id) 12345}}good name{{else}}bad name{{/is}}'
    const parsed = parseHandlebarPotentialReferencesFromString(template)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].value).toEqual(12345)
  })

  it('should parse a template with a relevant helper function block with an else clause', () => {
    const template = `
    {{#if section.articles}}
          {{#each section.articles}}
          {{#unless promoted}}
              {{#is id 4408291334545}}
                {{title}}
              {{else}}
               {{#is id 4408291365393}}
                  {{title}}
              {{else}}
                  {{title}}
              {{/is}}
              {{/is}}
          {{/unless}}
          {{/each}}
      {{else}}
        <i class="section-empty">
          <a href="{{section.url}}">{{t 'empty'}}</a>
        </i>
      {{/if}}
    `
    const parsed = parseHandlebarPotentialReferencesFromString(template)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].value).toEqual(4408291365393)
    expect(parsed[1].value).toEqual(4408291334545)
  })

  it('should not parse a template with an irrelevant helper function', () => {
    const template = 'Hello {{#if id 123456}}good name{{else}}bad name{{/if}}{{notBlock 1231}}'
    const parsed = parseHandlebarPotentialReferencesFromString(template)
    expect(parsed).toHaveLength(0)
  })
})

describe('parseHandlebarPotentialReferences', () => {
  let article: InstanceElement
  let idsToElements: Record<string, InstanceElement>
  beforeEach(() => {
    article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
      id: 12345,
    })
    idsToElements = {
      12345: article,
    }
  })
  it('should extract references from a handlebar template', () => {
    const template = 'Hello {{#is id 12345}}good name{{else}}bad name{{/is}}'
    const parsed = parseHandlebarPotentialReferences(template, idsToElements)
    expect(parsed).toEqual([
      {
        value: {
          parts: [new ReferenceExpression(article.elemID, article)],
        },
        loc: { start: 15, end: 20 },
      },
    ])
  })
})
