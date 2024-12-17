/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  BuiltinTypes,
  CORE_ANNOTATIONS,
  getRestriction,
  createRestriction,
  ElemID,
} from '@salto-io/adapter-api'
import { FLOW_METADATA_VALUE_METADATA_TYPE, METADATA_TYPE, SALESFORCE } from '../../src/constants'
import filterCreator from '../../src/filters/flow'
import { defaultFilterContext } from '../utils'

describe('flow filter', () => {
  const filter = filterCreator({ config: defaultFilterContext })
  const values = [
    'ObjectType',
    'TriggerType',
    'ObjectVariable',
    'OldObjectVariable',
    'RecursiveCountVariable',
    'EventType',
  ]
  const mockFlow = new ObjectType({
    elemID: new ElemID(SALESFORCE, FLOW_METADATA_VALUE_METADATA_TYPE),
    annotations: {
      [METADATA_TYPE]: FLOW_METADATA_VALUE_METADATA_TYPE,
    },
    fields: {
      name: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values }),
        },
      },
    },
  })

  it('remove restriction values from flow_metadata_value.name', async () => {
    await filter.onFetch?.([mockFlow])
    expect(getRestriction(mockFlow.fields.name).values).toEqual(values)
    expect(getRestriction(mockFlow.fields.name).enforce_value).toBe(false)
  })
})
