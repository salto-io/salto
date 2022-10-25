/*
*                      Copyright 2022 Salto Labs Ltd.
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
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression, TemplateExpression,
} from '@salto-io/adapter-api'
import { compactTemplateParts, createTemplateExpression } from '../src/template'

describe('dynamic content references filter', () => {
  const dynamicContentType = new ObjectType({
    elemID: new ElemID('temp', 'type'),
    fields: {
      placeholder: { refType: BuiltinTypes.STRING },
    },
  })
  const dynamicContentInstance = new InstanceElement(
    'dynamicContentInstance',
    dynamicContentType,
    {
      placeholder: '{{somePlaceholder}}',
    },
  )
  it('should compact strings together', async () => {
    const result = compactTemplateParts(
      ['this ', 'is',
        new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
        'a ', 'test',
        new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
        '}}', 'final ', 'check']
    )
    expect(result).toEqual(['this is',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      'a test',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      '}}final check'])
  })
  it('should create a template expression with compacted string', async () => {
    const result = createTemplateExpression(
      { parts: ['this ', 'is',
        new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
        'a ', 'test',
        new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
        '}}', 'final ', 'check'] }
    )
    expect(result).toEqual(new TemplateExpression({ parts: ['this is',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      'a test',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      '}}final check'] }))
  })
})
