/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ElemID, PrimitiveTypes, ObjectType, PrimitiveType, BuiltinTypes,
  ListType, MapType, InstanceElement } from '@salto-io/adapter-api'
import { selectElementsBySelectors, createElementSelectors, createElementSelector,
  getElementIdsFromSelectorsRecursively } from '../src/workspace/element_selector'

const mockStrType = new PrimitiveType({
  elemID: new ElemID('mockAdapter', 'str'),
  primitive: PrimitiveTypes.STRING,
  annotations: { testAnno: 'TEST ANNO TYPE' },
  path: ['here', 'we', 'go'],
})
const mockElem = new ElemID('mockAdapter', 'test')
const mockType = new ObjectType({
  elemID: mockElem,
  annotationTypes: {
    testAnno: mockStrType,
  },
  annotations: {
    testAnno: 'TEST ANNO',
  },
  fields: {
    bool: { type: BuiltinTypes.BOOLEAN },
    num: { type: BuiltinTypes.NUMBER },
    strArray: { type: new ListType(BuiltinTypes.STRING) },
    strMap: { type: new MapType(BuiltinTypes.STRING) },
    obj: {
      type: new ListType(new ObjectType({
        elemID: mockElem,
        fields: {
          field: { type: BuiltinTypes.STRING },
          otherField: {
            type: BuiltinTypes.STRING,
          },
          value: { type: BuiltinTypes.STRING },
          mapOfStringList: { type: new MapType(new ListType(BuiltinTypes.STRING)) },
        },
      })),
    },
  },
  path: ['this', 'is', 'happening'],
})

