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
import filterCreator from '../../src/filters/data_instances_internal_id'
import { ACCOUNT_SPECIFIC_VALUE, NETSUITE } from '../../src/constants'
import { roleType } from '../../src/autogen/types/standard_types/role'
import { LocalFilterOpts } from '../../src/filter'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { getDefaultAdapterConfig } from '../utils'
import { getTypesToInternalId } from '../../src/data_elements/types'

describe('data_instances_internal_id', () => {
  let defaultOpts: LocalFilterOpts
  const recordRefType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'recordRef'),
    fields: {
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
  })
  const unitsType = new ObjectType({
    elemID: new ElemID(NETSUITE, 'unitsType'),
    fields: {
      internalId: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
  })
  beforeEach(async () => {
    defaultOpts = {
      elementsSourceIndex: {} as LazyElementsSourceIndexes,
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
      ...getTypesToInternalId([]),
    }
    defaultOpts.config.fetch.resolveAccountSpecificValues = false
  })
  describe('onFetch', () => {
    it('should add account specific value to record refs', async () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'type'),
          fields: { recordRef: { refType: recordRefType } },
          annotations: { source: 'soap' },
        }),
        {
          recordRef: { internalId: '1' },
        },
      )

      await filterCreator(defaultOpts).onFetch?.([instance])
      expect(instance.value.recordRef).toEqual({
        internalId: '1',
        id: ACCOUNT_SPECIFIC_VALUE,
      })
    })

    it('should not run filter when fetch.resolveAccountSpecificValue is true', async () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'type'),
          fields: { recordRef: { refType: recordRefType } },
          annotations: { source: 'soap' },
        }),
        {
          recordRef: { internalId: '1' },
        },
      )
      defaultOpts.config.fetch.resolveAccountSpecificValues = true
      await filterCreator(defaultOpts).onFetch?.([instance])
      expect(instance.value.recordRef).toEqual({
        internalId: '1',
      })
    })

    it('should replace internalId for values without fields', async () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({ elemID: new ElemID(NETSUITE, 'type'), annotations: { source: 'soap' } }),
        { recordRef: { internalId: '1' } },
      )

      await filterCreator(defaultOpts).onFetch?.([instance])
      expect(instance.value.recordRef.internalId).toEqual(ACCOUNT_SPECIFIC_VALUE)
    })

    it('should extract list items with internal id', async () => {
      const SubsidiaryType = new ObjectType({
        elemID: new ElemID(NETSUITE, 'subsidiary'),
        fields: {
          internalId: {
            refType: BuiltinTypes.STRING,
            annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
          },
        },
      })
      const instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'type'),
          fields: { someList: { refType: new ListType(SubsidiaryType) } },
          annotations: { source: 'soap' },
        }),
        { someList: [{ internalId: '1' }, { internalId: '1' }] },
      )

      const elements = [instance]

      await filterCreator(defaultOpts).onFetch?.(elements)
      expect(elements[1].elemID.name).toBe('type_someList_1')
      expect(elements[1].elemID.typeName).toBe('subsidiary')
      expect(elements[1].value.isSubInstance).toBeTruthy()
      expect((instance.value.someList[0] as ReferenceExpression).elemID.getFullName()).toBe(
        elements[1].elemID.getFullName(),
      )
      expect(elements.length).toBe(2)
    })

    it('type should be record type if the original type is an SDF type', async () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'type'),
          fields: { someValue: { refType: roleType().type } },
          annotations: { source: 'soap' },
        }),
        { someValue: { internalId: '1' } },
      )

      const elements = [instance, recordRefType]

      await filterCreator(defaultOpts).onFetch?.(elements)
      expect(elements.length).toBe(3)
      expect(elements[2].elemID.name).toBe('type_someValue_1')
      expect(elements[2].elemID.typeName).toBe('recordRef')
      expect((elements[2] as InstanceElement).value.isSubInstance).toBeTruthy()
      expect((instance.value.someValue as ReferenceExpression).elemID.getFullName()).toBe(
        elements[2].elemID.getFullName(),
      )
    })

    it('should add id field for fields with hidden internalIds', async () => {
      const instance = new InstanceElement(
        'instance',
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'account'),
          fields: { someValue: { refType: unitsType } },
          annotations: { source: 'soap' },
        }),
        { someValue: { internalId: '1' } },
      )
      await filterCreator(defaultOpts).onFetch?.([instance])
      expect(instance.value.someValue.id).toEqual(ACCOUNT_SPECIFIC_VALUE)
    })
  })

  describe('preDeploy', () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'type'),
      fields: { recordRef: { refType: recordRefType } },
      annotations: { source: 'soap' },
    })

    it('should replace internalId with id and remove name', async () => {
      const instance = new InstanceElement('instance', type, {
        recordRef: { internalId: '1', id: '2', name: 'Some Name' },
      })

      await filterCreator(defaultOpts).preDeploy?.([
        toChange({ before: instance.clone(), after: instance }),
        toChange({ before: type, after: type }),
      ])
      expect(instance.value).toEqual({ recordRef: { internalId: '2' } })
    })

    it('should use internalId when id not set and remove name', async () => {
      const instance = new InstanceElement('instance', type, {
        recordRef: { internalId: '1', id: ACCOUNT_SPECIFIC_VALUE, name: 'Some Name' },
      })

      await filterCreator(defaultOpts).preDeploy?.([toChange({ before: instance.clone(), after: instance })])
      expect(instance.value).toEqual({ recordRef: { internalId: '1' } })
    })

    it('should not remove additional properties', async () => {
      const instance = new InstanceElement('instance', type, {
        recordRef: { internalId: '1', name: 'Some Name', anotherField: 'value' },
      })

      await filterCreator(defaultOpts).preDeploy?.([toChange({ before: instance.clone(), after: instance })])
      expect(instance.value).toEqual({ recordRef: { internalId: '1', name: 'Some Name', anotherField: 'value' } })
    })
  })
})
