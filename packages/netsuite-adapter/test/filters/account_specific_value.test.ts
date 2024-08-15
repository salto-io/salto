/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/account_specific_values'
import {
  ACCOUNT_SPECIFIC_VALUE,
  APPLICATION_ID,
  CUSTOM_RECORD_TYPE,
  METADATA_TYPE,
  NETSUITE,
} from '../../src/constants'
import { addressFormType } from '../../src/autogen/types/standard_types/addressForm'
import { LocalFilterOpts } from '../../src/filter'

describe('account_specific_values filter', () => {
  it('should remove account specific values from instance', async () => {
    const instance = new InstanceElement('instance', addressFormType().type, {
      [APPLICATION_ID]: 'a.b.c',
      a: 2,
      b: ACCOUNT_SPECIFIC_VALUE,
      c: {
        d: `${ACCOUNT_SPECIFIC_VALUE}|${ACCOUNT_SPECIFIC_VALUE}`,
        e: 3,
      },
    })
    const change = toChange({ after: instance })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([change])
    expect(getChangeData(change).value).toEqual({ a: 2, c: { e: 3 }, [APPLICATION_ID]: 'a.b.c' })
  })
  it('should remove account specific values from custom record type', async () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecor1'),
      fields: {
        custom_field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            a: 2,
            b: ACCOUNT_SPECIFIC_VALUE,
            c: {
              d: `${ACCOUNT_SPECIFIC_VALUE}|${ACCOUNT_SPECIFIC_VALUE}`,
              e: 3,
            },
          },
        },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [APPLICATION_ID]: 'a.b.c',
        a: 2,
        b: ACCOUNT_SPECIFIC_VALUE,
        c: {
          d: `${ACCOUNT_SPECIFIC_VALUE}|${ACCOUNT_SPECIFIC_VALUE}`,
          e: 3,
        },
      },
    })
    const change = toChange({ after: type })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([change])
    expect(getChangeData(change).annotations).toEqual({
      a: 2,
      c: { e: 3 },
      [APPLICATION_ID]: 'a.b.c',
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
    })
    expect(getChangeData(change).fields.custom_field.annotations).toEqual({ a: 2, c: { e: 3 } })
  })
})
