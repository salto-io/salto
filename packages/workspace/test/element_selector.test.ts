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
import { ElemID, PrimitiveTypes, ObjectType, PrimitiveType, BuiltinTypes,
  ListType, MapType, InstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { selectElementsBySelectors, createElementSelectors, createElementSelector,
  selectElementIdsByTraversal,
  ElementSelector } from '../src/workspace/element_selector'
import { createInMemoryElementSource } from '../src/workspace/elements_source'

const { awu } = collections.asynciterable

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
    bool: { refType: BuiltinTypes.BOOLEAN },
    num: { refType: BuiltinTypes.NUMBER },
    strArray: { refType: new ListType(BuiltinTypes.STRING) },
    strMap: { refType: new MapType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      } },
    obj: {
      refType: new ListType(new ObjectType({
        elemID: mockElem,
        fields: {
          field: { refType: BuiltinTypes.STRING },
          otherField: {
            refType: BuiltinTypes.STRING,
          },
          value: { refType: BuiltinTypes.STRING },
          mapOfStringList: {
            refType: new MapType(new ListType(BuiltinTypes.STRING)),
          },
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

const selectElements = async ({
  elements, selectors, caseInsensitive = false, includeNested = false,
}: {
  elements: ElemID[]
  selectors: string[]
  caseInsensitive?: boolean
  includeNested?: boolean
}): Promise<ElemID[]> => awu(
  (selectElementsBySelectors({
    elementIds: awu(elements),
    selectors: createElementSelectors(selectors, caseInsensitive).validSelectors,
    includeNested,
  }))
).toArray()

describe('element selector', () => {
  it('should handle asterisks in adapter and type', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['*.*'] })
    expect(selectedElements).toEqual([elements[0], elements[1], elements[2]])
  })

  it('should only select specific type when given specific type element', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'sometypewithsameprefix'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'y'),
      new ElemID('salesforce', 'sometype', 'instance', 'x'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.sometype'] })
    expect(selectedElements).toEqual([elements[0]])
  })

  it('should handle asterisks in field type and instance name', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'one_instance'),
      new ElemID('salesforce', 'sometype', 'instance', 'second_instance_specialchar@s'),
      new ElemID('salesforce', 'othertype', 'type', 'typename'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some_other_instance2'),
      new ElemID('salesforce', 'othertype', 'instance', 'some_other_instance'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.*.instance.*'] })
    expect(selectedElements).toEqual([elements[0], elements[1], elements[4]])
  })

  it('should select elements with the same selector length when includeNested is false and name selectors length is 1', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA'),
    ]
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.*.instance.A'] }
    )
    expect(selectedElements).toEqual([elements[0]])
  })

  it('should select also nested elements when includeNested is true and name selectors length is 1', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA'),
    ]
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.*.instance.A'], includeNested: true }
    )
    expect(selectedElements).toEqual([elements[0], elements[1], elements[2]])
  })

  it('should select elements with the same selector length when includeNested is false and name selectors length is 2', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA', 'B'),
    ]
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.*.instance.A.*'] }
    )
    expect(selectedElements).toEqual([elements[1]])
  })

  it('should select also nested elements when includeNested is true and name selectors length is 2', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA', 'B'),
    ]
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.*.instance.A.*'], includeNested: true }
    )
    expect(selectedElements).toEqual([elements[1], elements[2]])
  })

  it('should handle asterisks alongside partial names in type', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype__c'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some other instace2'),
      new ElemID('salesforce', 'othertype__c'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.*__c'] })
    expect(selectedElements).toEqual([elements[0], elements[3]])
  })
  it('should handle asterisks only in name', async () => {
    const elements = [
      new ElemID('salesforce', 'ApexClass', 'instance', 'American'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'American', 'Australian'),
      new ElemID('otheradapter', 'ApexClass', 'instance', 'Bob'),
      new ElemID('salesforce', 'ApexClass', 'instance', 'Analog'),
    ]
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.ApexClass.instance.A*'] }
    )
    expect(selectedElements).toEqual([elements[0], elements[4]])
  })

  it('should handle two asterisks in name', async () => {
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
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.ApexClass.instance.*eric*'] }
    )
    expect(selectedElements).toEqual(
      [elements[0], elements[4], elements[5], elements[6], elements[7]]
    )
  })

  it('should use two selectors and allow any element that matches one of them', async () => {
    const elements = [
      new ElemID('salesforce', 'value'),
      new ElemID('netsuite', 'value'),
      new ElemID('hubspot', 'value'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.*', 'netsuite.*'] })
    expect(selectedElements).toEqual([elements[0], elements[1]])
  })
  it('returns all elements with no selectors', async () => {
    const elements = [
      new ElemID('salesforce', 'value'),
      new ElemID('netsuite', 'value'),
      new ElemID('hubspot', 'value'),
    ]
    expect(await selectElements({ elements, selectors: [] })).toEqual(elements)
  })
  it('should use a wildcard and a specific element id and not throw error if the wildcard covers the element id', async () => {
    const elements = [
      new ElemID('salesforce', 'value'),
    ]
    const selectedElements = await selectElements(
      { elements, selectors: ['salesforce.*', 'salesforce.value'] }
    )
    expect(selectedElements).toEqual([elements[0]])
  })

  // Since element selection is now asynchronous, validation has been removed for now
  // This comment kept as reminder of that possibility
  it('should use case insensitive selectors when specified', async () => {
    const elements = [
      new ElemID('salesfOrce', 'valUe', 'instance', 'heLlo', 'woRld'),
      new ElemID('salesfOrce', 'valUe', 'instance', 'heLlo', 'universe'),
      new ElemID('netsuite', 'dontinclude'),
      new ElemID('NetSuite', 'Value'),
      new ElemID('hubsPot', 'value', 'attr', 'sOmetHing'),
      new ElemID('hubspot', 'value', 'attr', 'other'),
    ]
    const selectedElements = await selectElements({
      elements,
      selectors: ['salesforce.v*ue.INSTANCE.hellO.World', 'netsuitE.v*', 'Hubspot.V*.attR.Something'],
      caseInsensitive: true,
    })
    expect(selectedElements).toEqual([elements[0], elements[3], elements[4]])
  })
})

