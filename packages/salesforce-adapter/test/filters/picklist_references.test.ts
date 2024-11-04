/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ReferenceExpression,
  InstanceElement,
  ObjectType,
  ElemID,
  toChange,
  isReferenceExpression,
  CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import filterCreator, { PicklistValuesItem } from '../../src/filters/picklist_references'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'
import { Types } from '../../src/transformers/transformer'
import { VALUE_SET_FIELDS } from '../../src/constants'

const { awu } = collections.asynciterable

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
  let recordTypeWithoutPicklistValues: InstanceElement

  beforeEach(async () => {
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({ fetchParams: { optionalFeatures: { picklistsAsMaps: true } } }),
      },
    }) as FilterType

    recordType = new InstanceElement(
      'RecordType',
      mockTypes.RecordType,
      {
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
            picklist: new ReferenceExpression(
              accountObjectType.elemID.createNestedID('field', 'priority__c'),
              accountObjectType.fields.priority__c,
            ),
            // Value without a fullName attribute is invalid and skipped
            values: [{ default: false }],
          },
        ],
      },
      undefined,
      {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(accountObjectType.elemID, accountObjectType)],
      },
    )

    recordTypeWithoutPicklistValues = new InstanceElement('RecordType', mockTypes.RecordType, {}, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(accountObjectType.elemID, accountObjectType)],
    })
    const elements = [recordType, recordTypeWithoutPicklistValues]
    await filter.onFetch(elements)
  })

  describe('fetch: modify picklist values to reference expressions', () => {
    it('should create references to GlobalValueSet', async () => {
      expect(recordType.value.picklistValues[0].values).toEqual([
        {
          value: new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
          default: true,
        },
        {
          value: new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val2')),
          default: false,
        },
      ])
    })
    it('should create references to StandardValueSet', async () => {
      expect(recordType.value.picklistValues[1].values).toEqual([
        {
          value: new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'val2')),
        },
      ])
    })
    it('should create references to StandardValueSet (hopping an ObjectType reference)', async () => {
      expect(recordType.value.picklistValues[2].values).toEqual([
        {
          value: new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'val1')),
        },
      ])
    })
    it('should create references to ObjectType custom fields', async () => {
      expect(recordType.value.picklistValues[3].values).toEqual([
        {
          value: new ReferenceExpression(
            accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'High'),
          ),
        },
        {
          value: new ReferenceExpression(
            accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'Low'),
          ),
        },
      ])
    })
    it('should ignore invalid picklist values', async () => {
      expect(recordType.value.picklistValues[4].values).toEqual([{ default: false }])
    })
  })

  describe('deploy', () => {
    beforeEach(async () => {
      // This filter's `preDeploy` runs _after_ references are already resolved by a different filter. We need to
      // simulate this behavior by resolving the references here.
      const elementsSource = buildElementsSourceFromElements([gvs, svs, accountObjectType])
      await awu(recordType.value.picklistValues as PicklistValuesItem[]).forEach(
        async (picklistValues: PicklistValuesItem) => {
          picklistValues.values = await awu(picklistValues.values)
            .map(async ({ value, ...rest }) => {
              if (!isReferenceExpression(value)) {
                return { value, ...rest }
              }
              return {
                value: await (value as ReferenceExpression).getResolvedValue(elementsSource),
                ...rest,
              }
            })
            .toArray()
        },
      )

      await filter.preDeploy([toChange({ after: recordType })])
    })

    describe('preDeploy: resolve references in picklist values', () => {
      it('should resolve references to GlobalValueSet', async () => {
        expect(recordType.value.picklistValues[0].values).toEqual([
          { fullName: 'val1', default: true },
          { fullName: 'val2', default: false },
        ])
      })
      it('should resolve references to StandardValueSet', async () => {
        expect(recordType.value.picklistValues[1].values).toEqual([{ fullName: 'val2' }])
      })
      it('should resolve references to StandardValueSet (hopping an ObjectType reference)', async () => {
        expect(recordType.value.picklistValues[2].values).toEqual([{ fullName: 'val1' }])
      })
      it('should resolve references to ObjectType custom fields', async () => {
        expect(recordType.value.picklistValues[3].values).toEqual([{ fullName: 'High' }, { fullName: 'Low' }])
      })
      it('should ignore invalid picklist values', async () => {
        expect(recordType.value.picklistValues[4].values).toEqual([{ default: false }])
      })
    })

    describe('onDeploy: modify picklist values to reference expressions', () => {
      beforeEach(async () => {
        await filter.onDeploy([toChange({ after: recordType }), toChange({ after: recordTypeWithoutPicklistValues })])
      })
      it('should create references to GlobalValueSet', async () => {
        expect(recordType.value.picklistValues[0].values).toEqual([
          {
            value: new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val1')),
            default: true,
          },
          {
            value: new ReferenceExpression(gvs.elemID.createNestedID('customValue', 'values', 'val2')),
            default: false,
          },
        ])
      })
      it('should create references to StandardValueSet', async () => {
        expect(recordType.value.picklistValues[1].values).toEqual([
          {
            value: new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'val2')),
          },
        ])
      })
      it('should create references to StandardValueSet (hopping an ObjectType reference)', async () => {
        expect(recordType.value.picklistValues[2].values).toEqual([
          {
            value: new ReferenceExpression(svs.elemID.createNestedID('standardValue', 'values', 'val1')),
          },
        ])
      })
      it('should create references to ObjectType custom fields', async () => {
        expect(recordType.value.picklistValues[3].values).toEqual([
          {
            value: new ReferenceExpression(
              accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'High'),
            ),
          },
          {
            value: new ReferenceExpression(
              accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'Low'),
            ),
          },
        ])
      })
      it('should ignore invalid picklist values', async () => {
        expect(recordType.value.picklistValues[4].values).toEqual([{ default: false }])
      })
    })
  })
})
