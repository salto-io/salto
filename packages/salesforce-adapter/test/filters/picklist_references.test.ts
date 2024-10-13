/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReferenceExpression, InstanceElement, ObjectType, ElemID } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/picklist_references'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'
import { Types } from '../../src/transformers/transformer'
import { VALUE_SET_FIELDS } from '../../src/constants'

describe('picklistReferences filter', () => {
  const gvs = new InstanceElement('MyGVS', mockTypes.GlobalValueSet, {
    customValue: [
      { fullName: 'val1', default: true, label: 'value1' },
      { fullName: 'val2', default: false, label: 'value2' },
    ],
  })

  const svs = new InstanceElement('MySVS', mockTypes.StandardValueSet, {
    standardValue: [
      { fullName: 'val1', default: true, label: 'value1' },
      { fullName: 'val2', default: false, label: 'value2' },
    ],
  })

  const accountObjectType = new ObjectType({
    elemID: new ElemID('salesforce', 'Account'),
    fields: {
      industry: {
        refType: Types.primitiveDataTypes.Picklist,
        annotations: {
          [VALUE_SET_FIELDS.VALUE_SET_NAME]: new ReferenceExpression(svs.elemID, svs),
        },
      },
    },
  })

  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  beforeEach(async () => {
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { picklistsAsMaps: true } } }),
      },
    }) as FilterType
  })

  it('modifies picklist values to reference expressions', async () => {
    const recordType = new InstanceElement('RecordType', mockTypes.RecordType, {
      picklistValues: [
        {
          picklist: new ReferenceExpression(gvs.elemID, gvs),
          values: [{ fullName: 'value1' }, { fullName: 'value2' }],
        },
        {
          picklist: new ReferenceExpression(svs.elemID, svs),
          // Incomplete subset of values
          values: [{ fullName: 'value2' }],
        },
        {
          picklist: new ReferenceExpression(
            accountObjectType.elemID.createNestedID('field', 'industry'),
            accountObjectType.fields.industry,
          ),
          // Incomplete subset of values
          values: [{ fullName: 'value1' }],
        },
      ],
    })
    const elements = [recordType]
    await filter.onFetch(elements)

    expect(recordType.value.picklistValues[0].values).toEqual([
      new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'value1')),
      new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'value2')),
    ])
    expect(recordType.value.picklistValues[1].values).toEqual([
      new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'value2')),
    ])
    expect(recordType.value.picklistValues[2].values).toEqual([
      new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'value1')),
    ])
  })
})
