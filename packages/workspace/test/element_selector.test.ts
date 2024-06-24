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
import {
  ElemID,
  PrimitiveTypes,
  ObjectType,
  PrimitiveType,
  BuiltinTypes,
  ListType,
  MapType,
  InstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  selectElementsBySelectors,
  createElementSelectors,
  createElementSelector,
  selectElementIdsByTraversal,
  selectElementsBySelectorsWithoutReferences,
  ElementSelector,
} from '../src/workspace/element_selector'
import { createInMemoryElementSource } from '../src/workspace/elements_source'
import { InMemoryRemoteMap, RemoteMap } from '../src/workspace/remote_map'
import { createMockRemoteMap } from './utils'

const { awu } = collections.asynciterable

const mockStrType = new PrimitiveType({
  elemID: new ElemID('mockAdapter', 'str'),
  primitive: PrimitiveTypes.STRING,
  annotations: { testAnno: 'TEST ANNO TYPE' },
  path: ['here', 'we', 'go'],
})
const mockPrimitive = new ListType(BuiltinTypes.BOOLEAN)
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
    strMap: {
      refType: new MapType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
    obj: {
      refType: new ListType(
        new ObjectType({
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
        }),
      ),
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
  elements,
  selectors,
  caseInsensitive = false,
  includeNested = false,
}: {
  elements: ElemID[]
  selectors: string[]
  caseInsensitive?: boolean
  includeNested?: boolean
}): Promise<ElemID[]> =>
  awu(
    selectElementsBySelectors({
      elementIds: awu(elements),
      selectors: createElementSelectors(selectors, caseInsensitive).validSelectors,
      referenceSourcesIndex: createMockRemoteMap<ElemID[]>(),
      includeNested,
    }),
  ).toArray()

const selectElementsWitoutRef = ({
  elements,
  selectors,
  includeNested = false,
}: {
  elements: ElemID[]
  selectors: string[]
  includeNested?: boolean
}): ElemID[] =>
  selectElementsBySelectorsWithoutReferences({
    elementIds: elements,
    selectors: createElementSelectors(selectors).validSelectors,
    includeNested,
  })

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

  it('should only select specific types when given multiple typeNames', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'sometypewithsameprefix'),
      new ElemID('salesforce', 'withsamesuffixsometype'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertypewithsameprefix'),
      new ElemID('salesforce', 'withsamesuffixothertype'),
      new ElemID('otheradapter', 'sometype'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'y'),
      new ElemID('salesforce', 'sometype', 'instance', 'x'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.sometype|othertype'] })
    expect(selectedElements).toEqual([elements[0], elements[3]])
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
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(await selectElements({ elements, selectors: ['salesforce.*.instance.A'] })).toEqual([elements[0]])
    expect(await selectElements({ elements, selectors: ['salesforce.*.instance._config'] })).toEqual([elements[4]])
  })

  it('should select also nested elements when includeNested is true and name selectors length is 1', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(await selectElements({ elements, selectors: ['salesforce.*.instance.A'], includeNested: true })).toEqual([
      elements[0],
      elements[1],
      elements[2],
    ])
    expect(
      await selectElements({ elements, selectors: ['salesforce.*.instance._config'], includeNested: true }),
    ).toEqual([elements[4], elements[5]])
  })

  it('should select fields and attributes when includeNested is true', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'sometype', 'field', 'A'),
      new ElemID('salesforce', 'sometype', 'attr', 'B', 'B', 'C'),
      new ElemID('salesforce', 'sometype', 'instance', 'NotA'),
    ]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.*'], includeNested: true })
    expect(selectedElements).toEqual([elements[0], elements[1], elements[2]])
  })

  it('should select elements with the same selector length when includeNested is false and name selectors length is 2', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA', 'B'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(await selectElements({ elements, selectors: ['salesforce.*.instance.A.*'] })).toEqual([elements[1]])
    expect(await selectElements({ elements, selectors: ['salesforce.*.instance._config.*'] })).toEqual([elements[5]])
  })

  it('should select also nested elements when includeNested is true and name selectors length is 2', async () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA', 'B'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(await selectElements({ elements, selectors: ['salesforce.*.instance.A.*'], includeNested: true })).toEqual([
      elements[1],
      elements[2],
    ])
    expect(
      await selectElements({ elements, selectors: ['salesforce.*.instance._config.*'], includeNested: true }),
    ).toEqual([elements[5]])
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
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.ApexClass.instance.A*'] })
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
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.ApexClass.instance.*eric*'] })
    expect(selectedElements).toEqual([elements[0], elements[4], elements[5], elements[6], elements[7]])
  })

  it('should use two selectors and allow any element that matches one of them', async () => {
    const elements = [new ElemID('salesforce', 'value'), new ElemID('netsuite', 'value'), new ElemID('jira', 'value')]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.*', 'netsuite.*'] })
    expect(selectedElements).toEqual([elements[0], elements[1]])
  })
  it('returns all elements with no selectors', async () => {
    const elements = [new ElemID('salesforce', 'value'), new ElemID('netsuite', 'value'), new ElemID('jira', 'value')]
    expect(await selectElements({ elements, selectors: [] })).toEqual(elements)
  })
  it('should use a wildcard and a specific element id and not throw error if the wildcard covers the element id', async () => {
    const elements = [new ElemID('salesforce', 'value')]
    const selectedElements = await selectElements({ elements, selectors: ['salesforce.*', 'salesforce.value'] })
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
      new ElemID('jira', 'value', 'attr', 'other'),
    ]
    const selectedElements = await selectElements({
      elements,
      selectors: ['salesforce.v*ue.instance.hellO.World', 'netsuitE.v*', 'Hubspot.V*.attr.Something'],
      caseInsensitive: true,
    })
    expect(selectedElements).toEqual([elements[0], elements[3], elements[4]])
  })
})

