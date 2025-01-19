/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ReferenceExpression, InstanceElement, ObjectType, ElemID, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import filterCreator, { BUSINESS_PROCESS_PARENTS, BusinessProcessParent } from '../../src/filters/picklist_references'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { createCustomObjectType, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import { mockTypes } from '../mock_elements'
import { Types } from '../../src/transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD, VALUE_SET_FIELDS } from '../../src/constants'

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

  let filter: FilterWith<'onFetch'>

  beforeEach(() => {
    filter = filterCreator({
      config: {
        ...defaultFilterContext,
        fetchProfile: buildFetchProfile({ fetchParams: { target: [] } }),
        elementsSource: buildElementsSourceFromElements([gvs, svs]),
      },
    }) as typeof filter
  })
  describe('RecordType instances', () => {
    const highCustomObject = createCustomObjectType('High', {})
    const veryHighCustomObject = createCustomObjectType('VeryHigh', {})

    const accountObjectType = new ObjectType({
      elemID: new ElemID('salesforce', 'Account'),
      fields: {
        industry: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            [VALUE_SET_FIELDS.VALUE_SET_NAME]: new ReferenceExpression(svs.elemID, svs),
          },
        },
        gvs_Picklist__c: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            [VALUE_SET_FIELDS.VALUE_SET_NAME]: new ReferenceExpression(gvs.elemID, gvs),
          },
        },
        priority__c: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            valueSet: {
              values: {
                High: {
                  // Make sure we support the case where fullName is a reference to Element
                  fullName: new ReferenceExpression(highCustomObject.elemID, highCustomObject),
                  default: false,
                  label: 'High',
                },
                VeryHigh: {
                  // Make sure we support the case where fullName is unresolved reference
                  fullName: new ReferenceExpression(veryHighCustomObject.elemID),
                },
                Low: {
                  fullName: 'Low',
                  default: false,
                  label: 'Low',
                },
                // Make sure we make the references by encoding the RecordType Picklist values
                [naclCase('High & Low')]: {
                  fullName: 'High & Low',
                  default: false,
                  label: 'High & Low',
                },
              },
            },
          },
        },
        // Make sure the filter does not create references to the old format.
        Old_Format_Picklist__c: {
          refType: Types.primitiveDataTypes.Picklist,
          annotations: {
            valueSet: [
              {
                fullName: 'val1',
                default: false,
                label: 'High',
              },
              {
                fullName: 'val2',
                default: false,
                label: 'Low',
              },
            ],
          },
        },
      },
    })
    let recordType: InstanceElement
    let recordTypeWithoutPicklistValues: InstanceElement

    beforeEach(async () => {
      recordType = new InstanceElement(
        'RecordType',
        mockTypes.RecordType,
        {
          picklistValues: [
            // GlobalValueSet
            {
              picklist: new ReferenceExpression(
                accountObjectType.fields.gvs_Picklist__c.elemID,
                accountObjectType.fields.gvs_Picklist__c,
              ),
              values: [
                { fullName: 'val1', default: true },
                { fullName: 'val2', default: false },
              ],
            },
            // StandardValueSet
            {
              picklist: new ReferenceExpression(
                accountObjectType.fields.industry.elemID,
                accountObjectType.fields.industry,
              ),
              values: [
                { fullName: 'val1', default: true },
                { fullName: 'val2', default: false },
              ],
            },
            // Field with valueSet
            {
              picklist: new ReferenceExpression(
                accountObjectType.fields.priority__c.elemID,
                accountObjectType.fields.priority__c,
              ),
              values: [
                { fullName: 'High', default: false },
                { fullName: 'VeryHigh', default: false },
                { fullName: 'Low', default: false },
                { fullName: 'High %26 Low', default: false },
                // Make sure the filter does not crash violently when trying to decode this URI value.
                // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent#catching_errors
                { fullName: 'Non %% Decode-able', default: false },
                // Make sure we handle the use-case where
              ],
            },
            // Field in old format
            {
              picklist: new ReferenceExpression(
                accountObjectType.fields.Old_Format_Picklist__c.elemID,
                accountObjectType.fields.Old_Format_Picklist__c,
              ),
              values: [
                { fullName: 'val1', default: false },
                { fullName: 'val2', default: false },
              ],
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
      // Do not pass svs to make sure we support targeted fetch as-well
      const elements = [recordType, recordTypeWithoutPicklistValues, gvs, accountObjectType]
      await filter.onFetch(elements)
    })

    describe('fetch: modify picklist values to reference expressions', () => {
      it('should create references to GlobalValueSet', async () => {
        expect(recordType.value.picklistValues[0].values).toEqual([
          {
            fullName: new ReferenceExpression(
              gvs.elemID.createNestedID('customValue', 'values', 'val1', 'fullName'),
              'val1',
            ),
            default: true,
          },
          {
            fullName: new ReferenceExpression(
              gvs.elemID.createNestedID('customValue', 'values', 'val2', 'fullName'),
              'val2',
            ),
            default: false,
          },
        ])
      })
      it('should create references to StandardValueSet', async () => {
        expect(recordType.value.picklistValues[1].values).toEqual([
          {
            fullName: new ReferenceExpression(
              svs.elemID.createNestedID('standardValue', 'values', 'val1', 'fullName'),
              'val1',
            ),
            default: true,
          },
          {
            fullName: new ReferenceExpression(
              svs.elemID.createNestedID('standardValue', 'values', 'val2', 'fullName'),
              'val2',
            ),
            default: false,
          },
        ])
      })
      it('should create references to Field valueSet value', async () => {
        expect(recordType.value.picklistValues[2].values).toEqual([
          {
            fullName: new ReferenceExpression(
              accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'High', 'fullName'),
              'High',
            ),
            default: false,
          },
          {
            fullName: 'VeryHigh',
            default: false,
          },
          {
            fullName: new ReferenceExpression(
              accountObjectType.fields.priority__c.elemID.createNestedID('valueSet', 'values', 'Low', 'fullName'),
              'Low',
            ),
            default: false,
          },
          {
            fullName: new ReferenceExpression(
              accountObjectType.fields.priority__c.elemID.createNestedID(
                'valueSet',
                'values',
                naclCase('High & Low'),
                'fullName',
              ),
              'High & Low',
            ),
            default: false,
          },
          {
            fullName: 'Non %% Decode-able',
            default: false,
          },
        ])
      })
      it('should not create references to Field in the old format (Array of values instead of map)', async () => {
        expect(recordType.value.picklistValues[3].values).toEqual([
          { fullName: 'val1', default: false },
          { fullName: 'val2', default: false },
        ])
      })
    })
  })
  describe('BusinessProcess instances', () => {
    let businessProcess: InstanceElement
    let valueSet: InstanceElement

    describe('when BusinessProcess parent is ont supported', () => {
      beforeEach(() => {
        const parentObjectType = createCustomObjectType('NotSupported', {})
        businessProcess = new InstanceElement(
          'NotSupported_BusinessProcess',
          mockTypes.BusinessProcess,
          {
            [INSTANCE_FULL_NAME_FIELD]: 'NotSupported.BusinessProcess',
            values: [{ fullName: 'val1' }, { fullName: 'val2' }],
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentObjectType.elemID, parentObjectType)],
          },
        )
        valueSet = new InstanceElement('NotSupportedValueSet', mockTypes.StandardValueSet, {
          standardValue: {
            values: {
              val1: { fullName: 'val1' },
              val2: { fullName: 'val2' },
            },
          },
        })
      })
      it('should not create references', async () => {
        await filter.onFetch([businessProcess, valueSet])
        expect(businessProcess.value.values).toEqual([{ fullName: 'val1' }, { fullName: 'val2' }])
      })
    })

    const businessProcessParentToValueSetName: Record<BusinessProcessParent, string> = {
      Lead: 'LeadStatus',
      Opportunity: 'OpportunityStage',
      Case: 'CaseStatus',
    }
    describe.each(BUSINESS_PROCESS_PARENTS)('%s BusinessProcess', parent => {
      beforeEach(() => {
        const parentObjectType = createCustomObjectType(parent, {})
        businessProcess = new InstanceElement(
          `${parent}_BusinessProcess`,
          mockTypes.BusinessProcess,
          {
            [INSTANCE_FULL_NAME_FIELD]: `${parent}.BusinessProcess`,
            values: [
              { fullName: 'val1' },
              { fullName: 'val2' },
              // Make sure we make the references by encoding the RecordType Picklist values
              { fullName: 'High %26 Low' },
              // Make sure the filter does not crash violently when trying to decode this URI value.
              // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent#catching_errors
              { fullName: 'Non %% Decode-able' },
            ],
          },
          undefined,
          {
            [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentObjectType.elemID, parentObjectType)],
          },
        )
      })
      describe('when the StandardValueSet is in the old format (not OrderedMap)', () => {
        valueSet = new InstanceElement(businessProcessParentToValueSetName[parent], mockTypes.StandardValueSet, {
          standardValue: [{ fullName: 'val1' }, { fullName: 'val2' }, { fullName: 'High & Low' }],
        })
        it('should not create references', async () => {
          await filter.onFetch([businessProcess, valueSet])
          expect(businessProcess.value.values).toEqual([
            { fullName: 'val1' },
            { fullName: 'val2' },
            { fullName: 'High %26 Low' },
            { fullName: 'Non %% Decode-able' },
          ])
        })
      })
      describe('when the StandardValueSet is in the new format (OrderedMap)', () => {
        beforeEach(() => {
          valueSet = new InstanceElement(businessProcessParentToValueSetName[parent], mockTypes.StandardValueSet, {
            standardValue: {
              values: {
                val1: { fullName: 'val1' },
                val2: { fullName: 'val2' },
                [naclCase('High & Low')]: { fullName: 'High & Low' },
              },
            },
          })
        })
        it('should create references', async () => {
          await filter.onFetch([businessProcess, valueSet])
          expect(businessProcess.value.values).toEqual([
            {
              fullName: new ReferenceExpression(
                valueSet.elemID.createNestedID('standardValue', 'values', 'val1', 'fullName'),
                'val1',
              ),
            },
            {
              fullName: new ReferenceExpression(
                valueSet.elemID.createNestedID('standardValue', 'values', 'val2', 'fullName'),
                'val2',
              ),
            },
            {
              fullName: new ReferenceExpression(
                valueSet.elemID.createNestedID('standardValue', 'values', naclCase('High & Low'), 'fullName'),
                'High & Low',
              ),
            },
            { fullName: 'Non %% Decode-able' },
          ])
        })
      })
    })
  })
})