const mockInstance = new InstanceElement(
  'mockInstance',
  mockType,
  {
    str: 'val',
    bool: 'true',
    num: '99',
    numArray: ['12', '13', '14'],
    strArray: 'should be list',
    numMap: { key12: 12, num13: 13 },
    strMap: { a: 'a', bla: 'BLA' },
    notExist: 'notExist',
    notExistArray: ['', ''],
    objWithInnerObj: {
      innerObj: {
        listKey: [1, 2],
        stringKey: 'val2',
      },
    },
  },
  ['yes', 'this', 'is', 'path'],
)
describe('element selector', () => {
  const selectElements = (elements: ElemID[], selectors: string[]): ElemID[] =>
    selectElementsBySelectors(elements, createElementSelectors(selectors).validSelectors)[0]
  it('should handle asterisks in adapter and type', () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance'),
    ]
    const selectedElements = selectElements(elements, ['*.*'])
    expect(selectedElements).toEqual([elements[0], elements[1], elements[2]])
  })

  it('should handle asterisks in field type and instance name', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'one instance'),
      new ElemID('salesforce', 'othertype', 'type', 'typename'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some other instace2'),
      new ElemID('salesforce', 'othertype', 'instance', 'some other instance'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.*.instance.*'])
    expect(selectedElements).toEqual([elements[0], elements[3]])
  })

  it('should handle asterisks alongside partial names in type', () => {
    const elements = [
      new ElemID('salesforce', 'sometype__c'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some other instace2'),
      new ElemID('salesforce', 'othertype__c'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.*__c'])
    expect(selectedElements).toEqual([elements[0], elements[3]])
  })
  it('should handle asterisks only in name', () => {
    const elements = [
      new ElemID('salesforce', 'ApexClass', 'instance', 'American'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'American', 'Australian'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'Bob'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Analog'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.ApexClass.instance.A*'])
    expect(selectedElements).toEqual([elements[0], elements[4]])
  })

  it('should handle two asterisks in name', () => {
    const elements = [
      new ElemID('salesforce', 'ApexClass', 'instance', 'American'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'American', 'Australian'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'Bob'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Im eric chan'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Im eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric chan'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.ApexClass.instance.*eric*'])
    expect(selectedElements).toEqual(
      [elements[0], elements[4], elements[5], elements[6], elements[7]]
    )
  })

  it('should use two selectors and allow any element that matches one of them', () => {
    const elements = [
      new ElemID('salesforce', 'value'),
      new ElemID('netsuite', 'value'),
      new ElemID('hubspot', 'value'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.*', 'netsuite.*'])
    expect(selectedElements).toEqual([elements[0], elements[1]])
  })

  it('should use a wildcard and a specific elment id and not throw error if the wildcard covers the element id', () => {
    const elements = [
      new ElemID('salesforce', 'value'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.*', 'salesforce.value'])
    expect(selectedElements).toEqual([elements[0]])
  })

  it('should throw error when invalid selector is given', () => {
    const invalidFilters = ['salesforce.Account.*', 'salesforce', '']
    expect(() => {
      createElementSelector('salesforce.Account.*')
    }).toThrow(new Error('Illegal element selector includes illegal type name: "*". Full selector is: "salesforce.Account.*"'))
    expect(() => {
      createElementSelector('salesforce')
    }).toThrow(new Error('Illegal element selector does not contain type name: "salesforce"'))
    expect(() => {
      createElementSelector('')
    }).toThrow(new Error('Illegal element selector does not contain adapter expression: ""'))
    expect(createElementSelectors(invalidFilters).invalidSelectors).toEqual(invalidFilters)
  })

  it('should throw error if exact element id filter matches nothing', () => {
    const elements = [
      new ElemID('salesforce', 'ApexClass', 'instance', 'American'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'American', 'Australian'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'Bob'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'bob2'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Im eric chan'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Im eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric chan'),
    ]
    expect(() => {
      selectElements(elements, ['salesforce.*', 'otheradapter.ApexClass.instance.bob2',
        'otheradapter.Apexclass.instance.bob3', 'otheradapter.Apexclass.instance.bob4'])
    }).toThrow(new Error('The following salto ids were not found: otheradapter.Apexclass.instance.bob3,otheradapter.Apexclass.instance.bob4'))
  })
  it('should throw error if no filter matches anything', () => {
    const elements = [
      new ElemID('salesforce', 'ApexClass', 'instance', 'American'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'American', 'Australian'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'Bob'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'bob2'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Im eric chan'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Im eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric chan'),
    ]
    expect(() => {
      selectElements(elements, ['nonexistantadapter.ApexClass.instance.*',
        'anothernonexistantadapter.*'])
    }).toThrow(new Error('No salto ids matched the provided selectors nonexistantadapter.ApexClass.instance.*,anothernonexistantadapter.*'))
  })
})
describe('select elements recursively', () => {
  it('finds subElements one and two layers deep', async () => {
    const selectors = createElementSelectors(['mockAdapter.*', 'mockAdapter.*.instance.*',
      'mockAdapter.*.field.*',
      'mockAdapter.test.instance.mockInstance.bool',
      'mockAdapter.test.instance.mockInstance.strMap.bla',
      'mockAdapter.test.annotation.*']).validSelectors
    const elementIds = (await getElementIdsFromSelectorsRecursively(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })))).map(element => element.elemID).sort((el1, el2) =>
      (el1.getFullName() > el2.getFullName() ? 1 : -1))
    expect(elementIds).toEqual([mockInstance.elemID, mockType.elemID,
      ElemID.fromFullName('mockAdapter.test.instance.mockInstance.bool'),
      ElemID.fromFullName('mockAdapter.test.instance.mockInstance.strMap.bla'),
      ElemID.fromFullName('mockAdapter.test.field.bool'),
      ElemID.fromFullName('mockAdapter.test.field.strMap'),
      ElemID.fromFullName('mockAdapter.test.field.obj'),
      ElemID.fromFullName('mockAdapter.test.field.num'),
      ElemID.fromFullName('mockAdapter.test.field.strArray'),
      ElemID.fromFullName('mockAdapter.test.annotation.testAnno')].sort((el1, el2) =>
      (el1.getFullName() > el2.getFullName() ? 1 : -1)))
  })
  it('removes fields of type from list when compact', async () => {
    const selectors = createElementSelectors(['mockAdapter.*', 'mockAdapter.*.field.*',
      'mockAdapter.test.field.obj.*']).validSelectors
    const elementIds = (await getElementIdsFromSelectorsRecursively(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), true)).map(element => element.elemID)
    expect(elementIds).toEqual([mockType.elemID])
  })

  it('removes child elements of instance from list', async () => {
    const selectors = createElementSelectors(['mockAdapter.*.instance.*',
      'mockAdapter.test.instance.mockInstance.*',
      'mockAdapter.test.instance.mockInstance.strMap.*']).validSelectors
    const elementIds = (await getElementIdsFromSelectorsRecursively(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), true)).map(element => element.elemID)
    expect(elementIds).toEqual([mockInstance.elemID])
  })

  it('fails with bad selector: element id matches nothing', async () => {
    const selectors = createElementSelectors(['mockAdapter.*',
      'mockAdapter.test.instance.mockInstance.strMap.noChanceThisSelectorExists']).validSelectors
    await expect(getElementIdsFromSelectorsRecursively(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })))).rejects.toThrow(new Error('The following salto ids were not found: mockAdapter.test.instance.mockInstance.strMap.noChanceThisSelectorExists'))
  })

  it('fails with bad selector: selectors match nothing', async () => {
    const selectors = createElementSelectors(['nonExistentAdapter.*', 'nonExistentAdapter2.*']).validSelectors
    await expect(getElementIdsFromSelectorsRecursively(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })))).rejects.toThrow(new Error('No salto ids matched the provided selectors nonExistentAdapter.*,nonExistentAdapter2.*'))
  })
})
