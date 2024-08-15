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
  Field,
  getChangeData,
  InstanceElement,
  MapType,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { flattenAdditionalProperties } from '../../../../src/elements_deprecated/swagger/deployment/additional_properties'

describe('flattenAdditionalProperties', () => {
  it('Should remove the additional properties and add its values if deployable', async () => {
    const typeWithUpdatableProperties = new ObjectType({
      elemID: new ElemID('adapter', 'type1'),
      fields: {
        additionalProperties: {
          refType: new MapType(BuiltinTypes.STRING),
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: false,
            [CORE_ANNOTATIONS.UPDATABLE]: true,
          },
        },
      },
    })

    const typeWithoutProperties = new ObjectType({
      elemID: new ElemID('adapter', 'type1'),
    })

    const typeWithCreatableProperties = new ObjectType({
      elemID: new ElemID('adapter', 'type1'),
      fields: {
        additionalProperties: {
          refType: new MapType(BuiltinTypes.STRING),
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: true,
          },
        },

        valueWithUpdatableProperties: { refType: typeWithUpdatableProperties },
        valueWithoutProperties: { refType: typeWithoutProperties },
      },
    })

    typeWithCreatableProperties.fields.valueWithCreatableProperties = new Field(
      typeWithCreatableProperties,
      'valueWithCreatableProperties',
      typeWithCreatableProperties,
    )

    const instance = new InstanceElement('instance', typeWithCreatableProperties, {
      valueWithCreatableProperties: {
        additionalProperties: {
          key: 'value',
        },
        valueWithCreatableProperties: {},
      },
      valueWithUpdatableProperties: {
        additionalProperties: {
          key: 'value',
        },
      },
      valueWithoutProperties: {},
      additionalProperties: {
        key: 'value',
      },
    })

    const flattenedChange = await flattenAdditionalProperties(toChange({ after: instance }))
    expect(getChangeData(flattenedChange).value).toEqual({
      valueWithCreatableProperties: {
        key: 'value',
        valueWithCreatableProperties: {},
      },
      valueWithUpdatableProperties: {
        additionalProperties: {
          key: 'value',
        },
      },
      valueWithoutProperties: {},
      key: 'value',
    })
  })

  it('Should not change additional properties if its type is not a map', async () => {
    const typeWithCreatableProperties = new ObjectType({
      elemID: new ElemID('adapter', 'type1'),
      fields: {
        additionalProperties: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: true,
          },
        },
      },
    })

    const instance = new InstanceElement('instance', typeWithCreatableProperties, {
      additionalProperties: {
        key: 'value',
      },
    })

    const flattenedChange = await flattenAdditionalProperties(toChange({ after: instance }))
    expect(getChangeData(flattenedChange).value).toEqual({
      additionalProperties: {
        key: 'value',
      },
    })
  })
})
