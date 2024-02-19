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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  ReferenceExpression,
  StaticFile,
  TemplateExpression,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'

export const getName: GetLookupNameFunc = ({ ref }) => ref.value
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
    ref: { refType: BuiltinTypes.STRING },
    str: { refType: BuiltinTypes.STRING, annotations: { testAnno: 'TEST FIELD ANNO' } },
    file: { refType: BuiltinTypes.STRING },
    bool: { refType: BuiltinTypes.BOOLEAN },
    num: { refType: BuiltinTypes.NUMBER },
    numArray: { refType: new ListType(BuiltinTypes.NUMBER) },
    strArray: { refType: new ListType(BuiltinTypes.STRING) },
    numMap: { refType: new MapType(BuiltinTypes.NUMBER) },
    strMap: { refType: new MapType(BuiltinTypes.STRING) },
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
            innerObj: {
              refType: new ObjectType({
                elemID: mockElem,
                fields: {
                  name: { refType: BuiltinTypes.STRING },
                  listOfNames: {
                    refType: new ListType(BuiltinTypes.STRING),
                  },
                  magical: {
                    refType: new ObjectType({
                      elemID: mockElem,
                      fields: {
                        deepNumber: { refType: BuiltinTypes.NUMBER },
                        deepName: { refType: BuiltinTypes.STRING },
                      },
                    }),
                  },
                },
              }),
            },
          },
        }),
      ),
    },
  },
  path: ['this', 'is', 'happening'],
})
export const regValue = 'regValue'
export const valueRef = new ReferenceExpression(mockElem, regValue, mockType)
export const fileContent = 'bb'
export const valueFile = new StaticFile({ filepath: 'aa', content: Buffer.from(fileContent) })

export const templateElemID = new ElemID('template', 'test')
export const templateElemID2 = new ElemID('template2', 'test2')
const templateRef = new TemplateExpression({
  parts: ['this is:', new ReferenceExpression(templateElemID), 'a template', new ReferenceExpression(templateElemID2)],
})
export const mockInstance = new InstanceElement(
  'mockInstance',
  mockType,
  {
    ref: valueRef,
    templateRef,
    str: 'val',
    bool: 'true',
    num: '99',
    numArray: ['12', '13', '14'],
    strArray: 'should be list',
    numMap: { key12: 12, num13: 13 },
    strMap: { a: 'a', bla: 'BLA' },
    notExist: 'notExist',
    notExistArray: ['', ''],
    file: valueFile,
    obj: [
      {
        field: 'firstField',
        otherField: "doesn't matter",
        value: {
          val: 'someString',
          anotherVal: { objTest: '123' },
        },
        mapOfStringList: {
          l1: ['aaa', 'bbb'],
          l2: ['ccc', 'ddd'],
        },
        innerObj: {
          name: 'oren',
          listOfNames: ['abc', 'qwe', 'opiu'],
          magical: {
            deepNumber: '888',
            deepName: 'innerName',
          },
        },
      },
      {
        field: 'true',
        undeployable: valueRef,
        value: ['123', '456'],
        mapOfStringList: { something: [] },
        innerObj: {
          name: 'name1',
          listOfNames: ['', '', ''],
          magical: {
            deepName: 'innerName1',
            notExist2: 'false',
          },
        },
      },
      {
        field: '123',
        innerObj: {
          name: 'name1',
          undeployable: new ReferenceExpression(new ElemID('mockAdapter', 'test2', 'field', 'aaa')),
          listOfNames: ['str4', 'str1', 'str2'],
          magical: {
            deepNumber: '',
            deepName: '',
          },
        },
      },
      {},
    ],
    objWithInnerObj: {
      innerObj: {
        listKey: [1, 2],
        stringKey: 'val2',
      },
    },
  },
  ['yes', 'this', 'is', 'path'],
  {
    [CORE_ANNOTATIONS.DEPENDS_ON]: { reference: valueRef },
  },
)
