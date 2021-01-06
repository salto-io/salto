/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, PrimitiveTypes, ObjectType, PrimitiveType, BuiltinTypes, ListType, MapType, InstanceElement } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { selectElementsBySelectors, createElementSelectors, createElementSelector,
  selectElementIdsByTraversal } from '../src/workspace/element_selector'

const mockStrType = new PrimitiveType({
  elemID: new ElemID('mockAdapter', 'str'),
  primitive: PrimitiveTypes.STRING,
  annotations: { testAnno: 'TEST ANNO TYPE' },
  path: ['here', 'we', 'go'],
})
const mockElem = new ElemID('mockAdapter', 'test')
const mockType = new ObjectType({
  elemID: mockElem,
  annotationRefsOrTypes: {
    testAnno: mockStrType,
  },
  annotations: {
    testAnno: 'TEST ANNO',
  },
  fields: {
    bool: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    num: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    strArray: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.STRING)) },
    strMap: { refType: createRefToElmWithValue(new MapType(BuiltinTypes.STRING)),
      annotations: {
        _required: true,
      } },
    obj: {
      refType: createRefToElmWithValue(new ListType(new ObjectType({
        elemID: mockElem,
        fields: {
          field: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
          otherField: {
            refType: createRefToElmWithValue(BuiltinTypes.STRING),
          },
          value: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
          mapOfStringList: {
            refType: createRefToElmWithValue(new MapType(new ListType(BuiltinTypes.STRING))),
          },
        },
      }))),
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
  const selectElements = (elements: ElemID[], selectors: string[],
    caseInsensitive = false): ElemID[] =>
    selectElementsBySelectors(elements, createElementSelectors(selectors, caseInsensitive)
      .validSelectors).elements
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

  it('should only select specific type when given specific type element', () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'sometypewithsameprefix'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'y'),
      new ElemID('salesforce', 'sometype', 'instance', 'x'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.sometype'])
    expect(selectedElements).toEqual([elements[0]])
  })

  it('should handle asterisks in field type and instance name', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'one_instance'),
      new ElemID('salesforce', 'sometype', 'instance', 'second_instance_specialchar@s'),
      new ElemID('salesforce', 'othertype', 'type', 'typename'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some_other_instance2'),
      new ElemID('salesforce', 'othertype', 'instance', 'some_other_instance'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.*.instance.*'])
    expect(selectedElements).toEqual([elements[0], elements[1], elements[4]])
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
      new ElemID('salesforce', 'ApexClass', 'instance', 'Imericchan'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'eric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Imeric'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'ericchan'),
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
  it('returns all elements with no selectors', async () => {
    const elements = [
      new ElemID('salesforce', 'value'),
      new ElemID('netsuite', 'value'),
      new ElemID('hubspot', 'value'),
    ]
    expect(selectElements(elements, [])).toEqual(elements)
  })
  it('should use a wildcard and a specific elment id and not throw error if the wildcard covers the element id', () => {
    const elements = [
      new ElemID('salesforce', 'value'),
    ]
    const selectedElements = selectElements(elements, ['salesforce.*', 'salesforce.value'])
    expect(selectedElements).toEqual([elements[0]])
  })

  it('should use case insensitive selectors when specified', () => {
    const elements = [
      new ElemID('salesfOrce', 'valUe', 'instance', 'heLlo', 'woRld'),
      new ElemID('salesfOrce', 'valUe', 'instance', 'heLlo', 'universe'),
      new ElemID('netsuite', 'dontinclude'),
      new ElemID('NetSuite', 'Value'),
      new ElemID('hubsPot', 'value', 'attr', 'sOmetHing'),
      new ElemID('hubspot', 'value', 'attr', 'other'),
    ]
    const selectedElements = selectElements(elements,
      ['salesforce.v*ue.INSTANCE.hellO.World', 'netsuitE.v*', 'Hubspot.V*.attR.Something'], true)
    expect(selectedElements).toEqual([elements[0], elements[3], elements[4]])
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
      'mockAdapter.*.field.*.*',
      'mockAdapter.*.attr.testAnno']).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })))).sort((e1,
      e2) => e1.getFullName().localeCompare(e2.getFullName()))
    const expectedElements = [mockInstance.elemID, mockType.elemID,
      ElemID.fromFullName('mockAdapter.test.field.bool'),
      ElemID.fromFullName('mockAdapter.test.field.strMap'),
      ElemID.fromFullName('mockAdapter.test.field.strMap._required'),
      ElemID.fromFullName('mockAdapter.test.field.obj'),
      ElemID.fromFullName('mockAdapter.test.field.num'),
      ElemID.fromFullName('mockAdapter.test.field.strArray'),
      ElemID.fromFullName('mockAdapter.test.attr.testAnno')].sort((e1,
      e2) => e1.getFullName().localeCompare(e2.getFullName()))
    expect(elementIds).toEqual(expectedElements)
  })
  it('returns nothing with non-matching subelements', async () => {
    const selectors = createElementSelectors(['mockAdapter.test.instance.mockInstance.obj.NoSuchThingExists*']).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      }))))
    expect(elementIds).toEqual([])
  })
  it('removes fields of type from list when compact', async () => {
    const selectors = createElementSelectors(['mockAdapter.*', 'mockAdapter.*.field.*',
      'mockAdapter.test.field.strMap.*']).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), true))
    expect(elementIds).toEqual([mockType.elemID])
  })

  it('removes child elements of field from list', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.test.field.strMap']).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), true))
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('ignores multiple instances of the same', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.test.field.strMap']).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), true))
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('removes child elements of field selected by wildcard from list', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.*.field.strMap']).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), true))
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('should return only the exact match when the selector is a valid elemID', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.bool',
    ]).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      }))))
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.instance.mockInstance.bool')])
  })
  it('should just return element id if validateDeterminedSelectors is false', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.thispropertydoesntexist',
    ]).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      }))))
    expect(elementIds).toEqual([ElemID
      .fromFullName('mockAdapter.test.instance.mockInstance.thispropertydoesntexist')])
  })
  it('should not return non-existant element id if validateDeterminedSelectors is true', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.thispropertydoesntexist',
      'mockAdapter.test.field.strMap',
    ]).validSelectors
    const elementIds = (await selectElementIdsByTraversal(selectors,
      [mockInstance, mockType].map(element => ({
        elemID: element.elemID,
        element,
      })), false, true))
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })
})
