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
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  PartialFetchTarget,
  PartialFetchTargetWithPath,
} from '@salto-io/adapter-api'
import { remoteMap, Workspace } from '@salto-io/workspace'
import { createMockAdapter } from '../../common/helpers'
import { mockWorkspace } from '../../common/workspace'
import {
  getAccountPartialFetchTargets,
  getPartialFetchTargetsForElements,
} from '../../../src/core/adapters/partial_fetch_targets'

const { awu } = collections.asynciterable
const { capitalizeFirstLetter } = strings

describe('partial fetch targets', () => {
  let workspace: Workspace
  let mockAdapter: ReturnType<typeof createMockAdapter>
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

  describe('partialFetch.getAllTargets', () => {
    let result: PartialFetchTargetWithPath[] | undefined

    beforeEach(() => {
      mockAdapter.partialFetch.getAllTargets.mockImplementation(async ({ elementsSource, config, getAlias }) =>
        awu(await elementsSource.list())
          .map(async elemId => ({
            group: elemId.adapter,
            name: elemId.idType === 'type' ? elemId.name : `${elemId.typeName}.${elemId.name}`,
            path: [(await getAlias(elemId)) ?? ''],
          }))
          .concat(config?.value.extra)
          .toArray(),
      )
      mockAliasesMap.get.mockImplementation(async key => capitalizeFirstLetter(ElemID.fromFullName(key).name))
    })

    describe('when called with account name that is the adapter name', () => {
      beforeEach(async () => {
        result = await getAccountPartialFetchTargets({
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
        result = await getAccountPartialFetchTargets({
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

    describe('when an adapter has no partialFetch.getAllTargets function', () => {
      it('should return undefined', async () => {
        result = await getAccountPartialFetchTargets({
          account: 'salto',
          workspace,
          adapterCreators: { salto: _.omit(mockAdapter, 'partialFetch') },
        })
        expect(result).toBeUndefined()
        expect(mockAdapter.partialFetch.getAllTargets).not.toHaveBeenCalled()
      })
    })
  })

  describe('partialFetch.getTargetsForElements', () => {
    let result: Record<string, PartialFetchTarget[] | undefined>
    let accountsElementsSource: Record<string, ReadOnlyElementsSource>

    beforeEach(() => {
      accountsElementsSource = {}

      mockAdapter.partialFetch.getTargetsForElements.mockImplementation(async ({ elemIds, elementsSource }) => {
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
        result = await getPartialFetchTargetsForElements({
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
        expect(mockAdapter.partialFetch.getTargetsForElements).toHaveBeenCalledTimes(2)
        expect(mockAdapter.partialFetch.getTargetsForElements).toHaveBeenCalledWith(
          expect.objectContaining({
            elemIds: [new ElemID('salto', 'someType'), new ElemID('salto', 'someType', 'instance', 'instance1')],
          }),
        )
        expect(mockAdapter.partialFetch.getTargetsForElements).toHaveBeenCalledWith(
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

    describe('when an adapter has no partialFetch.getTargetsForElements function', () => {
      it('should return undefined for each account', async () => {
        result = await getPartialFetchTargetsForElements({
          elemIds: [
            new ElemID('salto', 'someType'),
            new ElemID('salto', 'someType', 'instance', 'instance1'),
            new ElemID('salto2', 'someType2'),
            new ElemID('salto2', 'someType2', 'instance', 'instance2'),
          ],
          workspace,
          adapterCreators: { salto: _.omit(mockAdapter, 'partialFetch') },
        })
        expect(result).toEqual({
          salto: undefined,
          salto2: undefined,
        })
        expect(mockAdapter.partialFetch.getTargetsForElements).not.toHaveBeenCalled()
      })
    })
  })
})
