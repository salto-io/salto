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

import { ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, ListType } from '@salto-io/adapter-api'
import Joi from 'joi'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { JIRA, FORM_TYPE } from '../../constants'

type DetailedFormDataResponse = {
  uuid: string
  design: {
    settings: {
      templateId: string
      name: string
      submit: {
        lock: boolean
        pdf: boolean
      }
      templateFormUuid: string
    }
    questions: {}
    sections: {}
    conditions: {}
  }
}

type FormResponse = {
  id: number
  name?: string
}

type FormsResponse = {
  data: FormResponse[]
}

export const FORMS_RESPONSE_SCHEME = Joi.object({
  data: Joi.array().items(
    Joi.object({
      id: Joi.number().required(),
      name: Joi.string().allow(''),
    })
      .unknown(true)
      .required(),
  ),
})
  .unknown(true)
  .required()

export const DETAILED_FORM_RESPONSE_SCHEME = Joi.object({
  uuid: Joi.string().required(),
  design: Joi.object({
    settings: Joi.object({
      templateId: Joi.number().required(),
      name: Joi.string().required(),
      submit: Joi.object({
        lock: Joi.boolean().required(),
        pdf: Joi.boolean().required(),
      })
        .unknown(true)
        .required(),
      templateFormUuid: Joi.string(),
    })
      .unknown(true)
      .required(),
    questions: Joi.object().unknown(true).required(),
    sections: Joi.object().unknown(true).required(),
    conditions: Joi.object().unknown(true).required(),
  })
    .unknown(true)
    .required(),
})
  .unknown(true)
  .required()

export const createFormType = (): {
  formType: ObjectType
  subTypes: ObjectType[]
} => {
  const formSubmitType = new ObjectType({
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

  const formSettingsType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormSettings'),
    fields: {
      templateId: {
        refType: BuiltinTypes.NUMBER,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      name: {
        refType: BuiltinTypes.STRING,
      },
      submit: {
        refType: formSubmitType,
      },
      templateFormUuid: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
    },
  })
  const attributeContentLayoutType = new ObjectType({
    elemID: new ElemID(JIRA, 'AttributeContentLayoutType'),
    fields: {
      localId: {
        refType: BuiltinTypes.STRING,
      },
    },
  })
  const contentLayoutType = new ObjectType({
    elemID: new ElemID(JIRA, 'ContentLayout'),
    fields: {
      type: {
        refType: BuiltinTypes.STRING,
      },
      localId: {
        refType: new ListType(BuiltinTypes.STRING),
      },
      attrs: {
        refType: attributeContentLayoutType,
      },
    },
  })
  const formLayoutItemType = new ObjectType({
    elemID: new ElemID(JIRA, 'LayoutForm'),
    fields: {
      version: {
        refType: BuiltinTypes.NUMBER,
      },
      type: {
        refType: BuiltinTypes.STRING,
      },
      content: {
        refType: new ListType(contentLayoutType),
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
  const formDesignType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormDesign'),
    fields: {
      settings: {
        refType: formSettingsType,
      },
      layout: {
        refType: new ListType(formLayoutItemType),
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
  const formPortalType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormPortal'),
    fields: {
      portalRequestTypeIds: {
        refType: new ListType(BuiltinTypes.NUMBER),
      },
    },
  })

  const formPublishType = new ObjectType({
    elemID: new ElemID(JIRA, 'FormPublish'),
    fields: {
      portal: {
        refType: formPortalType,
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
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      design: {
        refType: formDesignType,
      },
      publish: {
        refType: formPublishType,
      },
    },
    path: [JIRA, adapterElements.TYPES_PATH, FORM_TYPE],
  })
  return {
    formType,
    subTypes: [
      formSubmitType,
      formSettingsType,
      formLayoutItemType,
      formDesignType,
      questionType,
      contentLayoutType,
      formPortalType,
      formPublishType,
    ],
  }
}

export const isFormsResponse = createSchemeGuard<FormsResponse>(
  FORMS_RESPONSE_SCHEME,
  'bad forms response from jira server',
)
export const isDetailedFormsResponse = createSchemeGuard<DetailedFormDataResponse>(
  DETAILED_FORM_RESPONSE_SCHEME,
  'bad detailed form response from jira server',
)

type createFormResponse = {
  id: number
}

const CREATE_FORM_RESPONSE_SCHEME = Joi.object({
  id: Joi.number().required(),
})
  .unknown(true)
  .required()

export const isCreateFormResponse = createSchemeGuard<createFormResponse>(
  CREATE_FORM_RESPONSE_SCHEME,
  'bad form creation response from jira server',
)
