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
import { ObjectType, ElemID, BuiltinTypes, ListType, InstanceElement, TypeReference, DetailedChange, isObjectType, isInstanceElement, Variable } from '@salto-io/adapter-api'
import { getUpdatedTopLevelElements } from '../../src/workspace/update_elements'
import { State } from '../../src/workspace/state'
import { mockState } from '../common/state'

const nestedType = new ObjectType({
  elemID: new ElemID('salto', 'nested'),
  fields: {
    str: {
      refType: BuiltinTypes.STRING,
    },
    num: {
      refType: BuiltinTypes.NUMBER,
    },
    list: {
      refType: new ListType(BuiltinTypes.NUMBER),
    },
  },
})

const objectA = new ObjectType({
  elemID: new ElemID('salto', 'obj'),
  fields: {
    simple: {
      refType: BuiltinTypes.STRING,
      annotations: {
        apiName: 'original',
      },
    },
    id: {
      refType: BuiltinTypes.STRING,
      annotations: {
        name: 'nick',
      },
    },
    nested: {
      refType: nestedType,
      annotations: {
        str: 'Str',
        num: 10,
        list: ['A', 'B', 'C'],
      },
    },
  },
  annotationRefsOrTypes: {
    simple: BuiltinTypes.STRING,
    nested: nestedType,
  },
  annotations: {
    simple: 'simple',
    nested: {
      str: 'Str',
      num: 7,
      list: [1, 2, 3],
    },
  },
})

const instanceTypeID = new ElemID('salto', 'obj')
const instanceA = new InstanceElement(
  'inst',
  new TypeReference(instanceTypeID),
  {
    a: 'A',
  },
  undefined,
  {
    ann: 'off',
  }
)

const varElemId = new ElemID('var', 'samobar')
const variableElement = new Variable(varElemId, 555)

describe('getUpdatedTopLevelElements', () => {
  let state: State
  beforeAll(async () => {
    const elements = [nestedType, objectA, instanceA, variableElement]
    state = mockState(elements)
  })
  it('should return updated field in ObjectType', async () => {
    const changes: DetailedChange[] = [
      {
        id: new ElemID('salto', 'obj', 'field', 'simple', 'apiName'),
        action: 'modify',
        data: {
          before: 'original',
          after: 'changed',
        },
      },
    ]
    const updatedElement = (await getUpdatedTopLevelElements(state, changes))[0] as ObjectType
    expect(updatedElement.elemID).toEqual(new ElemID('salto', 'obj'))
    expect(updatedElement.fields.simple.annotations.apiName).toEqual('changed')
  })
  it('should return updated annotation in ObjectType', async () => {
    const changes: DetailedChange[] = [
      {
        id: new ElemID('salto', 'obj', 'annotation', 'nested', 'num'),
        action: 'modify',
        data: {
          before: 7,
          after: 8,
        },
      },
    ]
    const updatedElement = (await getUpdatedTopLevelElements(state, changes))[0] as ObjectType
    expect(updatedElement.elemID).toEqual(new ElemID('salto', 'obj'))
    expect(updatedElement.annotations.nested.num).toEqual(8)
  })
  it('should return updated element with multiple changes', async () => {
    const changes: DetailedChange[] = [
      {
        id: new ElemID('salto', 'obj', 'field', 'id', 'name'),
        action: 'modify',
        data: {
          before: 'nick',
          after: 'nock',
        },
      },
      {
        id: new ElemID('salto', 'obj', 'field', 'nested', 'list', '1'),
        action: 'modify',
        data: {
          before: 'B',
          after: 'Z',
        },
      },
      {
        id: new ElemID('salto', 'obj', 'annotation', 'simple'),
        action: 'modify',
        data: {
          before: 'simple',
          after: 'complex',
        },
      },
    ]
    const updatedElement = await getUpdatedTopLevelElements(state, changes)
    expect(updatedElement.length).toEqual(1)
    const element = updatedElement[0] as ObjectType
    expect(element.fields.id.annotations.name).toEqual('nock')
    expect(element.fields.nested.annotations.list[1]).toEqual('Z')
    expect(element.annotations.simple).toEqual('complex')
  })
  it('should return updated value in InstanceElement', async () => {
    const changes: DetailedChange[] = [
      {
        id: new ElemID('salto', 'obj', 'instance', 'inst', 'a'),
        action: 'modify',
        data: {
          before: 'A',
          after: 'B',
        },
      },
      {
        id: new ElemID('salto', 'obj', 'instance', 'inst', 'ann'),
        action: 'modify',
        data: {
          before: 'off',
          after: 'on',
        },
      },
    ]
    const updatedElement = (await getUpdatedTopLevelElements(state, changes))[0] as InstanceElement
    expect(updatedElement.elemID).toEqual(new ElemID('salto', 'obj', 'instance', 'inst'))
    expect(updatedElement.value).toEqual({ a: 'B' })
    expect(updatedElement.annotations).toEqual({ ann: 'on' })
  })
  it('should return multiple updated elements', async () => {
    const changes: DetailedChange[] = [
      {
        id: new ElemID('salto', 'obj', 'instance', 'inst', 'a'),
        action: 'modify',
        data: {
          before: 'A',
          after: 'R',
        },
      },
      {
        id: new ElemID('salto', 'obj', 'field', 'id', 'name'),
        action: 'modify',
        data: {
          before: 'nick',
          after: 'rick',
        },
      },
    ]
    const updatedElements = await getUpdatedTopLevelElements(state, changes)
    expect(updatedElements.length).toEqual(2)
    expect(updatedElements.find(isInstanceElement)?.value.a).toEqual('R')
    expect(updatedElements.find(isObjectType)?.fields.id.annotations.name).toEqual('rick')
  })
  it('should return updated value in Variable', async () => {
    const changes: DetailedChange[] = [
      {
        id: new ElemID('var', 'samobar', 'var'),
        action: 'modify',
        data: {
          before: 555,
          after: 666,
        },
      },
    ]
    const updatedElement = (await getUpdatedTopLevelElements(state, changes))[0] as Variable
    expect(updatedElement.elemID).toEqual(new ElemID('var', 'samobar', 'var'))
    expect(updatedElement.value).toEqual(666)
  })
})
