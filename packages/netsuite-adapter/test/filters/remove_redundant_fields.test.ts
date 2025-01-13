/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, ObjectType, BuiltinTypes, ListType, InstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/remove_redundant_fields'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('removeRedundantFields', () => {
  const typeToRemove = new ObjectType({ elemID: new ElemID(NETSUITE, 'NullField') })
  const typeWithFieldToRemove = new ObjectType({
    elemID: new ElemID(NETSUITE, 'typeWithFieldToRemove'),
    fields: {
      fieldToRemove: { refType: typeToRemove },
      listToRemove: { refType: new ListType(typeToRemove) },
      numberField: { refType: BuiltinTypes.NUMBER },
    },
    annotations: { source: 'soap' },
  })
  let elements: ObjectType[]

  beforeEach(() => {
    elements = [typeToRemove, typeWithFieldToRemove]
  })
  it('should remove the types and the fields', async () => {
    await filterCreator({} as LocalFilterOpts).onFetch?.(elements)
    expect(elements.length).toEqual(1)
    expect(typeWithFieldToRemove.fields.fieldToRemove).toBeUndefined()
    expect(typeWithFieldToRemove.fields.listToRemove).toBeUndefined()
    expect(typeWithFieldToRemove.fields.numberField).toBeDefined()
  })

  it('should remove redundant fields without types', async () => {
    const instance = new InstanceElement('instance', typeWithFieldToRemove, {
      lastModifiedDate: 'aaa',
      shouldNotRemove: 'bbb',
    })
    await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
    expect(instance.value).toEqual({ shouldNotRemove: 'bbb' })
  })
})
