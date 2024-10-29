/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReferenceExpression, InstanceElement, ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/picklist_references'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'
import { Types } from '../../src/transformers/transformer'
import { VALUE_SET_FIELDS } from '../../src/constants'

describe('picklistReferences filter', () => {
  const gvs = new InstanceElement('MyGVS', mockTypes.GlobalValueSet, {
    customValue: {
      values: {
        val1: { fullName: 'val1', default: true, label: 'val1' },
        val2: { fullName: 'val2', default: false, label: 'val2' },
      },
    },
  })

  const svs = new InstanceElement('MySVS', mockTypes.StandardValueSet, {
    standardValue: {
      values: {
        val1: { fullName: 'val1', default: true, label: 'val1' },
        val2: { fullName: 'val2', default: false, label: 'val2' },
      },
    },
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
      priority__c: {
        refType: Types.primitiveDataTypes.Picklist,
        annotations: {
          valueSet: {
            values: {
              High: {
                fullName: 'High',
                default: false,
                label: 'High',
              },
              Low: {
                fullName: 'Low',
                default: false,
                label: 'Low',
              },
            },
          },
        },
      },
    },
  })

  type FilterType = FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  let recordType: InstanceElement

  beforeEach(async () => {
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { picklistsAsMaps: true } } }),
      },
    }) as FilterType

    recordType = new InstanceElement('RecordType', mockTypes.RecordType, {
      picklistValues: [
        {
          picklist: new ReferenceExpression(gvs.elemID, gvs),
          values: [
            { fullName: 'val1', default: true },
            { fullName: 'val2', default: false },
          ],
        },
        {
          picklist: new ReferenceExpression(svs.elemID, svs),
          // Incomplete subset of values
          values: [{ fullName: 'val2' }],
        },
        {
          picklist: new ReferenceExpression(
            accountObjectType.elemID.createNestedID('field', 'industry'),
            accountObjectType.fields.industry,
          ),
          // Incomplete subset of values
          values: [{ fullName: 'val1' }],
        },
        {
          picklist: new ReferenceExpression(
            accountObjectType.elemID.createNestedID('field', 'priority__c'),
            accountObjectType.fields.priority__c,
          ),
          values: [{ fullName: 'High' }, { fullName: 'Low' }],
        },
        {
          picklist: 'invalid',
          values: [{ fullName: 'val1' }],
        },
        {
          picklist: new ReferenceExpression(
            accountObjectType.elemID.createNestedID('field', 'priority__c'),
            accountObjectType.fields.priority__c,
          ),
          // Value without a fullName attribute is invalid and skipped
          values: [{ default: false }],
        },
      ],
    })
    const elements = [recordType]
    await filter.onFetch(elements)
  })

  describe('modify picklist values to reference expressions', () => {
    it('should create references to GlobalValueSet', async () => {
      expect(recordType.value.picklistValues[0].values).toEqual([
        {
          value: new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1'), {
            fullName: 'val1',
            default: true,
            label: 'val1',
          }),
          default: true,
        },
        {
          value: new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val2'), {
            fullName: 'val2',
            default: false,
            label: 'val2',
          }),
          default: false,
        },
      ])
    })
    it('should create references to StandardValueSet', async () => {
      expect(recordType.value.picklistValues[1].values).toEqual([
        {
          value: new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'val2'), {
            fullName: 'val2',
            default: false,
            label: 'val2',
          }),
        },
      ])
    })
    it('should create references to StandardValueSet (hopping an ObjectType reference)', async () => {
      expect(recordType.value.picklistValues[2].values).toEqual([
        {
          value: new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'val1'), {
            fullName: 'val1',
            default: true,
            label: 'val1',
          }),
        },
      ])
    })
    it('should create references to ObjectType custom fields', async () => {
      expect(recordType.value.picklistValues[3].values).toEqual([
        {
          value: new ReferenceExpression(
            accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'High'),
            { fullName: 'High', default: false, label: 'High' },
          ),
        },
        {
          value: new ReferenceExpression(
            accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'Low'),
            { fullName: 'Low', default: false, label: 'Low' },
          ),
        },
      ])
    })
    it('should ignore invalid picklist references', async () => {
      expect(recordType.value.picklistValues[4].values).toEqual([{ fullName: 'val1' }])
    })
    it('should ignore invalid picklist values', async () => {
      expect(recordType.value.picklistValues[5].values).toEqual([{ default: false }])
    })
  })

  describe('deploy', () => {
    beforeEach(async () => {
      await filter.preDeploy([toChange({ after: recordType })])
    })

    it('should resolve references in picklist values', async () => {
      expect(recordType.value.picklistValues[0].values).toEqual([
        { fullName: 'val1', default: true },
        { fullName: 'val2', default: false },
      ])
    })
  })
})
