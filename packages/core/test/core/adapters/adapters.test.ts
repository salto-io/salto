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
import 'jest-extended'
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
} from '@salto-io/adapter-api'
import * as utils from '@salto-io/adapter-utils'
import { buildElementsSourceFromElements, createDefaultInstanceFromType } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { adapter } from '@salto-io/salesforce-adapter'
import { mockFunction } from '@salto-io/test-utils'
import _ from 'lodash'
import { expressions } from '@salto-io/workspace'
import {
  initAdapters,
  getAdaptersCredentialsTypes,
  getAdaptersCreatorConfigs,
  getDefaultAdapterConfig,
  adapterCreators,
  getAdaptersConfigTypesMap,
  createResolvedTypesElementsSource,
} from '../../../src/core/adapters'

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

jest.mock('../../../src/core/adapters/creators', () => {
  const actual = jest.requireActual('../../../src/core/adapters/creators')
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      mockAdapter: {
        configType: undefined,
        getDefaultConfig: undefined,
      },
    },
  }
})
describe('adapters.ts', () => {
  const { authenticationMethods } = adapter
  const accounts = ['salesforce']
  const sfConfig = new InstanceElement(ElemID.CONFIG_NAME, authenticationMethods.basic.credentialsType, {
    username: 'nacluser',
    password: 'naclpass',
    token: 'nacltoken',
    sandbox: false,
  })

  let resolveSpy: jest.SpyInstance

  beforeEach(() => {
    resolveSpy = jest.spyOn(expressions, 'resolve')
    jest.clearAllMocks()
  })

  describe('run get adapters config statuses', () => {
    let credentials: Record<string, AdapterAuthentication>

    it('should return config for defined adapter', () => {
      credentials = getAdaptersCredentialsTypes(accounts)
      expect(credentials.salesforce).toEqual(authenticationMethods)
    })

    it('should throw error for non defined adapter', () => {
      expect(() => getAdaptersCredentialsTypes(accounts.concat('fake'))).toThrow()
    })
  })

  describe('getDefaultAdapterConfig', () => {
    const { mockAdapter } = adapterCreators
    beforeEach(() => {
      const mockConfigType = new ObjectType({
        elemID: new ElemID('mockAdapter', ElemID.CONFIG_NAME),
      })

      _.assign(mockAdapter, {
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

      createDefaultInstanceFromTypeMock.mockResolvedValue(
        new InstanceElement(ElemID.CONFIG_NAME, mockConfigType, { val: 'aaa' }),
      )
    })

    afterAll(() => {
      createDefaultInstanceFromTypeMock.mockReset()
    })

    it('should call createDefaultInstanceFromType when configCreator is undefined', async () => {
      delete mockAdapter.configCreator
      const defaultConfigs = await getDefaultAdapterConfig('mockAdapter', 'mockAdapter')
      expect(createDefaultInstanceFromType).toHaveBeenCalled()
      expect(defaultConfigs).toHaveLength(1)
      expect(defaultConfigs?.[0].value).toEqual({ val: 'aaa' })
    })
    it('should use getConfig when configCreator is defined', async () => {
      const mockObjType = new ObjectType({
        elemID: new ElemID('test'),
      })
      const mockOptions = new InstanceElement('test', mockObjType)
      const defaultConfigs = await getDefaultAdapterConfig('mockAdapter', 'mockAdapter', mockOptions)
      expect(mockAdapter.configCreator?.getConfig).toHaveBeenCalledWith(mockOptions)
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
      const { mockAdapter } = adapterCreators
      _.assign(mockAdapter, {
        configType: mockConfigType,
      })
    })

    it('should return the config type and its sub-types', () => {
      const types = getAdaptersConfigTypesMap()
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
      )
      expect(adapters.salesforce).toBeDefined()
    })

    it('should throw an error when no proper config exists', async () => {
      const credentials: InstanceElement | undefined = undefined
      expect(() =>
        initAdapters({
          [accounts[0]]: {
            credentials: credentials as unknown as InstanceElement,
            elementsSource: utils.buildElementsSourceFromElements([]),
          },
        }),
      ).toThrow()
    })

    it('should throw an error when no proper creator exists', async () => {
      expect(() =>
        initAdapters({
          notExist: {
            credentials: sfConfig,
            elementsSource: utils.buildElementsSourceFromElements([]),
          },
        }),
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
})