// eslint-disable-next-line jest/no-disabled-tests
describe.skip('validation tests', () => {
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

  it('should throw error if exact element id filter matches nothing', async () => {
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
    return expect(selectElements({ elements,
      selectors: ['salesforce.*', 'otheradapter.ApexClass.instance.bob2',
        'otheradapter.Apexclass.instance.bob3', 'otheradapter.Apexclass.instance.bob4'] }))
      .rejects.toThrow(new Error('The following salto ids were not found: otheradapter.Apexclass.instance.bob3,otheradapter.Apexclass.instance.bob4'))
  })
  it('should throw error if no filter matches anything', async () => {
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
    return expect(selectElements({ elements,
      selectors: ['nonexistantadapter.ApexClass.instance.*',
        'anothernonexistantadapter.*'] })).rejects.toThrow(new Error('No salto ids matched the provided selectors nonexistantadapter.ApexClass.instance.*,anothernonexistantadapter.*'))
  })
})
describe('select elements recursively', () => {
  const testElements = [mockInstance, mockType]
  const testSelect = async (selectors: ElementSelector[], compact = false): Promise<ElemID[]> =>
    awu(await selectElementIdsByTraversal(
      selectors,
      createInMemoryElementSource(testElements),
      compact,
    )).toArray()
  it('finds subElements one and two layers deep', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.*',
      'mockAdapter.*.instance.*',
      'mockAdapter.*.field.*',
      'mockAdapter.*.field.*.*',
      'mockAdapter.*.attr.testAnno']).validSelectors
    const elementIds = (await testSelect(selectors)).sort((e1,
      e2) => e1.getFullName().localeCompare(e2.getFullName()))
    const expectedElements = [
      mockInstance.elemID,
      mockType.elemID,
      ElemID.fromFullName('mockAdapter.test.field.bool'),
      ElemID.fromFullName('mockAdapter.test.field.strMap'),
      ElemID.fromFullName('mockAdapter.test.field.strMap._required'),
      ElemID.fromFullName('mockAdapter.test.field.obj'),
      ElemID.fromFullName('mockAdapter.test.field.num'),
      ElemID.fromFullName('mockAdapter.test.field.strArray'),
      ElemID.fromFullName('mockAdapter.test.attr.testAnno'),
    ].sort((e1,
      e2) => e1.getFullName().localeCompare(e2.getFullName()))
    expect(elementIds).toEqual(expectedElements)
  })
  it('returns nothing with non-matching subelements', async () => {
    const selectors = createElementSelectors(['mockAdapter.test.instance.mockInstance.obj.NoSuchThingExists*']).validSelectors
    const elementIds = await testSelect(selectors)
    expect(elementIds).toEqual([])
  })
  it('removes fields of type from list when compact', async () => {
    const selectors = createElementSelectors(['mockAdapter.*', 'mockAdapter.*.field.*',
      'mockAdapter.test.field.strMap.*']).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([mockType.elemID])
  })

  it('removes child elements of field from list', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.test.field.strMap']).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('ignores multiple instances of the same', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.test.field.strMap']).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('removes child elements of field selected by wildcard from list', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.*.field.strMap']).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('should return only the exact match when the selector is a valid elemID', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.bool',
    ]).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.instance.mockInstance.bool')])
  })
  it('should not return non-existent element id', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.thispropertydoesntexist',
      'mockAdapter.test.field.strMap',
    ]).validSelectors
    const elementIds = await awu(await selectElementIdsByTraversal(
      selectors,
      createInMemoryElementSource([mockInstance, mockType]),
      false,
    )).toArray()
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })
})
