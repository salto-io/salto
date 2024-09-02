/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  TopLevelElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import NetsuiteClient from '../../src/client/client'
import {
  ADDITIONAL_QUERIES,
  INTERNAL_IDS_MAP,
  QUERIES_BY_TABLE_NAME,
  SUITEQL_TABLE,
  getSuiteQLTableElements,
  updateSuiteQLTableInstances,
} from '../../src/data_elements/suiteql_table_elements'
import { ALLOCATION_TYPE, NETSUITE, TAX_SCHEDULE } from '../../src/constants'
import { NetsuiteConfig } from '../../src/config/types'
import { fullFetchConfig } from '../../src/config/config_creator'

const NUM_OF_TYPES = 1
export const NUM_OF_SUITEQL_ELEMENTS =
  Object.values(QUERIES_BY_TABLE_NAME).filter(query => query !== undefined).length +
  Object.keys(ADDITIONAL_QUERIES).length +
  NUM_OF_TYPES

const runSuiteQLMock = jest.fn()
const runSavedSearchQueryMock = jest.fn()
const client = {
  runSuiteQL: runSuiteQLMock,
  runSavedSearchQuery: runSavedSearchQueryMock,
  isSuiteAppConfigured: () => true,
} as unknown as NetsuiteClient

describe('SuiteQL table elements', () => {
  let config: NetsuiteConfig
  let suiteQLTableType: ObjectType
  let suiteQLTableInstance: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  let result: { elements: TopLevelElement[] }

  beforeEach(() => {
    jest.clearAllMocks()
    config = {
      fetch: {
        ...fullFetchConfig(),
        resolveAccountSpecificValues: true,
      },
    }
    suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    suiteQLTableInstance = new InstanceElement(
      'currency',
      suiteQLTableType,
      {
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
      },
      undefined,
      { [CORE_ANNOTATIONS.HIDDEN]: true },
    )
    elementsSource = buildElementsSourceFromElements([suiteQLTableInstance])
  })

  it('should return new elements', async () => {
    result = await getSuiteQLTableElements(config, elementsSource, false)
    expect(result.elements).toHaveLength(NUM_OF_SUITEQL_ELEMENTS)
    expect(result.elements.every(element => element.annotations[CORE_ANNOTATIONS.HIDDEN] === true)).toBeTruthy()
    expect(result.elements.filter(isInstanceElement).every(instance => _.isEmpty(instance.value))).toBeTruthy()
  })

  it('should return existing elements when isPartial=true', async () => {
    result = await getSuiteQLTableElements(config, elementsSource, true)
    expect(result.elements).toHaveLength(NUM_OF_SUITEQL_ELEMENTS)
    expect(result.elements.every(element => element.annotations[CORE_ANNOTATIONS.HIDDEN] === true)).toBeTruthy()
    const existingInstances = result.elements.filter(isInstanceElement).filter(instance => !_.isEmpty(instance.value))
    expect(existingInstances).toHaveLength(1)
    expect(existingInstances[0].elemID.name).toEqual('currency')
    expect(existingInstances[0].value).toEqual({
      [INTERNAL_IDS_MAP]: {
        1: { name: 'Some name' },
        2: { name: 'Some name 2' },
        3: { name: 'Some name 3' },
      },
    })
  })

  it('should not return elements when fetch.resolveAccountSpecificValues=false', async () => {
    config.fetch.resolveAccountSpecificValues = false
    result = await getSuiteQLTableElements(config, elementsSource, true)
    expect(result.elements).toHaveLength(0)
  })

  describe('update suiteql table instances', () => {
    beforeEach(async () => {
      result = await getSuiteQLTableElements(config, elementsSource, true)
    })

    describe('query by internalId', () => {
      beforeEach(async () => {
        runSuiteQLMock.mockResolvedValue([
          { id: '3', name: 'Some name 3 - updated' },
          { id: '4', name: 'Some name 4' },
          { id: '5', name: 'Some name 5' },
        ])
        runSavedSearchQueryMock.mockImplementation(({ type, filters }) => {
          if (type !== 'resourceAllocation') {
            return [
              { internalid: [{ value: '1' }], name: 'Tax Schedule 1' },
              { internalid: [{ value: '2' }], name: 'Tax Schedule 2' },
              { internalid: [{ value: '3' }], name: 'Tax Schedule 3' },
            ]
          }
          if (_.isEqual(filters, [['allocationType', 'anyof', '1', '2']])) {
            return _.range(50).map(_i => ({
              allocationType: [
                {
                  value: '1',
                  text: 'Allocation Type 1',
                },
              ],
            }))
          }
          return [
            {
              allocationType: [
                {
                  value: '2',
                  text: 'Allocation Type 2',
                },
              ],
            },
          ]
        })
        await updateSuiteQLTableInstances({
          client,
          queryBy: 'internalId',
          itemsToQuery: [
            { tableName: 'currency', item: '3' },
            { tableName: 'currency', item: '4' },
            { tableName: 'currency', item: '5' },
            { tableName: 'taxSchedule', item: '1' },
            { tableName: 'taxSchedule', item: '2' },
            { tableName: 'taxSchedule', item: '3' },
            { tableName: 'allocationType', item: '1' },
            { tableName: 'allocationType', item: '2' },
            { tableName: 'item', item: '1' },
          ],
          suiteQLTablesMap: _.keyBy(result.elements.filter(isInstanceElement), instance => instance.elemID.name),
        })
      })

      it('should update instance values correctly', () => {
        expect(suiteQLTableInstance.value).toEqual({
          [INTERNAL_IDS_MAP]: {
            1: { name: 'Some name' },
            2: { name: 'Some name 2' },
            3: { name: 'Some name 3 - updated' },
            4: { name: 'Some name 4' },
            5: { name: 'Some name 5' },
          },
        })
      })

      it('should set tax schedule instance values correctly', () => {
        const taxScheduleInstance = result.elements
          .filter(isInstanceElement)
          .find(element => element.elemID.name === TAX_SCHEDULE)
        expect(taxScheduleInstance?.value).toEqual({
          [INTERNAL_IDS_MAP]: {
            1: { name: 'Tax Schedule 1' },
            2: { name: 'Tax Schedule 2' },
            3: { name: 'Tax Schedule 3' },
          },
        })
      })

      it('should set allocation type instance values correctly', () => {
        const allocationTypeInstance = result.elements
          .filter(isInstanceElement)
          .find(element => element.elemID.name === ALLOCATION_TYPE)
        expect(allocationTypeInstance?.value).toEqual({
          [INTERNAL_IDS_MAP]: {
            1: { name: 'Allocation Type 1' },
            2: { name: 'Allocation Type 2' },
          },
        })
      })

      it('should call runSuiteQL with right params', () => {
        expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
        expect(runSuiteQLMock).toHaveBeenCalledWith({
          from: 'currency',
          orderBy: 'id',
          select: 'id, name',
          where: "id in ('3', '4', '5')",
        })
        expect(runSuiteQLMock).toHaveBeenCalledWith({
          from: 'item',
          orderBy: 'id',
          select: 'id, itemid',
          where: "id in ('1')",
        })
      })

      it('should call runSavedSearch with right params', () => {
        expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(3)
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
          type: TAX_SCHEDULE,
          columns: ['internalid', 'name'],
          filters: [['internalid', 'anyof', '1', '2', '3']],
        })
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
          {
            type: 'resourceAllocation',
            columns: [ALLOCATION_TYPE],
            filters: [[ALLOCATION_TYPE, 'anyof', '1', '2']],
          },
          50,
        )
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
          {
            type: 'resourceAllocation',
            columns: [ALLOCATION_TYPE],
            filters: [[ALLOCATION_TYPE, 'anyof', '2']],
          },
          50,
        )
      })

      it('should not set values when name field do not match', () => {
        const instanceWithoutInternalIdsRecords = result.elements
          .filter(isInstanceElement)
          .find(element => element.elemID.name === 'item')
        expect(instanceWithoutInternalIdsRecords?.value).toEqual({
          [INTERNAL_IDS_MAP]: {},
        })
      })
    })

    describe('query by name', () => {
      beforeEach(async () => {
        runSuiteQLMock.mockResolvedValue([
          { id: '4', name: 'Some name 4' },
          { id: '5', name: 'Some name 5' },
        ])
        runSavedSearchQueryMock.mockImplementation(({ type, filters }) => {
          if (type !== 'resourceAllocation') {
            return [{ internalid: [{ value: '1' }], name: 'Tax Schedule 1' }]
          }
          if (_.isEmpty(filters)) {
            return _.range(50).map(_i => ({
              allocationType: [
                {
                  value: '1',
                  text: 'Allocation Type 1',
                },
              ],
            }))
          }
          return [
            {
              allocationType: [
                {
                  value: '2',
                  text: 'Allocation Type 2',
                },
              ],
            },
          ]
        })
        await updateSuiteQLTableInstances({
          client,
          queryBy: 'name',
          itemsToQuery: [
            { tableName: 'currency', item: 'Some name 4' },
            { tableName: 'currency', item: 'Some name 5' },
            { tableName: 'taxSchedule', item: 'Tax Schedule 1' },
            { tableName: 'taxSchedule', item: 'Tax Schedule 2' },
            { tableName: 'taxSchedule', item: 'Tax Schedule 3' },
            { tableName: 'allocationType', item: 'Allocation Type 2' },
            { tableName: 'item', item: 'Some item' },
          ],
          suiteQLTablesMap: _.keyBy(result.elements.filter(isInstanceElement), instance => instance.elemID.name),
        })
      })

      it('should update instance values correctly', () => {
        expect(suiteQLTableInstance.value).toEqual({
          [INTERNAL_IDS_MAP]: {
            1: { name: 'Some name' },
            2: { name: 'Some name 2' },
            3: { name: 'Some name 3' },
            4: { name: 'Some name 4' },
            5: { name: 'Some name 5' },
          },
        })
      })

      it('should set tax schedule instance values correctly', () => {
        const taxScheduleInstance = result.elements
          .filter(isInstanceElement)
          .find(element => element.elemID.name === TAX_SCHEDULE)
        expect(taxScheduleInstance?.value).toEqual({
          [INTERNAL_IDS_MAP]: {
            1: { name: 'Tax Schedule 1' },
          },
        })
      })

      it('should set allocation type instance values correctly', () => {
        const allocationTypeInstance = result.elements
          .filter(isInstanceElement)
          .find(element => element.elemID.name === ALLOCATION_TYPE)
        expect(allocationTypeInstance?.value).toEqual({
          [INTERNAL_IDS_MAP]: {
            2: { name: 'Allocation Type 2' },
          },
        })
      })

      it('should call runSuiteQL with right params', () => {
        expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
        expect(runSuiteQLMock).toHaveBeenCalledWith({
          from: 'currency',
          orderBy: 'id',
          select: 'id, name',
          where: "name in ('Some name 4', 'Some name 5')",
        })
        expect(runSuiteQLMock).toHaveBeenCalledWith({
          from: 'item',
          orderBy: 'id',
          select: 'id, itemid',
          where: "itemid in ('Some item')",
        })
      })

      it('should call runSavedSearch with right params', () => {
        expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(3)
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
          type: TAX_SCHEDULE,
          columns: ['internalid', 'name'],
          filters: [
            ['name', 'is', 'Tax Schedule 1'],
            'OR',
            ['name', 'is', 'Tax Schedule 2'],
            'OR',
            ['name', 'is', 'Tax Schedule 3'],
          ],
        })
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
          {
            type: 'resourceAllocation',
            columns: [ALLOCATION_TYPE],
            filters: [],
          },
          50,
        )
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
          {
            type: 'resourceAllocation',
            columns: [ALLOCATION_TYPE],
            filters: [[ALLOCATION_TYPE, 'noneof', '1']],
          },
          50,
        )
      })

      it('should not set values when name field do not match', () => {
        const instanceWithoutInternalIdsRecords = result.elements
          .filter(isInstanceElement)
          .find(element => element.elemID.name === 'item')
        expect(instanceWithoutInternalIdsRecords?.value).toEqual({
          [INTERNAL_IDS_MAP]: {},
        })
      })
    })
  })
})