describe('validation tests', () => {
  it('should throw error when invalid selector is given', () => {
    const invalidFilters = ['salesforce.Account.*', 'salesforce', '']
    expect(() => {
      createElementSelector('salesforce.Account.*')
    }).toThrow(
      new Error('Illegal element selector includes illegal type name: "*". Full selector is: "salesforce.Account.*"'),
    )
    expect(() => {
      createElementSelector('salesforce')
    }).toThrow(new Error('Illegal element selector does not contain type name: "salesforce"'))
    expect(() => {
      createElementSelector('')
    }).toThrow(new Error('Illegal element selector does not contain adapter expression: ""'))
    expect(createElementSelectors(invalidFilters).invalidSelectors).toEqual(invalidFilters)
    expect(() => {
      createElementSelector('dummy.someType.')
    }).toThrow(new Error('Illegal element selector is not a valid element ID: "dummy.someType."'))
  })
})
describe('select elements recursively', () => {
  const testElements = [mockInstance, mockType, mockPrimitive]
  const testSelect = async (selectors: ElementSelector[], compact = false): Promise<ElemID[]> =>
    awu(
      await selectElementIdsByTraversal({
        selectors,
        source: createInMemoryElementSource(testElements),
        referenceSourcesIndex: createMockRemoteMap<ElemID[]>(),
        compact,
      }),
    ).toArray()
  it('finds subElements one and two layers deep', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.*',
      'mockAdapter.*.instance.*',
      'mockAdapter.*.field.*',
      'mockAdapter.*.field.*.*',
      'mockAdapter.*.attr.testAnno',
    ]).validSelectors
    const elementIds = (await testSelect(selectors)).sort((e1, e2) => e1.getFullName().localeCompare(e2.getFullName()))
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
    ].sort((e1, e2) => e1.getFullName().localeCompare(e2.getFullName()))
    expect(elementIds).toEqual(expectedElements)
  })

  it('finds the required id for a single top level element', async () => {
    const selectors = createElementSelectors([mockElem.getFullName()]).validSelectors
    const elementIds = await testSelect(selectors)
    expect(elementIds).toEqual([mockElem])
  })

  it('returns nothing with non-matching subelements', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.obj.NoSuchThingExists*',
    ]).validSelectors
    const elementIds = await testSelect(selectors)
    expect(elementIds).toEqual([])
  })
  it('removes fields of type from list when compact', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.*',
      'mockAdapter.*.field.*',
      'mockAdapter.test.field.strMap.*',
    ]).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([mockType.elemID])
  })

  it('removes child elements of field from list', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.test.field.strMap',
    ]).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('ignores multiple instances of the same', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.test.field.strMap',
    ]).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('removes child elements of field selected by wildcard from list', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.field.strMap.*',
      'mockAdapter.*.field.strMap',
    ]).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })

  it('should return only the exact match when the selector is a valid elemID', async () => {
    const selectors = createElementSelectors(['mockAdapter.test.instance.mockInstance.bool']).validSelectors
    const elementIds = await testSelect(selectors, true)
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.instance.mockInstance.bool')])
  })
  it('should not return non-existent element id when some selectors have wildcard', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.thispropertydoesntexist',
      'mockAdapter.test.field.strMap',
      'mockAdapter.*.field.strMap',
    ]).validSelectors
    const elementIds = await awu(
      await selectElementIdsByTraversal({
        selectors,
        source: createInMemoryElementSource([mockInstance, mockType]),
        referenceSourcesIndex: createMockRemoteMap<ElemID[]>(),
        compact: false,
      }),
    ).toArray()
    expect(elementIds).toEqual([ElemID.fromFullName('mockAdapter.test.field.strMap')])
  })
  it('should return all element ids when there are no wildcards', async () => {
    const selectors = createElementSelectors([
      'mockAdapter.test.instance.mockInstance.thispropertydoesntexist',
      'mockAdapter.test.field.strMap',
    ]).validSelectors
    const elementIds = await awu(
      await selectElementIdsByTraversal({
        selectors,
        source: createInMemoryElementSource([mockInstance, mockType]),
        referenceSourcesIndex: createMockRemoteMap<ElemID[]>(),
        compact: false,
      }),
    ).toArray()
    expect(elementIds).toEqual([
      ElemID.fromFullName('mockAdapter.test.instance.mockInstance.thispropertydoesntexist'),
      ElemID.fromFullName('mockAdapter.test.field.strMap'),
    ])
  })
})

