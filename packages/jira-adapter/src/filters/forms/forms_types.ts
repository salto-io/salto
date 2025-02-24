/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ObjectType, ElemID, BuiltinTypes, CORE_ANNOTATIONS, ListType, MapType } from '@salto-io/adapter-api'
import Joi from 'joi'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { JIRA, FORM_TYPE } from '../../constants'

type DetailedFormDataResponse = {
  id: string
  design: {
    settings: {
      name: string
      submit: {
        lock: boolean
        pdf: boolean
      }
    }
    questions: {}
    sections: {}
    conditions: {}
  }
}

type FormResponse = {
  id: string
  name?: string
}

type FormsResponse = {
  data: FormResponse[]
}

const FORMS_RESPONSE_SCHEME = Joi.object({
  data: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      name: Joi.string().allow(''),
    })
      .unknown(true)
      .required(),
  ),
})
  .unknown(true)
  .required()

const DETAILED_FORM_RESPONSE_SCHEME = Joi.object({
  id: Joi.string().required(),
  design: Joi.object({
    settings: Joi.object({
      name: Joi.string().required(),
      submit: Joi.object({
        lock: Joi.boolean().required(),
        pdf: Joi.boolean().required(),
      })
        .unknown(true)
        .required(),
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
      name: {
        refType: BuiltinTypes.STRING,
      },
      submit: {
        refType: formSubmitType,
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
  const defaultAnswerType = new ObjectType({
    elemID: new ElemID(JIRA, 'DefaultAnswer'),
    fields: {
      key: {
        refType: BuiltinTypes.STRING,
      },
      value: {
        refType: new ListType(BuiltinTypes.STRING),
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
      defaultAnswer: {
        refType: new ListType(defaultAnswerType),
      },
    },
  })

  const cIdsType = new ObjectType({
    elemID: new ElemID(JIRA, 'CIds'),
    fields: {
      key: {
        refType: BuiltinTypes.STRING,
      },
      value: {
        refType: new ListType(BuiltinTypes.STRING),
      },
    },
  })

  const coType = new ObjectType({
    elemID: new ElemID(JIRA, 'Co'),
    fields: {
      cIds: {
        refType: new ListType(cIdsType),
      },
    },
  })

  const conditionType = new ObjectType({
    elemID: new ElemID(JIRA, 'Condition'),
    fields: {
      i: {
        refType: new MapType(coType),
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
        refType: new MapType(conditionType),
      },
      sections: {
        refType: BuiltinTypes.UNKNOWN,
      },
      questions: {
        refType: new MapType(questionType),
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
      conditionType,
      coType,
      cIdsType,
      defaultAnswerType,
    ],
  }
}

export const isFormsResponse = createSchemeGuard<FormsResponse>(FORMS_RESPONSE_SCHEME)
export const isDetailedFormsResponse = createSchemeGuard<DetailedFormDataResponse>(DETAILED_FORM_RESPONSE_SCHEME)

type createFormResponse = {
  id: number
}

const CREATE_FORM_RESPONSE_SCHEME = Joi.object({
  id: Joi.string().required(),
})
  .unknown(true)
  .required()

export const isCreateFormResponse = createSchemeGuard<createFormResponse>(
  CREATE_FORM_RESPONSE_SCHEME,
  'bad form creation response from jira server',
)
