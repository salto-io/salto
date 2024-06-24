/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  ElemID,
  Element,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  createRefToElmWithValue,
  isInstanceElement,
  isObjectType,
  isReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, naclCase } from '@salto-io/adapter-utils'
import { FILE, NETSUITE, RECORD_REF } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { fullFetchConfig } from '../../src/config/config_creator'
import { INTERNAL_IDS_MAP, SUITEQL_TABLE } from '../../src/data_elements/suiteql_table_elements'
import filterCreator, {
  UNKNOWN_TYPE_REFERENCES_ELEM_ID,
  UNKNOWN_TYPE_REFERENCES_TYPE_NAME,
} from '../../src/filters/data_account_specific_values'

describe('data account specific values filter', () => {
  let dataType: ObjectType
  let accountType: ObjectType
  let fileType: ObjectType
  let recordRefType: ObjectType
  let suiteQLTableType: ObjectType
  let suiteQLTableInstance: InstanceElement
  let taxScheduleSuiteQLTableInstance: InstanceElement
  let unknownTypeReferencesType: ObjectType
  let existingUnknownTypeReferencesInstance: InstanceElement
  let filterOpts: LocalFilterOpts

  beforeEach(async () => {
    accountType = new ObjectType({ elemID: new ElemID(NETSUITE, 'account') })
    fileType = new ObjectType({ elemID: new ElemID(NETSUITE, FILE) })
    recordRefType = new ObjectType({ elemID: new ElemID(NETSUITE, RECORD_REF) })
    dataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'someType'),
      fields: {
        accountField: { refType: accountType },
        fileField: { refType: fileType },
        taxSchedule: { refType: recordRefType },
      },
      annotations: { source: 'soap' },
    })
    suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    suiteQLTableInstance = new InstanceElement('account', suiteQLTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'Account 1' },
      },
    })
    taxScheduleSuiteQLTableInstance = new InstanceElement('taxSchedule', suiteQLTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'Tax Schedule 1' },
      },
    })
    unknownTypeReferencesType = new ObjectType({ elemID: UNKNOWN_TYPE_REFERENCES_ELEM_ID })
    existingUnknownTypeReferencesInstance = new InstanceElement(ElemID.CONFIG_NAME, unknownTypeReferencesType, {
      [naclCase('someType.someField.inner')]: {
        789: 'Value 789',
      },
    })
    filterOpts = {
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([
        suiteQLTableType,
        suiteQLTableInstance,
        unknownTypeReferencesType,
        existingUnknownTypeReferencesInstance,
      ]),
      isPartial: false,
      config: {
        fetch: {
          ...fullFetchConfig(),
          resolveAccountSpecificValues: true,
        },
      },
    }
  })

  describe('on fetch', () => {
    let dataInstance: InstanceElement
    let elements: Element[]

    beforeEach(() => {
      dataInstance = new InstanceElement('instance', dataType, {
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
          internalId: '1',
        },
        accountField: {
          internalId: '1',
        },
        customField: {
          name: 'Account 2',
          internalId: '2',
          typeId: '-112',
        },
        someField: {
          inner: {
            name: 'Value 123',
            internalId: '123',
          },
        },
        listField: [
          {
            name: 'Value 456',
            internalId: '456',
          },
        ],
        taxSchedule: {
          internalId: '1',
        },
      })
      elements = [dataType, dataInstance, suiteQLTableType, suiteQLTableInstance, taxScheduleSuiteQLTableInstance]
    })

    it('should transform references to ACCOUNT_SPECIFIC_VALUE', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(dataInstance.value).toEqual({
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
        },
        accountField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 1)',
        },
        customField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 2)',
        },
        someField: {
          inner: {
            id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)',
          },
        },
        listField: [
          {
            id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 456)',
          },
        ],
        taxSchedule: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (taxSchedule) (Tax Schedule 1)',
        },
      })
    })

    it('should add missing internalId-to-name mapping', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(suiteQLTableInstance.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Account 1' },
          2: { name: 'Account 2' },
        },
      })
      const unknownTypeReferencesInstance = elements
        .filter(isInstanceElement)
        .find(instance => instance.elemID.typeName === UNKNOWN_TYPE_REFERENCES_TYPE_NAME)
      expect(unknownTypeReferencesInstance?.value).toEqual({
        [naclCase('someType.someField.inner')]: {
          123: 'Value 123',
        },
        [naclCase('someType.listField.*')]: {
          456: 'Value 456',
        },
      })
    })

    it('should use one name for the same internal id', async () => {
      dataInstance.value.accountField.name = 'Other Name'
      const anotherDataInstance = new InstanceElement('another', dataType, {
        someField: {
          inner: {
            name: 'Another Value 123',
            internalId: '123',
          },
        },
      })
      elements.push(anotherDataInstance)
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(dataInstance.value.accountField.id).toEqual('[ACCOUNT_SPECIFIC_VALUE] (account) (Account 1)')
      expect(dataInstance.value.someField.inner.id).toEqual('[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)')
      expect(anotherDataInstance.value.someField.inner.id).toEqual('[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)')
      expect(suiteQLTableInstance.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Account 1' },
          2: { name: 'Account 2' },
        },
      })
      const unknownTypeReferencesInstance = elements
        .filter(isInstanceElement)
        .find(instance => instance.elemID.typeName === UNKNOWN_TYPE_REFERENCES_TYPE_NAME)
      expect(unknownTypeReferencesInstance?.value).toEqual({
        [naclCase('someType.someField.inner')]: {
          123: 'Value 123',
        },
        [naclCase('someType.listField.*')]: {
          456: 'Value 456',
        },
      })
    })

    it('should use "unknown" when name field is undefined', async () => {
      delete dataInstance.value.customField.name
      delete dataInstance.value.someField.inner.name
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(dataInstance.value.customField.id).toEqual('[ACCOUNT_SPECIFIC_VALUE] (account) (unknown object)')
      expect(dataInstance.value.someField.inner.id).toEqual('[ACCOUNT_SPECIFIC_VALUE] (object) (unknown object)')
    })

    it('should add reference types and replace field types', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      const referenceType = elements.filter(isObjectType).find(type => type.annotations.originalType !== undefined)
      expect(referenceType).toBeDefined()
      expect(
        isReferenceExpression(referenceType?.annotations.originalType) &&
          referenceType?.annotations.originalType.elemID,
      ).toEqual(fileType.elemID)
      expect(dataType.fields.fileField.refType.elemID).toEqual(referenceType?.elemID)
    })

    it('should use existing unknown type references instance on partial fetch', async () => {
      filterOpts.isPartial = true
      await filterCreator(filterOpts).onFetch?.(elements)
      const unknownTypeReferencesInstance = elements
        .filter(isInstanceElement)
        .find(instance => instance.elemID.typeName === UNKNOWN_TYPE_REFERENCES_TYPE_NAME)
      expect(unknownTypeReferencesInstance?.value).toEqual({
        [naclCase('someType.someField.inner')]: {
          123: 'Value 123',
          789: 'Value 789',
        },
        [naclCase('someType.listField.*')]: {
          456: 'Value 456',
        },
      })
    })

    it('should do nothing if fetch.resolveAccountSpecificValues is false', async () => {
      filterOpts.config.fetch.resolveAccountSpecificValues = false
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(dataInstance.value).toEqual({
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
          internalId: '1',
        },
        accountField: {
          internalId: '1',
        },
        customField: {
          name: 'Account 2',
          internalId: '2',
          typeId: '-112',
        },
        someField: {
          inner: {
            name: 'Value 123',
            internalId: '123',
          },
        },
        listField: [
          {
            name: 'Value 456',
            internalId: '456',
          },
        ],
        taxSchedule: {
          internalId: '1',
        },
      })
    })
  })

  describe('pre deploy', () => {
    let dataInstance: InstanceElement

    beforeEach(() => {
      const referenceType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'fileReference'),
        annotations: {
          originalType: new ReferenceExpression(fileType.elemID, fileType),
        },
      })
      dataType.fields.fileField.refType = createRefToElmWithValue(referenceType)
      dataInstance = new InstanceElement('instance', dataType, {
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
        },
        accountField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 1)',
        },
        customField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 2)',
        },
        someField: {
          inner: {
            id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)',
          },
        },
        listField: [
          {
            id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 456)',
          },
        ],
        fileField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (File Reference)',
        },
      })
      suiteQLTableInstance.value = {
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Account 1' },
          2: { name: 'Account 2' },
        },
      }
      existingUnknownTypeReferencesInstance.value = {
        [naclCase('someType.someField.inner')]: {
          123: 'Value 123',
        },
        [naclCase('someType.listField.*')]: {
          456: 'Value 456',
        },
        [naclCase('someType.fileField')]: {
          1010: 'File Reference',
        },
      }
    })

    it('should resolve all ACCOUNT_SPECIFIC_VALUE', async () => {
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: dataInstance })])
      expect(dataInstance.value).toEqual({
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
        },
        accountField: {
          internalId: '1',
        },
        customField: {
          internalId: '2',
        },
        someField: {
          inner: {
            internalId: '123',
          },
        },
        listField: [
          {
            internalId: '456',
          },
        ],
        fileField: {
          internalId: '1010',
        },
      })
    })

    it('should set original field types', async () => {
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: dataInstance })])
      expect(dataType.fields.fileField.refType.elemID).toEqual(fileType.elemID)
    })

    it('should use edited id as internalId', async () => {
      dataInstance.value.accountField.id = '5'
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: dataInstance })])
      expect(dataInstance.value.accountField.internalId).toEqual('5')
    })

    it('should remove value if ACCOUNT_SPECIFIC_VALUE is unresolved', async () => {
      dataInstance.value.accountField.id = '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 5)'
      dataInstance.value.customField.id = '[ACCOUNT_SPECIFIC_VALUE] (employee) (Account 5)'
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: dataInstance })])
      expect(dataInstance.value).toEqual({
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
        },
        someField: {
          inner: {
            internalId: '123',
          },
        },
        listField: [
          {
            internalId: '456',
          },
        ],
        fileField: {
          internalId: '1010',
        },
      })
    })

    it('should do nothing if fetch.resolveAccountSpecificValues is false', async () => {
      filterOpts.config.fetch.resolveAccountSpecificValues = false
      await filterCreator(filterOpts).preDeploy?.([toChange({ after: dataInstance })])
      expect(dataInstance.value).toEqual({
        mainAddress: {
          country: '_unitedStates',
          state: 'CA',
        },
        accountField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 1)',
        },
        customField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (account) (Account 2)',
        },
        someField: {
          inner: {
            id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 123)',
          },
        },
        listField: [
          {
            id: '[ACCOUNT_SPECIFIC_VALUE] (object) (Value 456)',
          },
        ],
        fileField: {
          id: '[ACCOUNT_SPECIFIC_VALUE] (object) (File Reference)',
        },
      })
    })
  })
})
