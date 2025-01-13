/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { compactTemplate, compactTemplateParts, createTemplateExpression } from '../src/template'

describe('dynamic content references filter', () => {
  const dynamicContentType = new ObjectType({
    elemID: new ElemID('temp', 'type'),
    fields: {
      placeholder: { refType: BuiltinTypes.STRING },
    },
  })
  const dynamicContentInstance = new InstanceElement('dynamicContentInstance', dynamicContentType, {
    placeholder: '{{somePlaceholder}}',
  })
  it('should compact strings together', async () => {
    const result = compactTemplateParts([
      'this ',
      'is',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      'a ',
      'test',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      '}}',
      'final ',
      'check',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
    ])
    expect(result).toEqual([
      'this is',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      'a test',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
      '}}final check',
      new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
    ])
  })
  it('should return a string if all parts are strings', async () => {
    const template = new TemplateExpression({ parts: ['this is a test ', 'final check'] })
    const result = compactTemplate(template)
    expect(result).toBe('this is a test final check')
  })
  it('should create a template expression with compacted string', async () => {
    const result = createTemplateExpression({
      parts: [
        'this ',
        'is',
        new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
        'a ',
        'test',
        new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
        '}}',
        'final ',
        'check',
      ],
    })
    expect(result).toEqual(
      new TemplateExpression({
        parts: [
          'this is',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          'a test',
          new ReferenceExpression(dynamicContentInstance.elemID, dynamicContentInstance),
          '}}final check',
        ],
      }),
    )
  })
})
