/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections, strings } from '@salto-io/lowerdash'
import {
  Adapter,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  TargetedFetchType,
  TargetedFetchTypeWithPath,
} from '@salto-io/adapter-api'
import { remoteMap, Workspace } from '@salto-io/workspace'
import { createMockAdapter } from '../../common/helpers'
import { mockWorkspace } from '../../common/workspace'
import {
  getAccountTargetedFetchTypes,
  getElementsTargetedFetchTypes,
} from '../../../src/core/adapters/targeted_fetch_types'

const { awu } = collections.asynciterable
const { capitalizeFirstLetter } = strings

describe('targeted fetch types', () => {
  let workspace: Workspace
  let mockAdapter: jest.Mocked<Required<Adapter>>
  let mockAliasesMap: jest.Mocked<remoteMap.ReadOnlyRemoteMap<string>>

  beforeEach(() => {
    const saltoType = new ObjectType({ elemID: new ElemID('salto', 'someType') })
    const salto2Type = new ObjectType({ elemID: new ElemID('salto2', 'someType2') })

    const saltoInstance = new InstanceElement('instance1', saltoType)
    const salto2Instance = new InstanceElement('instance2', salto2Type)

    const elements = [saltoType, salto2Type, saltoInstance, salto2Instance]

    const accountConfigs = {
      salto: new InstanceElement(ElemID.CONFIG_NAME, new ObjectType({ elemID: new ElemID('salto') }), {
        extra: [{ group: 'extra', name: 'salto', path: ['Extra Salto'] }],
      }),
      salto2: new InstanceElement(ElemID.CONFIG_NAME, new ObjectType({ elemID: new ElemID('salto2') }), {
        extra: [{ group: 'extra', name: 'salto2', path: ['Extra Salto2'] }],
      }),
    }

    const accountToServiceName = {
      salto: 'salto',
      salto2: 'salto',
      salto3: 'salto',
    }

    mockAliasesMap = {
      get: jest.fn(),
      has: jest.fn(),
      values: jest.fn(),
      entries: jest.fn(),
    }

    workspace = mockWorkspace({
      accountConfigs,
      elements,
      accountToServiceName,
      aliasRemoteMap: mockAliasesMap,
    })

    mockAdapter = createMockAdapter('salto')
  })

  describe('getAccountTargetedFetchTypes', () => {
    let result: TargetedFetchTypeWithPath[] | undefined

    beforeEach(() => {
      mockAdapter.getTargetedFetchTypes.mockImplementation(async ({ elementsSource, adapterConfig, getAlias }) =>
        awu(await elementsSource.list())
          .map(async elemId => ({
            group: elemId.adapter,
            name: elemId.idType === 'type' ? elemId.name : `${elemId.typeName}.${elemId.name}`,
            path: [(await getAlias(elemId)) ?? ''],
          }))
          .concat(adapterConfig.value.extra)
          .toArray(),
      )
      mockAliasesMap.get.mockImplementation(async key => capitalizeFirstLetter(ElemID.fromFullName(key).name))
    })

    describe('when called with account name that is the adapter name', () => {
      beforeEach(async () => {
        result = await getAccountTargetedFetchTypes({
          account: 'salto',
          workspace,
          adapterCreators: { salto: mockAdapter },
        })
      })

      it('should run with the account config and elements source', () => {
        expect(result).toEqual([
          {
            group: 'salto',
            name: 'someType',
            path: ['SomeType'],
          },
          {
            group: 'salto',
            name: 'someType.instance1',
            path: ['Instance1'],
          },
          {
            group: 'extra',
            name: 'salto',
            path: ['Extra Salto'],
          },
        ])
      })

      it('should call alias map with elemIds of the account', () => {
        expect(mockAliasesMap.get).toHaveBeenCalledTimes(2)
        expect(mockAliasesMap.get).toHaveBeenCalledWith('salto.someType')
        expect(mockAliasesMap.get).toHaveBeenCalledWith('salto.someType.instance.instance1')
      })
    })

    describe('when called with account name that is different from the adapter name', () => {
      beforeEach(async () => {
        result = await getAccountTargetedFetchTypes({
          account: 'salto2',
          workspace,
          adapterCreators: { salto: mockAdapter },
        })
      })

      it('should run with the account config and elements source with replaced adapter', () => {
        expect(result).toEqual([
          {
            group: 'salto',
            name: 'someType2',
            path: ['SomeType2'],
          },
          {
            group: 'salto',
            name: 'someType2.instance2',
            path: ['Instance2'],
          },
          {
            group: 'extra',
            name: 'salto2',
            path: ['Extra Salto2'],
          },
        ])
      })

      it('should call alias map with elemIds of the account', () => {
        expect(mockAliasesMap.get).toHaveBeenCalledTimes(2)
        expect(mockAliasesMap.get).toHaveBeenCalledWith('salto2.someType2')
        expect(mockAliasesMap.get).toHaveBeenCalledWith('salto2.someType2.instance.instance2')
      })
    })

    describe('when an account has no config', () => {
      it('should return undefined', async () => {
        result = await getAccountTargetedFetchTypes({
          account: 'salto3',
          workspace,
          adapterCreators: { salto: mockAdapter },
        })
        expect(result).toBeUndefined()
        expect(mockAdapter.getTargetedFetchTypes).not.toHaveBeenCalled()
      })
    })

    describe('when an adapter has no getTargetedFetchTypes function', () => {
      it('should return undefined', async () => {
        result = await getAccountTargetedFetchTypes({
          account: 'salto',
          workspace,
          adapterCreators: { salto: _.omit(mockAdapter, 'getTargetedFetchTypes') },
        })
        expect(result).toBeUndefined()
        expect(mockAdapter.getTargetedFetchTypes).not.toHaveBeenCalled()
      })
    })
  })

  describe('getElementsTargetedFetchTypes', () => {
    let result: Record<string, TargetedFetchType[] | undefined>
    let accountsElementsSource: Record<string, ReadOnlyElementsSource>

    beforeEach(() => {
      accountsElementsSource = {}

      mockAdapter.getElementsTargetedFetchTypes.mockImplementation(async ({ elemIds, elementsSource }) => {
        const account = elemIds.find(elemId => elemId.name === 'instance1') ? 'salto' : 'salto2'
        accountsElementsSource[account] = elementsSource

        return elemIds.map(elemId => ({
          group: elemId.adapter,
          name: elemId.idType === 'type' ? elemId.name : `${elemId.typeName}.${elemId.name}`,
        }))
      })
    })

    describe('when run on several accounts', () => {
      beforeEach(async () => {
        result = await getElementsTargetedFetchTypes({
          elemIds: [
            new ElemID('salto', 'someType'),
            new ElemID('salto', 'someType', 'instance', 'instance1'),
            new ElemID('salto2', 'someType2'),
            new ElemID('salto2', 'someType2', 'instance', 'instance2'),
          ],
          workspace,
          adapterCreators: {
            salto: mockAdapter,
          },
        })
      })

      it('should return results for all accounts', () => {
        expect(result).toEqual({
          salto: [
            {
              group: 'salto',
              name: 'someType',
            },
            {
              group: 'salto',
              name: 'someType.instance1',
            },
          ],
          salto2: [
            {
              group: 'salto',
              name: 'someType2',
            },
            {
              group: 'salto',
              name: 'someType2.instance2',
            },
          ],
        })
      })

      it('should run each call with the element ids of the account', () => {
        expect(mockAdapter.getElementsTargetedFetchTypes).toHaveBeenCalledTimes(2)
        expect(mockAdapter.getElementsTargetedFetchTypes).toHaveBeenCalledWith(
          expect.objectContaining({
            elemIds: [new ElemID('salto', 'someType'), new ElemID('salto', 'someType', 'instance', 'instance1')],
          }),
        )
        expect(mockAdapter.getElementsTargetedFetchTypes).toHaveBeenCalledWith(
          expect.objectContaining({
            elemIds: [new ElemID('salto', 'someType2'), new ElemID('salto', 'someType2', 'instance', 'instance2')],
          }),
        )
      })

      it('should run each call with the elementsSource of the account with replaced adapter', async () => {
        expect(await awu(await accountsElementsSource.salto.list()).toArray()).toEqual([
          new ElemID('salto', 'someType'),
          new ElemID('salto', 'someType', 'instance', 'instance1'),
        ])
        expect(await awu(await accountsElementsSource.salto2.list()).toArray()).toEqual([
          new ElemID('salto', 'someType2'),
          new ElemID('salto', 'someType2', 'instance', 'instance2'),
        ])
      })
    })

    describe('when an adapter has no getElementsTargetedFetchTypes function', () => {
      it('should return undefined for each account', async () => {
        result = await getElementsTargetedFetchTypes({
          elemIds: [
            new ElemID('salto', 'someType'),
            new ElemID('salto', 'someType', 'instance', 'instance1'),
            new ElemID('salto2', 'someType2'),
            new ElemID('salto2', 'someType2', 'instance', 'instance2'),
          ],
          workspace,
          adapterCreators: {
            salto: _.omit(mockAdapter, 'getElementsTargetedFetchTypes'),
          },
        })
        expect(result).toEqual({
          salto: undefined,
          salto2: undefined,
        })
        expect(mockAdapter.getElementsTargetedFetchTypes).not.toHaveBeenCalled()
      })
    })
  })
})
