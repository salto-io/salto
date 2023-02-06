/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Change, Field, FieldDefinition, getChangeData, InstanceElement, isInstanceChange, isInstanceElement, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PARENT, SCRIPT_ID, SOAP_SCRIPT_ID } from '../constants'
import { FilterWith } from '../filter'
import { isCustomRecordType } from '../types'

const { awu } = collections.asynciterable

const REC_TYPE = 'recType'
const FIELDS_TO_DELETE = [REC_TYPE, 'owner', 'customForm', 'created', 'lastModified']

const addFieldsToType = (type: ObjectType): void => {
  const fieldNameToDef: Record<string, FieldDefinition> = {
    [PARENT]: {
      refType: type,
      annotations: { isReference: true },
    },
    [REC_TYPE]: {
      refType: type,
      annotations: { isReference: true },
    },
  }

  Object.entries(fieldNameToDef)
    .forEach(([fieldName, { refType, annotations }]) => {
      type.fields[fieldName] = new Field(type, fieldName, refType, annotations)
    })
}

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  name: 'customRecordsFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isCustomRecordType(await instance.getType()))
      .forEach(async instance => {
        FIELDS_TO_DELETE.forEach(fieldName => {
          delete instance.value[fieldName]
        })
      })
  },
  preDeploy: async changes => {
    const typeSet = new Set<string>()
    await awu(changes)
      .filter(isInstanceChange)
      .map(async (change: Change<InstanceElement>) => ({
        action: change.action,
        instance: getChangeData(change),
        type: await getChangeData(change).getType(),
      }))
      .filter(({ type }) => isCustomRecordType(type))
      .forEach(({ action, instance, type }) => {
        if (!typeSet.has(type.elemID.name)) {
          addFieldsToType(type)
          typeSet.add(type.elemID.name)
        }
        instance.value[REC_TYPE] = new ReferenceExpression(type.elemID, type)
        if (action === 'add') {
          instance.value[SOAP_SCRIPT_ID] = instance.value[SCRIPT_ID]
          delete instance.value[SCRIPT_ID]
        }
      })
  },
})

export default filterCreator
