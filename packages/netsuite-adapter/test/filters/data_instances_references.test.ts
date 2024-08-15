/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/data_instances_references'
import NetsuiteClient from '../../src/client/client'
import { NETSUITE } from '../../src/constants'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../utils'

describe('data_instances_references', () => {
  const firstType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'firstType'),
    fields: {
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
    annotations: { source: 'soap' },
  })
  const secondType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'secondType'),
    fields: {
      field: { refType: firstType },
      recordRefList: { refType: new ListType(firstType), annotations: { isReference: true } },
    },
    annotations: { source: 'soap' },
  })
  describe('onFetch', () => {
    it('should replace with reference', async () => {
      const instance = new InstanceElement('instance', secondType, { field: { internalId: '1' } })

      const referencedInstance = new InstanceElement('referencedInstance', firstType, { internalId: '1' })

      const filterOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(filterOpts).onFetch?.([instance, referencedInstance])
      expect((instance.value.field as ReferenceExpression).elemID.getFullName()).toBe(
        referencedInstance.elemID.getFullName(),
      )
    })

    it('should change nothing if reference was not found', async () => {
      const instance = new InstanceElement('instance', secondType, { field: { internalId: '1' } })

      const fetchOpts = {
        elements: [instance],
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(fetchOpts).onFetch?.([instance])
      expect(instance.value.field.internalId).toBe('1')
    })

    it('should use the elementsSource if partial', async () => {
      const instance = new InstanceElement('instance', secondType, { field: { internalId: '1' } })

      const referencedInstance = new InstanceElement('referencedInstance', firstType, { internalId: '1' })

      const fetchOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () =>
            Promise.resolve({
              ...createEmptyElementsSourceIndexes(),
              internalIdsIndex: {
                'firstType-1': referencedInstance.elemID,
              },
            }),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: true,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(fetchOpts).onFetch?.([instance])
      expect((instance.value.field as ReferenceExpression).elemID.getFullName()).toBe(
        referencedInstance.elemID.getFullName(),
      )
    })

    it('should replace recordRefList references', async () => {
      const instance = new InstanceElement('instance', secondType, {
        recordRefList: { recordRef: [{ internalId: '1' }] },
      })

      const referencedInstance = new InstanceElement('referencedInstance', firstType, { internalId: '1' })

      const fetchOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(fetchOpts).onFetch?.([instance, referencedInstance])
      expect((instance.value.recordRefList[0] as ReferenceExpression).elemID.getFullName()).toBe(
        referencedInstance.elemID.getFullName(),
      )
    })
  })

  describe('preDeploy', () => {
    it('should replace references with ids', async () => {
      const referencedInstance = new InstanceElement('referencedInstance', firstType, { internalId: '1' })

      const instance = new InstanceElement('instance', secondType, {
        field: new ReferenceExpression(referencedInstance.elemID, referencedInstance),
      })

      const fetchOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(fetchOpts).preDeploy?.([toChange({ before: instance, after: instance })])
      expect(instance.value).toEqual({
        field: {
          internalId: '1',
        },
      })
    })

    it('should replace references array with ids', async () => {
      const referencedInstance = new InstanceElement('referencedInstance', firstType, { internalId: '1' })

      const instance = new InstanceElement('instance', secondType, {
        recordRefList: [new ReferenceExpression(referencedInstance.elemID, referencedInstance)],
      })

      const fetchOpts = {
        client: {} as NetsuiteClient,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
      await filterCreator(fetchOpts).preDeploy?.([
        toChange({ before: instance, after: instance }),
        toChange({ before: firstType, after: firstType }),
      ])
      expect(instance.value).toEqual({
        recordRefList: {
          'platformCore:recordRef': [
            {
              attributes: { internalId: '1' },
            },
          ],
        },
      })
    })
  })
})
