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
import { BuiltinTypes, Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, filter } from '@salto-io/adapter-utils'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, WORKFLOW } from '../../src/constants'
import excludeCustomRecordTypes from '../../src/filters/exclude_by_criteria/exclude_custom_record_types'
import excludeInstances from '../../src/filters/exclude_by_criteria/exclude_instances'
import { LocalFilterOpts } from '../../src/filter'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'

const filters = [excludeCustomRecordTypes, excludeInstances]

describe('exclude by criteria filter', () => {
  let filterOpts: LocalFilterOpts
  let standardType: ObjectType
  let otherType: ObjectType
  let customRecordType: ObjectType
  let customRecordTypeToExclude: ObjectType
  let instanceToExclude: InstanceElement
  let otherTypeInstance: InstanceElement
  let noMatchInstance: InstanceElement
  let customRecordInstance: InstanceElement
  let customRecordInstanceToExclude: InstanceElement
  let elements: Element[]

  beforeEach(async () => {
    standardType = new ObjectType({ elemID: new ElemID(NETSUITE, WORKFLOW) })
    otherType = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    customRecordTypeToExclude = new ObjectType({
      elemID: new ElemID(NETSUITE, 'custrecord2'),
      annotations: {
        scriptid: 'custrecord2',
        test: true,
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'custrecord1'),
      fields: {
        custom_field: { refType: customRecordTypeToExclude },
      },
      annotations: {
        scriptid: 'custrecord1',
        test: false,
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    instanceToExclude = new InstanceElement('workflow1', standardType, {
      scriptid: 'workflow1',
      test: true,
    })
    otherTypeInstance = new InstanceElement('someInstance', otherType, {
      name: 'some instance',
      test: true,
    })
    noMatchInstance = new InstanceElement('workflow2', standardType, {
      scriptid: 'workflow2',
      test: false,
    })
    customRecordInstance = new InstanceElement('val_123', customRecordTypeToExclude, {
      scriptid: 'val_123',
      test: false,
    })
    customRecordInstanceToExclude = new InstanceElement('val_456', customRecordType, {
      scriptid: 'val_456',
      test: true,
    })
    elements = [
      customrecordtypeType().type,
      standardType,
      otherType,
      customRecordType,
      customRecordTypeToExclude,
      instanceToExclude,
      otherTypeInstance,
      noMatchInstance,
      customRecordInstance,
      customRecordInstanceToExclude,
    ]
    filterOpts = {
      elementsSourceIndex: {
        getIndexes: async () => createEmptyElementsSourceIndexes(),
      },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })
  it('should quick return when there are no criteria', async () => {
    const elementsLength = elements.length
    await filter.filtersRunner(filterOpts, filters).onFetch?.(elements)
    expect(elements.length).toEqual(elementsLength)
  })
  it('should exclude instance by criteria', async () => {
    filterOpts.config.fetch.exclude.types.push({
      name: WORKFLOW,
      criteria: { test: true },
    })
    const elementsLength = elements.length
    await filter.filtersRunner(filterOpts, filters).onFetch?.(elements)
    expect(elements.length).toEqual(elementsLength - 1)
    expect(elements.find(elem => elem.elemID.isEqual(instanceToExclude.elemID))).toBeUndefined()
  })
  it('should exclude instance by complex criteria', async () => {
    filterOpts.config.fetch.exclude.types.push({
      name: '.*',
      criteria: {
        scriptid: 'workflow.*',
        test: true,
      },
    })
    const elementsLength = elements.length
    await filter.filtersRunner(filterOpts, filters).onFetch?.(elements)
    expect(elements.length).toEqual(elementsLength - 1)
    expect(elements.find(elem => elem.elemID.isEqual(instanceToExclude.elemID))).toBeUndefined()
  })
  it('should exclude custom record type by criteria with its instances', async () => {
    filterOpts.config.fetch.exclude.types.push({
      name: CUSTOM_RECORD_TYPE,
      criteria: { test: true },
    })
    const elementsLength = elements.length
    await filter.filtersRunner(filterOpts, filters).onFetch?.(elements)
    expect(elements.length).toEqual(elementsLength - 2)
    expect(elements.find(elem => elem.elemID.isEqual(customRecordTypeToExclude.elemID))).toBeUndefined()
    expect(elements.find(elem => elem.elemID.isEqual(customRecordInstance.elemID))).toBeUndefined()
    expect(customRecordType.fields.custom_field.refType.elemID.isEqual(BuiltinTypes.UNKNOWN.elemID)).toBeTruthy()
  })
  it('should exclude custom record instance by criteria', async () => {
    filterOpts.config.fetch.exclude.customRecords = [
      {
        name: '.*',
        criteria: { test: true },
      },
    ]
    const elementsLength = elements.length
    await filter.filtersRunner(filterOpts, filters).onFetch?.(elements)
    expect(elements.length).toEqual(elementsLength - 1)
    expect(elements.find(elem => elem.elemID.isEqual(customRecordInstanceToExclude.elemID))).toBeUndefined()
  })
})
