/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from '../../src/change_validators/types'
import dataAccountSpecificValueValidator from '../../src/change_validators/data_account_specific_values'
import { NETSUITE } from '../../src/constants'
import { SUITEQL_TABLE } from '../../src/data_elements/suiteql_table_elements'
import { fullFetchConfig } from '../../src/config/config_creator'
import { UNKNOWN_TYPE_REFERENCES_ELEM_ID } from '../../src/filters/data_account_specific_values'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('data account specific values validator', () => {
  let params: Parameters<NetsuiteChangeValidator>[1]
  let dataType: ObjectType

  beforeEach(() => {
    dataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'someType'),
      annotations: { source: 'soap' },
    })
    const suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    const unknownTypeReferencesType = new ObjectType({ elemID: UNKNOWN_TYPE_REFERENCES_ELEM_ID })
    const unknownTypeReferencesInstance = new InstanceElement(ElemID.CONFIG_NAME, unknownTypeReferencesType, {
      [naclCase('someType.someField.inner')]: {
        1: 'Value 123',
      },
    })
    params = {
      client: new NetsuiteClient(mockSdfClient()),
      elementsSource: buildElementsSourceFromElements([
        suiteQLTableType,
        unknownTypeReferencesType,
        unknownTypeReferencesInstance,
      ]),
      config: {
        fetch: fullFetchConfig(),
      },
      suiteQLNameToInternalIdsMap: {
        account: {
          'Account 1': ['1'],
          'Some Account': ['2', '3'],
        },
      },
      ...getTypesToInternalId([]),
    }
  })

  it('should not have errors when deploying an instance without ACCOUNT_SPECIFIC_VALUE', async () => {
    const instance = new InstanceElement('instance', dataType)
    const changeErrors = await dataAccountSpecificValueValidator([toChange({ after: instance })], params)
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have errors when the ACCOUNT_SPECIFIC_VALUE are resolved', async () => {
    const instance = new InstanceElement('instance', dataType, {
      accountField: {
        id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 1)',
      },
      someField: {
        inner: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)',
        },
      },
    })
    const changeErrors = await dataAccountSpecificValueValidator([toChange({ after: instance })], params)
    expect(changeErrors).toHaveLength(0)
  })

  it('should have error when an ACCOUNT_SPECIFIC_VALUE is not resolved', async () => {
    const instance = new InstanceElement('instance', dataType, {
      accountField: {
        id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 2)',
      },
      someField: {
        inner: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)',
        },
      },
    })
    const changeErrors = await dataAccountSpecificValueValidator([toChange({ after: instance })], params)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      severity: 'Error',
      elemID: instance.elemID,
      message: 'Could not identify value in data object',
      detailedMessage: expect.stringContaining('Could not find object "Account 2" for field "accountField"'),
    })
  })

  it('should have error on nested field with unresolved ACCOUNT_SPECIFIC_VALUE', async () => {
    const instance = new InstanceElement('instance', dataType, {
      accountField: {
        id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 1)',
      },
      someField: {
        inner: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 456)',
        },
      },
    })
    const changeErrors = await dataAccountSpecificValueValidator([toChange({ after: instance })], params)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      severity: 'Error',
      elemID: instance.elemID,
      message: 'Could not identify value in data object',
      detailedMessage: expect.stringContaining('Could not find object "Value 456" for field "someField.inner"'),
    })
  })

  it('should have warning ACCOUNT_SPECIFIC_VALUE with non unique name', async () => {
    const instance = new InstanceElement('instance', dataType, {
      accountField: {
        id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Some Account)',
      },
      someField: {
        inner: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)',
        },
      },
    })
    const changeErrors = await dataAccountSpecificValueValidator([toChange({ after: instance })], params)
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      severity: 'Warning',
      elemID: instance.elemID.createNestedID('accountField'),
      message: 'Multiple objects with the same name',
      detailedMessage: expect.stringContaining('There are multiple objects with the name "Some Account"'),
    })
  })

  it('should not have error if a field with unresolved ACCOUNT_SPECIFIC_VALUE was not changed', async () => {
    const before = new InstanceElement('instance', dataType, {
      strField: 1,
      accountField: {
        id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 2)',
      },
      someField: {
        inner: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 456)',
        },
      },
    })

    const after = before.clone()
    after.value.strField = 2
    const changeErrors = await dataAccountSpecificValueValidator([toChange({ before, after })], params)
    expect(changeErrors).toHaveLength(0)
  })
})
