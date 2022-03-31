/*
*                      Copyright 2022 Salto Labs Ltd.
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

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { AUTOMATION_TYPE, JIRA } from '../../constants'

export const createAutomationTypes = (): {
  automationType: ObjectType
  subTypes: ObjectType[]
} => {
  const actorType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationActor'),
    fields: {
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationActor'],
  })

  const componentType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationComponent'),
    fields: {
      component: { refType: BuiltinTypes.STRING },
      schemeVersion: { refType: BuiltinTypes.NUMBER },
      type: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.UNKNOWN },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationComponent'],
  })

  componentType.fields.children = new Field(
    componentType,
    'children',
    new ListType(componentType),
  )

  const tagType = new ObjectType({
    elemID: new ElemID(JIRA, 'AutomationTag'),
    fields: {
      tagType: { refType: BuiltinTypes.STRING },
      tagValue: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, 'AutomationTag'],
  })

  const automationType = new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_TYPE),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
      name: { refType: BuiltinTypes.STRING },
      state: { refType: BuiltinTypes.STRING },
      authorAccountId: { refType: BuiltinTypes.STRING },
      actor: { refType: actorType },
      projects: { refType: new ListType(BuiltinTypes.STRING) },
      trigger: { refType: componentType },
      components: { refType: new ListType(componentType) },
      tags: { refType: new ListType(tagType) },
      canOtherRuleTrigger: { refType: BuiltinTypes.BOOLEAN },
      notifyOnError: { refType: BuiltinTypes.STRING },
      writeAccessType: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elements.TYPES_PATH, AUTOMATION_TYPE],
  })

  return {
    automationType,
    subTypes: [actorType, componentType, tagType],
  }
}
