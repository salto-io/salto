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
import { ListType, ElemID, ObjectType, BuiltinTypes, TypeElement, FieldDefinition } from '@salto-io/adapter-api'
import { Types } from '../../src/transformers/transformer'
import { HUBSPOT } from '../../src/constants'

const objectElemID = new ElemID(HUBSPOT, 'object')
const innerObjectElemID = new ElemID(HUBSPOT, 'innerObject')
const simpleField = (
  name: string, type: TypeElement = Types.userIdentifierType,
): FieldDefinition => (
  { name, type, annotations: { name, _readOnly: false } }
)

const stringListField = (name: string): ReturnType<typeof simpleField> =>
  simpleField(name, new ListType(Types.userIdentifierType))

const strField = {
  name: 'str',
  type: BuiltinTypes.STRING,
  annotations: {
    name: 'str',
  },
}

const innerObject = new ObjectType(
  {
    elemID: innerObjectElemID,
    fields: [
      strField,
      simpleField('simple'),
      simpleField('simpleNum'),
      stringListField('stringList'),
      stringListField('stringArray'),
    ],
  }
)
export const useridentifierObjectType = new ObjectType(
  {
    elemID: objectElemID,
    fields: [
      strField,
      simpleField('simple'),
      simpleField('simpleNum'),
      stringListField('stringList'),
      stringListField('stringArray'),
      simpleField('objField', innerObject),
      simpleField('listOfObjField', new ListType(innerObject)),
      simpleField('listOfListOfObjField', new ListType(new ListType(innerObject))),
      simpleField('listOfListOfListOfObjField', new ListType(new ListType(new ListType(innerObject)))),
    ],
  }
)