describe('referencedBy', () => {
  let referenceSourcesIndex: RemoteMap<ElemID[]>

  const objectType = new ObjectType({
    elemID: new ElemID('salesforce', 'type'),
    fields: {
      field1: { refType: BuiltinTypes.STRING },
      field2: { refType: BuiltinTypes.STRING },
    },
  })

  const anotherObjectType = new ObjectType({
    elemID: new ElemID('salesforce', 'type2'),
    fields: {
      field1: { refType: BuiltinTypes.STRING },
      field2: { refType: BuiltinTypes.STRING },
    },
  })

  beforeEach(() => {
    referenceSourcesIndex = new InMemoryRemoteMap<ElemID[]>()
  })

  it('should return referenced instances', async () => {
    const [selector] = createElementSelectors(['salesforce.*.instance.*']).validSelectors
    const [referencedBy] = createElementSelectors(['workato.*.instance.*']).validSelectors

    selector.referencedBy = referencedBy

    await referenceSourcesIndex.set('salesforce.type.instance.inst1', [
      new ElemID('workato', 'type', 'instance', 'inst1', 'val'),
    ])

    const elements = [new InstanceElement('inst1', objectType), new InstanceElement('inst2', objectType)]

    const selectedElements = await awu(
      await selectElementIdsByTraversal({
        selectors: [selector],
        source: createInMemoryElementSource(elements),
        referenceSourcesIndex,
      }),
    ).toArray()

    expect(selectedElements).toEqual([elements[0].elemID])
  })

  describe('when a field is referenced', () => {
    beforeEach(async () => {
      await referenceSourcesIndex.set('salesforce.type.field.field1', [
        new ElemID('workato', 'type', 'instance', 'inst1', 'val'),
      ])
      await referenceSourcesIndex.set('salesforce.type', [new ElemID('workato', 'type', 'instance', 'inst1', 'val')])
    })

    it('should return the type of the referenced field', async () => {
      const [selector] = createElementSelectors(['salesforce.*']).validSelectors
      const [referencedBy] = createElementSelectors(['workato.*.instance.*']).validSelectors

      selector.referencedBy = referencedBy

      const elements = [objectType, anotherObjectType]

      const selectedElements = await awu(
        await selectElementIdsByTraversal({
          selectors: [selector],
          source: createInMemoryElementSource(elements),
          referenceSourcesIndex,
        }),
      ).toArray()

      expect(selectedElements).toEqual([objectType.elemID])
    })

    it('should return the referenced field', async () => {
      const [selector] = createElementSelectors(['salesforce.*.field.*']).validSelectors
      const [referencedBy] = createElementSelectors(['workato.*.instance.*']).validSelectors

      selector.referencedBy = referencedBy

      const elements = [objectType, anotherObjectType]

      const selectedElements = await awu(
        await selectElementIdsByTraversal({
          selectors: [selector],
          source: createInMemoryElementSource(elements),
          referenceSourcesIndex,
        }),
      ).toArray()

      expect(selectedElements).toEqual([objectType.fields.field1.elemID])
    })
  })

  it('should return referenced types', async () => {
    await referenceSourcesIndex.set('salesforce.type', [new ElemID('workato', 'type', 'instance', 'inst1', 'val')])
    await referenceSourcesIndex.set('salesforce.type2', [new ElemID('workato', 'type', 'instance', 'inst1', 'val2')])

    const [selector] = createElementSelectors(['salesforce.*']).validSelectors
    const [referencedBy] = createElementSelectors(['workato.*.instance.*.val']).validSelectors

    selector.referencedBy = referencedBy

    const elements = [objectType, anotherObjectType]

    const selectedElements = await awu(
      await selectElementIdsByTraversal({
        selectors: [selector],
        source: createInMemoryElementSource(elements),
        referenceSourcesIndex,
      }),
    ).toArray()

    expect(selectedElements).toEqual([objectType.elemID])
  })

  it('should throw an error if selector is not for base ids', async () => {
    const [selector] = createElementSelectors(['salesforce.*.instance.*.aa']).validSelectors
    const [referencedBy] = createElementSelectors(['workato.*.instance.*']).validSelectors

    selector.referencedBy = referencedBy

    await expect(
      selectElementIdsByTraversal({
        selectors: [selector],
        source: createInMemoryElementSource([]),
        referenceSourcesIndex,
      }),
    ).rejects.toThrow()
  })
})

