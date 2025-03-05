/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import '@salto-io/jest-extended'
import {
  InstanceElement,
  ElemID,
  AdapterAuthentication,
  ObjectType,
  AdapterOperationsContext,
  Adapter,
  ReadOnlyElementsSource,
  isObjectType,
  TypeElement,
  Field,
  isType,
  ContainerType,
  ListType,
  isContainerType,
  BuiltinTypes,
  TypeReference,
  isInstanceElement,
} from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import { expressions, getAdaptersConfigTypesMap } from '@salto-io/workspace'
import {
  initAdapters,
  getAdaptersCredentialsTypes,
  getAdaptersCreatorConfigs,
  getDefaultAdapterConfig,
  createResolvedTypesElementsSource,
  createAdapterElementsSource,
} from '../../../src/core/adapters'
import { createMockAdapter } from '../../common/helpers'

const { toArrayAsync } = collections.asynciterable

jest.mock('@salto-io/workspace', () => ({
  ...jest.requireActual<{}>('@salto-io/workspace'),
  configSource: jest.fn(),
}))

const createDefaultInstanceFromTypeMock = jest.fn()
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  createDefaultInstanceFromType: jest.fn((...args) => createDefaultInstanceFromTypeMock(...args)),
}))

describe('adapters.ts', () => {
  const sfMockAdapterName = 'salesforce'
  const dummyMockAdapterName = 'dummy'

  const credentialsType = new ObjectType({ elemID: new ElemID(sfMockAdapterName) })

  const authenticationMethods = {
    basic: { credentialsType },
  }
  const accounts = ['salesforce']
  const sfConfig = new InstanceElement(ElemID.CONFIG_NAME, authenticationMethods.basic.credentialsType, {
    username: 'nacluser',
    password: 'naclpass',
    token: 'nacltoken',
    sandbox: false,
  })

  let resolveSpy: jest.SpyInstance
  const mockAdapterCreator: Record<string, Adapter> = {}
  let sfMockAdapter: ReturnType<typeof createMockAdapter>
  let otherMockAdapter: ReturnType<typeof createMockAdapter>
  let dummyMockAdapter: ReturnType<typeof createMockAdapter>

  beforeEach(() => {
    resolveSpy = jest.spyOn(expressions, 'resolve')
    sfMockAdapter = createMockAdapter(sfMockAdapterName)
    otherMockAdapter = createMockAdapter('mockAdapter')
    dummyMockAdapter = createMockAdapter(dummyMockAdapterName)
    mockAdapterCreator[sfMockAdapterName] = sfMockAdapter
    mockAdapterCreator[dummyMockAdapterName] = dummyMockAdapter
    mockAdapterCreator.mockAdapter = otherMockAdapter
    jest.clearAllMocks()
  })

  describe('run get adapters config statuses', () => {
    let credentials: Record<string, AdapterAuthentication>

    it('should return config for defined adapter', () => {
      credentials = getAdaptersCredentialsTypes({ names: accounts, adapterCreators: mockAdapterCreator })
      expect(credentials.salesforce).toEqual(authenticationMethods)
    })

    it('should throw error for non defined adapter', () => {
      expect(() =>
        getAdaptersCredentialsTypes({ names: accounts.concat('fake'), adapterCreators: mockAdapterCreator }),
      ).toThrow()
    })
  })

  describe('getDefaultAdapterConfig', () => {
    let mockAdapterVal: Adapter
    beforeEach(() => {
      mockAdapterVal = mockAdapterCreator.mockAdapter
      const mockConfigType = new ObjectType({
        elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
      })

      _.assign(mockAdapterVal, {
        configType: mockConfigType,
        configCreator: {
          getConfig: mockFunction<NonNullable<Adapter['configCreator']>['getConfig']>().mockResolvedValue(
            new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, { val: 'bbb' }),
          ),
          options: new ObjectType({
            elemID: new ElemID('test'),
          }),
        },
      })

      mockAdapterCreator.mockAdapter = mockAdapterVal

      createDefaultInstanceFromTypeMock.mockResolvedValue(
        new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, { val: 'aaa' }),
      )
    })

    afterAll(() => {
      createDefaultInstanceFromTypeMock.mockReset()
    })

    it('should call createDefaultInstanceFromType when configCreator is undefined', async () => {
      delete mockAdapterCreator.mockAdapter.configCreator
      const defaultConfigs = await getDefaultAdapterConfig({
        adapterName: 'mockAdapter',
        accountName: 'mockAdapter',
        adapterCreators: mockAdapterCreator,
      })
      expect(createDefaultInstanceFromType).toHaveBeenCalled()
      expect(defaultConfigs).toHaveLength(1)
      expect(defaultConfigs?.[0].value).toEqual({ val: 'aaa' })
    })
    it('should use getConfig when configCreator is defined', async () => {
      const mockObjType = new ObjectType({
        elemID: new ElemID('test'),
      })
      const mockOptions = new InstanceElement('test', mockObjType)
      const defaultConfigs = await getDefaultAdapterConfig({
        adapterName: 'mockAdapter',
        accountName: 'mockAdapter',
        adapterCreators: mockAdapterCreator,
        options: mockOptions,
      })
      expect(mockAdapterVal.configCreator?.getConfig).toHaveBeenCalledWith(mockOptions)
      expect(defaultConfigs).toHaveLength(1)
      expect(defaultConfigs?.[0].value).toEqual({ val: 'bbb' })
    })
  })

  describe('getAdaptersConfigTypes', () => {
    const mockConfigSubType = new ObjectType({
      elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
    })
    const mockConfigType = new ObjectType({
      elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
      fields: {
        a: { refType: mockConfigSubType },
      },
    })

    beforeEach(() => {
      const { mockAdapter } = mockAdapterCreator
      _.assign(mockAdapter, {
        configType: mockConfigType,
      })
    })

    it('should return the config type and its sub-types', () => {
      const types = getAdaptersConfigTypesMap(mockAdapterCreator)
      expect(types.mockAdapter).toContain(mockConfigType)
      expect(types.mockAdapter).toContain(mockConfigSubType)
    })
  })

  describe('run get adapters creator configs', () => {
    const serviceName = 'salesforce'
    const objectType = new ObjectType({ elemID: new ElemID(serviceName, 'type1') })
    const d1Type = new ObjectType({ elemID: new ElemID('d1', 'type2') })
    beforeEach(() => {
      createDefaultInstanceFromTypeMock.mockResolvedValue([])
    })
    it('should return default adapter config when there is no config', async () => {
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        async () => undefined,
        buildElementsSourceFromElements([]),
        { [serviceName]: serviceName },
        undefined,
        undefined,
        mockAdapterCreator,
      )
      expect(result[serviceName]).toEqual(
        expect.objectContaining({
          credentials: sfConfig,
          config: undefined,
          getElemIdFunc: undefined,
        }),
      )
      expect(Object.keys(result)).toEqual([serviceName])
    })

    it('should return adapter config when there is config', async () => {
      const result = await getAdaptersCreatorConfigs(
        [serviceName],
        { [sfConfig.elemID.adapter]: sfConfig },
        async name => (name === sfConfig.elemID.adapter ? sfConfig : undefined),
        buildElementsSourceFromElements([]),
        { [serviceName]: serviceName },
        undefined,
        undefined,
        mockAdapterCreator,
      )
      expect(result[serviceName]).toEqual(
        expect.objectContaining({
          credentials: sfConfig,
          config: sfConfig,
          getElemIdFunc: undefined,
        }),
      )
      expect(Object.keys(result)).toEqual([serviceName])
    })

    let result: Record<string, AdapterOperationsContext>
    describe('multi app adapter config', () => {
      beforeEach(async () => {
        result = await getAdaptersCreatorConfigs(
          [serviceName, 'd1'],
          { [sfConfig.elemID.adapter]: sfConfig },
          async name => (name === sfConfig.elemID.adapter ? sfConfig : undefined),
          buildElementsSourceFromElements([objectType, d1Type]),
          { [serviceName]: serviceName, d1: 'dummy' },
          undefined,
          undefined,
          mockAdapterCreator,
        )
      })

      it('should only return elements that belong to the relevant account', async () => {
        const elementsSource = result[serviceName]?.elementsSource
        expect(elementsSource).toBeDefined()
        expect(await elementsSource.has(objectType.elemID)).toBeTruthy()
        expect(await elementsSource.has(new ElemID('d1', 'type2'))).toBeFalsy()
        expect(await elementsSource.has(new ElemID('dummy', 'type2'))).toBeFalsy()

        expect(await elementsSource.get(objectType.elemID)).toBeDefined()
        expect(await elementsSource.get(new ElemID('d1', 'type2'))).toBeUndefined()
        expect(await elementsSource.get(new ElemID('dummy', 'type2'))).toBeUndefined()

        expect(await collections.asynciterable.toArrayAsync(await elementsSource.getAll())).toEqual([objectType])

        expect(await collections.asynciterable.toArrayAsync(await elementsSource.list())).toEqual([objectType.elemID])
      })

      it('should return renamed elements when account name is different from adapter name', async () => {
        const d1ElementsSource = result.d1?.elementsSource
        // since element source is used inside the adapter, it should receive and return
        // values with default adapter name as account name
        expect(await d1ElementsSource.get(new ElemID('dummy', 'type2'))).toEqual(
          new ObjectType({
            elemID: new ElemID('dummy', 'type2'),
          }),
        )
      })

      it('should not modify elements in the origin elements source', async () => {
        const d1ElementsSource = result.d1?.elementsSource
        await d1ElementsSource.get(new ElemID('dummy', 'type2'))
        expect(d1Type).not.toEqual(
          new ObjectType({
            elemID: new ElemID('dummy', 'type2'),
          }),
        )
      })
    })
  })

  describe('init adapter', () => {
    it('should return adapter when config is defined', () => {
      const adapters = initAdapters(
        {
          salesforce: {
            credentials: sfConfig,
            config: undefined,
            elementsSource: utils.buildElementsSourceFromElements([]),
          },
        },
        { salesforce: 'salesforce' },
        mockAdapterCreator,
      )
      expect(adapters.salesforce).toBeDefined()
    })

    it('should throw an error when no proper config exists', async () => {
      const credentials: InstanceElement | undefined = undefined
      expect(() =>
        initAdapters(
          {
            [accounts[0]]: {
              credentials: credentials as unknown as InstanceElement,
              elementsSource: utils.buildElementsSourceFromElements([]),
            },
          },
          {},
          mockAdapterCreator,
        ),
      ).toThrow()
    })

    it('should throw an error when no proper creator exists', async () => {
      expect(() =>
        initAdapters(
          {
            notExist: {
              credentials: sfConfig,
              elementsSource: utils.buildElementsSourceFromElements([]),
            },
          },
          {},
          mockAdapterCreator,
        ),
      ).toThrow()
    })
  })
  describe('createResolvedTypesElementsSource', () => {
    const ADAPTER = 'salesforce'

    let type: TypeElement
    let nestedType: TypeElement
    let nestedNestedType: TypeElement
    let field: Field
    let instance: InstanceElement
    let containerType: ContainerType
    let primitiveTypeInstance: InstanceElement
    let elementsSource: ReadOnlyElementsSource

    beforeEach(async () => {
      nestedNestedType = new ObjectType({
        elemID: new ElemID(ADAPTER, 'NestedNestedType'),
      })
      nestedType = new ObjectType({
        elemID: new ElemID(ADAPTER, 'NestedType'),
        fields: {
          field: { refType: nestedNestedType },
        },
      })
      type = new ObjectType({
        elemID: new ElemID(ADAPTER, 'Type'),
        fields: {
          field: { refType: nestedType },
        },
      })
      field = type.fields.field
      instance = new InstanceElement('TestInstance', type)
      containerType = new ListType(new ListType(type))
      primitiveTypeInstance = new InstanceElement('StringInstance', new TypeReference(BuiltinTypes.STRING.elemID))
      elementsSource = createResolvedTypesElementsSource(
        utils.buildElementsSourceFromElements([
          type,
          field,
          nestedType,
          nestedNestedType,
          instance,
          primitiveTypeInstance,
        ]),
      )
    })

    describe('get', () => {
      it('should return fully resolved TypeElement', async () => {
        const resolvedType = (await elementsSource.get(type.elemID)) as ObjectType
        const resolvedNestedType = resolvedType.fields.field.refType.type as ObjectType
        const resolvedNestedNestedType = resolvedNestedType.fields.field.refType.type as ObjectType
        expect([resolvedType, resolvedNestedType, resolvedNestedNestedType]).toSatisfyAll(isType)
      })
      it('should return Field with fully resolved type', async () => {
        const resolvedField = (await elementsSource.get(field.elemID)) as Field
        const resolvedNestedType = resolvedField.refType.type as ObjectType
        const resolvedNestedNestedType = resolvedNestedType.fields.field.refType.type as ObjectType
        expect([resolvedNestedType, resolvedNestedNestedType]).toSatisfyAll(isType)
      })
      it('should return Instance with fully resolved type', async () => {
        const resolvedInstance = (await elementsSource.get(instance.elemID)) as InstanceElement
        const resolvedType = resolvedInstance.refType.type
        expect(isObjectType(resolvedType)).toBeTrue()
        const resolvedNestedType = resolvedType?.fields.field.refType.type as ObjectType
        expect(isObjectType(resolvedNestedType)).toBeTrue()
        const resolvedNestedNestedType = resolvedNestedType.fields.field.refType.type
        expect(isObjectType(resolvedNestedNestedType)).toBeTrue()
      })
      it('should return primitive type Instance with unresolved type', async () => {
        const { refType } = (await elementsSource.get(primitiveTypeInstance.elemID)) as InstanceElement
        expect(refType.type).toBeUndefined()
        expect(refType.elemID).toEqual(BuiltinTypes.STRING.elemID)
      })
      it('should return fully resolved ContainerType', async () => {
        const resolvedContainerType = (await elementsSource.get(containerType.elemID)) as ContainerType
        const resolvedInnerContainerType = resolvedContainerType.refInnerType.type as ContainerType
        expect(isContainerType(resolvedInnerContainerType)).toBeTrue()
        const resolvedInnerType = resolvedInnerContainerType.refInnerType.type as ObjectType
        const resolvedNestedType = resolvedInnerType.fields.field.refType.type as ObjectType
        expect(isObjectType(resolvedNestedType)).toBeTrue()
        const resolvedNestedNestedType = resolvedNestedType.fields.field.refType.type as ObjectType
        expect(isObjectType(resolvedNestedNestedType)).toBeTrue()
      })
    })
    describe('getAll', () => {
      it('should return all elements with resolved types, and resolve all the types ones', async () => {
        const resolvedElements = await toArrayAsync(await elementsSource.getAll())
        expect(resolvedElements).toHaveLength(6)
        const resolvedElementsByElemId = _.keyBy(resolvedElements, element => element.elemID.getFullName())
        const resolvedType = resolvedElementsByElemId[type.elemID.getFullName()] as ObjectType
        const resolvedInnerType = resolvedElementsByElemId[nestedType.elemID.getFullName()] as ObjectType
        const resolvedInnerInnerType = resolvedElementsByElemId[nestedNestedType.elemID.getFullName()] as ObjectType
        const resolvedInstance = resolvedElementsByElemId[instance.elemID.getFullName()] as InstanceElement
        const resolvedField = resolvedElementsByElemId[field.elemID.getFullName()] as Field
        expect(resolvedInnerType.fields.field.refType.type).toEqual(resolvedInnerInnerType)
        expect(resolvedType.fields.field.refType.type).toEqual(resolvedInnerType)
        expect(resolvedInstance.refType.type).toEqual(resolvedType)
        expect(resolvedField.refType.type).toEqual(resolvedInnerType)
        // Verify that expressions.resolve was invoked once for the whole process
        expect(resolveSpy).toHaveBeenCalledOnce()
      })
    })
    describe('list', () => {
      it('should return correct element IDs', async () => {
        const elementIds = await toArrayAsync(await elementsSource.list())
        expect(elementIds).toIncludeSameMembers([
          type.elemID,
          nestedType.elemID,
          nestedNestedType.elemID,
          instance.elemID,
          field.elemID,
          primitiveTypeInstance.elemID,
        ])
      })
    })
    describe('has', () => {
      it('should return true for existing element and false otherwise', async () => {
        expect(await elementsSource.has(type.elemID)).toBeTrue()
        expect(await elementsSource.has(new ElemID(ADAPTER, 'NonExistingType'))).toBeFalse()
      })
    })
  })

  describe('createAdapterElementsSource', () => {
    let elementsSource: ReadOnlyElementsSource
    let accountElementsSource: ReadOnlyElementsSource

    let type: ObjectType
    let anotherAccountType: ObjectType
    let instance: InstanceElement
    let secondInstance: InstanceElement
    let anotherAccountInstance: InstanceElement
    let secondAccountInstance: InstanceElement

    beforeEach(() => {
      type = new ObjectType({ elemID: new ElemID('salto', 'type'), annotations: { account: 'salto' } })
      anotherAccountType = new ObjectType({ elemID: new ElemID('salto2', 'type'), annotations: { account: 'salto2' } })

      instance = new InstanceElement('name', type, { account: 'salto' })
      secondInstance = new InstanceElement('saltoInstance', type)

      anotherAccountInstance = new InstanceElement('name', anotherAccountType, { account: 'salto2' })
      secondAccountInstance = new InstanceElement('salto2Instance', anotherAccountType)

      elementsSource = buildElementsSourceFromElements([
        type,
        anotherAccountType,
        instance,
        secondInstance,
        anotherAccountInstance,
        secondAccountInstance,
      ])
    })

    describe('when account name is the adapter name', () => {
      beforeEach(() => {
        accountElementsSource = createAdapterElementsSource({ elementsSource, account: 'salto', adapter: 'salto' })
      })

      describe('getAll', () => {
        it('should return only elements of the specific account', async () => {
          const elements = await toArrayAsync(await accountElementsSource.getAll())
          expect(elements).toHaveLength(3)
          expect(elements.find(isObjectType)).toEqual(type)
          expect(elements.filter(isInstanceElement).find(inst => inst.elemID.name === instance.elemID.name)).toEqual(
            instance,
          )
          expect(
            elements.filter(isInstanceElement).find(inst => inst.elemID.name === secondInstance.elemID.name),
          ).toEqual(secondInstance)
        })
      })

      describe('list', () => {
        it('should return only element ids of the specific account', async () => {
          const elemIds = await toArrayAsync(await accountElementsSource.list())
          expect(elemIds).toHaveLength(3)
          expect(elemIds.find(id => id.idType === 'type')).toEqual(type.elemID)
          expect(elemIds.find(id => id.name === instance.elemID.name)).toEqual(instance.elemID)
          expect(elemIds.find(id => id.name === secondInstance.elemID.name)).toEqual(secondInstance.elemID)
        })
      })

      describe('get', () => {
        it('should return only elements of the specific account', async () => {
          expect(await accountElementsSource.get(type.elemID)).toEqual(type)
          expect(await accountElementsSource.get(instance.elemID)).toEqual(instance)
          expect(await accountElementsSource.get(secondInstance.elemID)).toEqual(secondInstance)

          expect(await accountElementsSource.get(anotherAccountType.elemID)).toBeUndefined()
          expect(await accountElementsSource.get(anotherAccountInstance.elemID)).toBeUndefined()
          expect(await accountElementsSource.get(secondAccountInstance.elemID)).toBeUndefined()
          expect(
            await accountElementsSource.get(
              new ElemID('salto', secondAccountInstance.elemID.typeName, 'instance', secondAccountInstance.elemID.name),
            ),
          ).toBeUndefined()
        })
      })

      describe('has', () => {
        it('should return only elements of the specific account', async () => {
          expect(await accountElementsSource.has(type.elemID)).toBeTrue()
          expect(await accountElementsSource.has(instance.elemID)).toBeTrue()
          expect(await accountElementsSource.has(secondInstance.elemID)).toBeTrue()

          expect(await accountElementsSource.has(anotherAccountType.elemID)).toBeFalse()
          expect(await accountElementsSource.has(anotherAccountInstance.elemID)).toBeFalse()
          expect(await accountElementsSource.has(secondAccountInstance.elemID)).toBeFalse()
          expect(
            await accountElementsSource.has(
              new ElemID('salto', secondAccountInstance.elemID.typeName, 'instance', secondAccountInstance.elemID.name),
            ),
          ).toBeFalse()
        })
      })
    })

    describe('when account name is different from the adapter name', () => {
      beforeEach(() => {
        accountElementsSource = createAdapterElementsSource({ elementsSource, account: 'salto2', adapter: 'salto' })
      })

      describe('getAll', () => {
        it('should return only elements of the specific account with replaced adapter', async () => {
          const elements = await toArrayAsync(await accountElementsSource.getAll())
          expect(elements).toHaveLength(3)

          const typeWithReplacedId = elements.find(isObjectType)
          expect(typeWithReplacedId?.elemID).toEqual(type.elemID)
          expect(typeWithReplacedId?.annotations).toEqual(anotherAccountType.annotations)

          const instanceWithReplacedId = elements
            .filter(isInstanceElement)
            .find(inst => inst.elemID.name === anotherAccountInstance.elemID.name)
          expect(instanceWithReplacedId?.elemID).toEqual(instance.elemID)
          expect(instanceWithReplacedId?.value).toEqual(anotherAccountInstance.value)

          const secondInstanceWithReplacedId = elements
            .filter(isInstanceElement)
            .find(inst => inst.elemID.name === secondAccountInstance.elemID.name)
          expect(secondInstanceWithReplacedId?.elemID).toEqual(
            new ElemID('salto', secondAccountInstance.elemID.typeName, 'instance', secondAccountInstance.elemID.name),
          )
        })
      })

      describe('list', () => {
        it('should return only element ids of the specific account with replaced adapter', async () => {
          const elemIds = await toArrayAsync(await accountElementsSource.list())
          expect(elemIds).toHaveLength(3)
          expect(elemIds.find(id => id.idType === 'type')).toEqual(type.elemID)
          expect(elemIds.find(id => id.name === anotherAccountInstance.elemID.name)).toEqual(instance.elemID)
          expect(elemIds.find(id => id.name === secondAccountInstance.elemID.name)).toEqual(
            new ElemID('salto', secondAccountInstance.elemID.typeName, 'instance', secondAccountInstance.elemID.name),
          )
        })
      })

      describe('get', () => {
        it('should return only elements of the specific account with replaced adapter', async () => {
          const typeWithReplacedId = await accountElementsSource.get(type.elemID)
          expect(typeWithReplacedId.elemID).toEqual(type.elemID)
          expect(typeWithReplacedId.annotations).toEqual(anotherAccountType.annotations)

          const instanceWithReplacedId = await accountElementsSource.get(instance.elemID)
          expect(instanceWithReplacedId.elemID).toEqual(instance.elemID)
          expect(instanceWithReplacedId.value).toEqual(anotherAccountInstance.value)

          const secondInstanceWithReplacedId = await accountElementsSource.get(secondAccountInstance.elemID)
          expect(secondInstanceWithReplacedId.elemID).toEqual(
            new ElemID('salto', secondAccountInstance.elemID.typeName, 'instance', secondAccountInstance.elemID.name),
          )

          expect(await accountElementsSource.get(secondInstance.elemID)).toBeUndefined()
        })
      })

      describe('has', () => {
        it('should return only elements of the specific account with replaced adapter', async () => {
          expect(await accountElementsSource.has(type.elemID)).toBeTrue()
          expect(await accountElementsSource.has(instance.elemID)).toBeTrue()
          expect(await accountElementsSource.has(secondAccountInstance.elemID)).toBeTrue()

          expect(await accountElementsSource.has(secondInstance.elemID)).toBeFalse()
        })
      })
    })
  })
})
