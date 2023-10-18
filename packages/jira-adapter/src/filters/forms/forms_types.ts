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

import { ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, ListType } from '@salto-io/adapter-api'
import Joi from 'joi'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { JIRA, FORM_TYPE } from '../../constants'

export type detailedFormResponse = {
  data: {
    uuid?: string
    publish?: string
    id: number
    design: {
      settings: {
        templateFormUuid?: string
      }
      questions: {}
      sections: {}
      conditions: {}
    }
  }
}

type formResponse = {
  id: number
  name: string
}

export type formsResponse = {
  data: formResponse[]
}

export const FORMS_RESPONSE_SCHEME = Joi.object({
  data: Joi.array().items(Joi.object({
  }).unknown(true).required()),
}).unknown(true).required()

export const DETAILED_FORM_RESPONSE_SCHEME = Joi.object({
  data: Joi.object({
    uuid: Joi.string().required(),
    design: Joi.object({
    }).unknown(true).required(),
  }).unknown(true).required(),
}).unknown(true).required()


export const createFormType = (): {
    formType: ObjectType
    subTypes: ObjectType[]
  } => {
  const FormSubmitType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormSubmitettings'),
    fields: {
      lock: {
        refType: BuiltinTypes.BOOLEAN,
      },
      pdf: {
        refType: BuiltinTypes.BOOLEAN,
      },
    },
  })

  const FormSettingsType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormSettings'),
    fields: {
      templateId: {
        refType: BuiltinTypes.NUMBER,
      },
      name: {
        refType: BuiltinTypes.STRING,
      },
      submit: {
        refType: FormSubmitType,
      },
      templateFormUuid: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const FormLayoutItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'layoutForm'),
    fields: {
      versoin: {
        refType: BuiltinTypes.NUMBER,
      },
      type: {
        refType: BuiltinTypes.STRING,
      },
      content: {
        refType: new ListType(BuiltinTypes.UNKNOWN),
      },
    },
  })
  const questionType = new ObjectType({
    elemID: new ElemID(JIRA, 'Question'),
    fields: {
      type: {
        refType: BuiltinTypes.STRING,
      },
      label: {
        refType: BuiltinTypes.STRING,
      },
      description: {
        refType: BuiltinTypes.STRING,
      },
      questionKey: {
        refType: BuiltinTypes.STRING,
      },
      jiraField: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const FormDesignType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormDesign'),
    fields: {
      settings: {
        refType: FormSettingsType,
      },
      layout: {
        refType: new ListType(FormLayoutItemType),
      },
      conditions: {
        refType: BuiltinTypes.UNKNOWN,
      },
      sections: {
        refType: BuiltinTypes.UNKNOWN,
      },
      questions: {
        refType: new ListType(questionType),
      },
    },
  })

  const formType = new ObjectType({
    elemID: new ElemID(JIRA, FORM_TYPE),
    fields: {
      id: {
        refType: BuiltinTypes.NUMBER,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      uuid: {
        refType: BuiltinTypes.SERVICE_ID,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      updated: {
        refType: BuiltinTypes.STRING,
      },
      design: {
        refType: FormDesignType,
      },
    },
    path: [JIRA, adapterElements.TYPES_PATH, FORM_TYPE],
  })
  return {
    formType,
    subTypes: [FormSubmitType, FormSettingsType, FormLayoutItemType, FormDesignType, questionType],
  }
}
