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
import { Themes } from '../../../src/config'
import { ARTICLE_TYPE_NAME, BRAND_TYPE_NAME, ZENDESK } from '../../../src/constants'
import {
  createHandlebarTemplateExpression,
  createHtmlTemplateExpression,
  createJavascriptTemplateExpression,
} from '../../../src/filters/template_engines/creator'

describe('create template expression from files', () => {
  let config: Themes['referenceOptions']['javascriptReferenceLookupStrategy']
  const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }), {
    id: 12345,
  })
  const brand = new InstanceElement('brand', new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) }), {
    id: 654321,
    brand_url: 'https://brand.com',
  })
  const javascriptContent = `
    $(document).ready(function() {
      $('.request_custom_fields_12345').hide(); //hidden checkbox to make attachment required
    })
    var PREFIX_article_id_friend = 12345
    var without_a_prefix = 12345
    var PREFIX_full_article = 'https://brand.com/article/12345'`

  const expectedJavascriptContent = (strategy: 'numericValues' | 'varNamePrefix'): (ReferenceExpression | string)[] => {
    const greedyJavascriptContent = [
      `
    var without_a_prefix = `,
      new ReferenceExpression(article.elemID, article),
      `
    var PREFIX_full_article = '`,
    ]
    const prefixJavascriptContent = [
      `
    var without_a_prefix = 12345
    var PREFIX_full_article = '`,
    ]
    const innerContent = strategy === 'numericValues' ? greedyJavascriptContent : prefixJavascriptContent
    return [
      `
    $(document).ready(function() {
      $('.request_custom_fields_`,
      new ReferenceExpression(article.elemID, article),
      `').hide(); //hidden checkbox to make attachment required
    })
    var PREFIX_article_id_friend = `,
      new ReferenceExpression(article.elemID, article),
      ...innerContent,
      new ReferenceExpression(brand.elemID, brand),
      '/article/',
      new ReferenceExpression(article.elemID, article),
      "'",
    ]
  }

  const content = `
    <body>
      <script>
        ${javascriptContent}
      </script>

      <div class="container">
        <a href="https://brand.com/requests/new?ticket_form_id=12345">{{dc 'submit_a_request'}}</a>
        {{#is article.id 12345}}
          <span>{{date article.created_at timeago=true}}</span>
          <a href="{{help_center.url}}/articles/12345">{{dc 'contact_support'}}</a>
        {{/is}}
        {{#is article.id 12345}}
          <span>{{date article.created_at timeago=true}}</span>
        {{/is}}
      </div>
    </body>
    `

  const matchBrandSubdomain = (url: string): InstanceElement | undefined => {
    if (url.includes('https://brand.com')) {
      return brand
    }
    return undefined
  }

  describe.each(['numericValues', 'varNamePrefix'])('with %s javascript strategy', strategyString => {
    const strategy = strategyString as 'numericValues' | 'varNamePrefix'
    beforeEach(() => {
      config =
        strategy === 'numericValues'
          ? {
              strategy: 'numericValues',
              minimumDigitAmount: 5,
            }
          : {
              strategy: 'varNamePrefix',
              prefix: 'PREFIX_',
            }
    })
    describe('createHandlebarTemplateExpression', () => {
      it('should create a template expression from handlebar, html and javascript references', () => {
        const options = { matchBrandSubdomain, idsToElements: { 12345: article, 654321: brand } }
        const template = createHandlebarTemplateExpression(content, options, config)
        expect(template).toEqual({
          parts: [
            `
    <body>
      <script>
        ${expectedJavascriptContent(strategy)[0]}`,
            ...expectedJavascriptContent(strategy).slice(1, -1),
            expect.stringContaining(`</script>

      <div class="container">
        <a href="`),
            new ReferenceExpression(brand.elemID, brand),
            '/requests/new?ticket_form_id=',
            new ReferenceExpression(article.elemID, article),
            `">{{dc 'submit_a_request'}}</a>
        {{#is article.id `,
            new ReferenceExpression(article.elemID, article),
            `}}
          <span>{{date article.created_at timeago=true}}</span>
          <a href="{{help_center.url}}/articles/`,
            new ReferenceExpression(article.elemID, article),
            `">{{dc 'contact_support'}}</a>
        {{/is}}
        {{#is article.id `,
            new ReferenceExpression(article.elemID, article),
            `}}
          <span>{{date article.created_at timeago=true}}</span>
        {{/is}}
      </div>
    </body>
    `,
          ],
        })
      })
    })

    describe('createHtmlTemplateExpression', () => {
      it('should create a template expression from html references', () => {
        const options = { matchBrandSubdomain, idsToElements: { 12345: article, 654321: brand } }
        const template = createHtmlTemplateExpression(content, options, config)
        expect(template).toEqual({
          parts: [
            `
    <body>
      <script>
        ${expectedJavascriptContent(strategy)[0]}`,
            ...expectedJavascriptContent(strategy).slice(1, -1),
            expect.stringContaining(`</script>

      <div class="container">
        <a href="`),
            new ReferenceExpression(brand.elemID, brand),
            '/requests/new?ticket_form_id=',
            new ReferenceExpression(article.elemID, article),
            `">{{dc 'submit_a_request'}}</a>
        {{#is article.id 12345}}
          <span>{{date article.created_at timeago=true}}</span>
          <a href="{{help_center.url}}/articles/`,
            new ReferenceExpression(article.elemID, article),
            `">{{dc 'contact_support'}}</a>
        {{/is}}
        {{#is article.id 12345}}
          <span>{{date article.created_at timeago=true}}</span>
        {{/is}}
      </div>
    </body>
    `,
          ],
        })
      })
    })

    describe('createJavascriptTemplateExpression', () => {
      it('should create a template expression from javascript references', () => {
        const options = { matchBrandSubdomain, idsToElements: { 12345: article, 654321: brand } }
        const template = createJavascriptTemplateExpression(javascriptContent, options, config)
        expect(template).toEqual({
          parts: expectedJavascriptContent(strategy),
        })
      })
    })
  })
})
