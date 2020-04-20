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
import { ListType, ElemID, Field, ObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import { HUBSPOT } from '../../src/constants'

const objectElemID = new ElemID(HUBSPOT, 'object')
const innerObjectElemID = new ElemID(HUBSPOT, 'innerObject')
const simpleField = (name: string, parentElemID: ElemID): Field =>
  new Field(
    parentElemID, name,
    Types.userIdentifierType, {
      name,
      _readOnly: false,
    },
  )
const stringListField = (parentElemID: ElemID): Field =>
  new Field(
    parentElemID, 'stringList',
    new ListType(Types.userIdentifierType), {
      name: 'stringList',
      _readOnly: false,
    },
  )
const stringArrayField = (parentElemID: ElemID): Field =>
  new Field(
    parentElemID, 'stringArray',
    new ListType(Types.userIdentifierType), {
      name: 'stringArray',
      _readOnly: false,
    },
  )
const strField = (parentElemID: ElemID): Field =>
  new Field(
    parentElemID, 'str', BuiltinTypes.STRING, {
      name: 'str',
    }
  )
const innerObject = new ObjectType(
  {
    elemID: innerObjectElemID,
    fields: {
      str: strField(innerObjectElemID),
      simple: simpleField('simple', innerObjectElemID),
      simpleNum: simpleField('simpleNum', innerObjectElemID),
      stringList: stringListField(innerObjectElemID),
      stringArray: stringArrayField(innerObjectElemID),
    },
  }
)
export const useridentifierObjectType = new ObjectType(
  {
    elemID: objectElemID,
    fields: {
      str: strField(objectElemID),
      simple: simpleField('simple', objectElemID),
      simpleNum: simpleField('simpleNum', objectElemID),
      stringList: stringListField(objectElemID),
      stringArray: stringArrayField(objectElemID),
      objField: new Field(
        objectElemID, 'objField', innerObject, {
          name: 'objField',
          _readOnly: false,
        },
      ),
      listOfObjField: new Field(
        objectElemID, 'listOfObjField',
        new ListType(innerObject), {
          name: 'listOfObjField',
          _readOnly: false,
        },
      ),
    },
  }
)
