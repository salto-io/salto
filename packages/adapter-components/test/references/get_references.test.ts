/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { parserUtils } from '@salto-io/parser'
import { createTemplateExpression } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { mockInstance, templateElemID, templateElemID2 } from '../utils'
import { getAllReferencedIds } from '../../src/references/get_references'

describe('getAllReferencedIds', () => {
  it('should find referenced ids', async () => {
    const res = await getAllReferencedIds(mockInstance)
    expect(res).toEqual(
      new Set([
        'mockAdapter.test',
        'mockAdapter.test2.field.aaa',
        templateElemID.getFullName(),
        templateElemID2.getFullName(),
      ]),
    )
  })
  it('should find referenced ids only in annotations', async () => {
    const res = await getAllReferencedIds(mockInstance, true)
    expect(res).toEqual(new Set(['mockAdapter.test']))
  })
  it('should find referenced ids in templated static file', async () => {
    const article = new InstanceElement('article', new ObjectType({ elemID: new ElemID('test', 'article') }), {})
    const macro1 = new InstanceElement('macro1', new ObjectType({ elemID: new ElemID('test', 'macro') }), {})

    const instanceWithTemplateStatic = mockInstance.clone()
    instanceWithTemplateStatic.value.templateStatic = parserUtils.templateExpressionToStaticFile(
      createTemplateExpression({
        parts: [
          '"/hc/test/test/articles/',
          new ReferenceExpression(article.elemID, article),
          '\n/test "hc/test/test/articles/',
          new ReferenceExpression(macro1.elemID, macro1),
          '/test',
        ],
      }),
      'test',
    )
    const res = await getAllReferencedIds(instanceWithTemplateStatic)
    expect(res).toEqual(
      new Set([
        'mockAdapter.test',
        'mockAdapter.test2.field.aaa',
        templateElemID.getFullName(),
        templateElemID2.getFullName(),
        article.elemID.getFullName(),
        macro1.elemID.getFullName(),
      ]),
    )
  })
})