describe('element selector without ref by', () => {
  it('should handle asterisks in adapter and type', () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance'),
    ]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['*.*'] })
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
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.sometype'] })
    expect(selectedElements).toEqual([elements[0]])
  })

  it('should only select specific types when given multiple typeNames', () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'sometypewithsameprefix'),
      new ElemID('salesforce', 'withsamesuffixsometype'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('salesforce', 'othertypewithsameprefix'),
      new ElemID('salesforce', 'withsamesuffixothertype'),
      new ElemID('otheradapter', 'sometype'),
      new ElemID('otheradapter', 'othertype'),
      new ElemID('salesforce', 'othertype', 'instance', 'y'),
      new ElemID('salesforce', 'sometype', 'instance', 'x'),
    ]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.sometype|othertype'] })
    expect(selectedElements).toEqual([elements[0], elements[3]])
  })

  it('should handle asterisks in field type and instance name', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'one_instance'),
      new ElemID('salesforce', 'sometype', 'instance', 'second_instance_specialchar@s'),
      new ElemID('salesforce', 'othertype', 'type', 'typename'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some_other_instance2'),
      new ElemID('salesforce', 'othertype', 'instance', 'some_other_instance'),
    ]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance.*'] })
    expect(selectedElements).toEqual([elements[0], elements[1], elements[4]])
  })

  it('should select elements with the same selector length when includeNested is false and name selectors length is 1', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance.A'] })).toEqual([elements[0]])
    expect(selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance._config'] })).toEqual([elements[4]])
  })

  it('should select also nested elements when includeNested is true and name selectors length is 1', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance.A'], includeNested: true })).toEqual([
      elements[0],
      elements[1],
      elements[2],
    ])
    expect(
      selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance._config'], includeNested: true }),
    ).toEqual([elements[4], elements[5]])
  })

  it('should select fields and attributes when includeNested is true', () => {
    const elements = [
      new ElemID('salesforce', 'sometype'),
      new ElemID('salesforce', 'sometype', 'field', 'A'),
      new ElemID('salesforce', 'sometype', 'attr', 'B', 'B', 'C'),
      new ElemID('salesforce', 'sometype', 'instance', 'NotA'),
    ]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.*'], includeNested: true })
    expect(selectedElements).toEqual([elements[0], elements[1], elements[2]])
  })

  it('should select elements with the same selector length when includeNested is false and name selectors length is 2', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA', 'B'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance.A.*'] })).toEqual([elements[1]])
    expect(selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance._config.*'] })).toEqual([elements[5]])
  })

  it('should select also nested elements when includeNested is true and name selectors length is 2', () => {
    const elements = [
      new ElemID('salesforce', 'sometype', 'instance', 'A'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B'),
      new ElemID('salesforce', 'sometype', 'instance', 'A', 'B', 'C'),
      new ElemID('salesforce', 'othertype', 'instance', 'NotA', 'B'),
      new ElemID('salesforce', 'othertype', 'instance', '_config'),
      new ElemID('salesforce', 'othertype', 'instance', '_config', 'B'),
    ]
    expect(
      selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance.A.*'], includeNested: true }),
    ).toEqual([elements[1], elements[2]])
    expect(
      selectElementsWitoutRef({ elements, selectors: ['salesforce.*.instance._config.*'], includeNested: true }),
    ).toEqual([elements[5]])
  })

  it('should handle asterisks alongside partial names in type', () => {
    const elements = [
      new ElemID('salesforce', 'sometype__c'),
      new ElemID('salesforce', 'othertype'),
      new ElemID('otheradapter', 'othertype', 'instance', 'some other instace2'),
      new ElemID('salesforce', 'othertype__c'),
    ]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.*__c'] })
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
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.ApexClass.instance.A*'] })
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
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.ApexClass.instance.*eric*'] })
    expect(selectedElements).toEqual([elements[0], elements[4], elements[5], elements[6], elements[7]])
  })

  it('should use two selectors and allow any element that matches one of them', () => {
    const elements = [new ElemID('salesforce', 'value'), new ElemID('netsuite', 'value'), new ElemID('jira', 'value')]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.*', 'netsuite.*'] })
    expect(selectedElements).toEqual([elements[0], elements[1]])
  })
  it('returns all elements with no selectors', () => {
    const elements = [new ElemID('salesforce', 'value'), new ElemID('netsuite', 'value'), new ElemID('jira', 'value')]
    expect(selectElementsWitoutRef({ elements, selectors: [] })).toEqual(elements)
  })
  it('should use a wildcard and a specific element id and not throw error if the wildcard covers the element id', () => {
    const elements = [new ElemID('salesforce', 'value')]
    const selectedElements = selectElementsWitoutRef({ elements, selectors: ['salesforce.*', 'salesforce.value'] })
    expect(selectedElements).toEqual([elements[0]])
  })
})
