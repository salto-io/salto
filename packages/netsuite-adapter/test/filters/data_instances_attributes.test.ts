/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/data_instances_attributes'
import { NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

describe('data_instances_attributes', () => {
  it('on fetch should remove the attributes value', async () => {
    const instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID(NETSUITE, 'type'), annotations: { source: 'soap' } }),
      { attributes: { internalId: '1', 'xsi:type': 'listAcct:Subsidiary' } },
    )

    await filterCreator({} as LocalFilterOpts).onFetch?.([instance])
    expect(instance.value.internalId).toEqual('1')
    expect(instance.value.attributes).toBeUndefined()
  })

  it('pre deploy should add the attributes value', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'type'),
      fields: {
        attrField: { refType: BuiltinTypes.STRING, annotations: { isAttribute: true } },
        otherField: { refType: BuiltinTypes.STRING },
      },
      annotations: { source: 'soap' },
    })
    const instance = new InstanceElement('instance', type, { internalId: '1', attrField: '2', otherField: '3' })

    await filterCreator({} as LocalFilterOpts).preDeploy?.([
      toChange({ before: instance, after: instance }),
      toChange({ before: type, after: type }),
    ])
    expect(instance.value).toEqual({ attributes: { internalId: '1', attrField: '2' }, otherField: '3' })
  })
})
