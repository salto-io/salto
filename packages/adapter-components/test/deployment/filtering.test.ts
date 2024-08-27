/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ModificationChange,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { filterUndeployableValues, transformRemovedValuesToNull } from '../../src/deployment/filtering'

describe('filterUndeployableValues', () => {
  let instance: InstanceElement

  beforeEach(() => {
    const type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        creatable: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: true,
            [CORE_ANNOTATIONS.UPDATABLE]: false,
          },
        },

        updatable: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: false,
            [CORE_ANNOTATIONS.UPDATABLE]: true,
          },
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      creatable: 'aaa',
      updatable: 'bbb',
      other: 'ccc',
    })
  })

  it('should filter the the unsupported values', async () => {
    const addValues = await filterUndeployableValues(instance, 'add')
    expect(addValues.value).toEqual({
      creatable: 'aaa',
      other: 'ccc',
    })

    const updateValues = await filterUndeployableValues(instance, 'modify')
    expect(updateValues.value).toEqual({
      updatable: 'bbb',
      other: 'ccc',
    })

    const removeValues = await filterUndeployableValues(instance, 'remove')
    expect(removeValues.value).toEqual({
      creatable: 'aaa',
      updatable: 'bbb',
      other: 'ccc',
    })
  })
})

describe('transformRemovedValuesToNull', () => {
  let before: InstanceElement
  let after: InstanceElement

  beforeEach(() => {
    const type = new ObjectType({ elemID: new ElemID('adapter', 'test') })
    before = new InstanceElement('instance', type, {
      name: 'inst',
      status: 'active',
      nested1: {
        field: [1, 2, 3],
        nested2: {
          some: 'value',
          another: { type: 'type' },
        },
        removedArray: [{ idx: 1 }, { idx: 2 }, { idx: 3 }],
      },
      settings: {
        url: 'http://example.com',
        url2: 'http://example.com',
      },
    })
    after = new InstanceElement('instance', type, {
      name: 'inst',
      status: 'active',
      nested1: {
        field: [1, 2],
        nested2: {
          some: 'value',
        },
      },
      settings: {
        url: 'http://example.com',
      },
    })
  })
  it('should transform removed values to null', () => {
    const change = toChange({ before, after }) as ModificationChange<InstanceElement>
    const result = transformRemovedValuesToNull({ change })
    expect(result.data.before.value).toEqual(before.value)
    expect(result.data.after.value).toEqual({
      name: 'inst',
      status: 'active',
      nested1: {
        field: [1, 2],
        nested2: {
          some: 'value',
          another: { type: null },
        },
        removedArray: null,
      },
      settings: {
        url: 'http://example.com',
        url2: null,
      },
    })
  })

  it('should not modify the original change', () => {
    const change = toChange({ before, after }) as ModificationChange<InstanceElement>
    const result = transformRemovedValuesToNull({ change })
    expect(change.data.before.value).toEqual(before.value)
    expect(change.data.after.value).toEqual(after.value)
    expect(result.data.before.value).toEqual(before.value)
    expect(result.data.after.value).not.toEqual(after.value)
  })

  it('should only transform the values in relevant path', () => {
    const change = toChange({ before, after }) as ModificationChange<InstanceElement>
    const result = transformRemovedValuesToNull({ change, applyToPath: ['nested1', 'nested2'] })
    expect(result.data.before.value).toEqual(before.value)
    expect(result.data.after.value).toEqual({
      name: 'inst',
      status: 'active',
      nested1: {
        field: [1, 2],
        nested2: {
          some: 'value',
          another: { type: null },
        },
      },
      settings: {
        url: 'http://example.com',
      },
    })
  })

  it('should not transform sub fields when skipSubFields is true', () => {
    const change = toChange({ before, after }) as ModificationChange<InstanceElement>
    const result = transformRemovedValuesToNull({ change, skipSubFields: true })
    expect(result.data.before.value).toEqual(before.value)
    expect(result.data.after.value).toEqual({
      name: 'inst',
      status: 'active',
      nested1: {
        field: [1, 2],
        nested2: {
          some: 'value',
          another: null,
        },
        removedArray: null,
      },
      settings: {
        url: 'http://example.com',
        url2: null,
      },
    })
  })
})
