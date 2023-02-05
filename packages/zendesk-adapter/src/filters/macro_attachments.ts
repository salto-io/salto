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
import _ from 'lodash'
import Joi from 'joi'
import FormData from 'form-data'
import {
  BuiltinTypes, Change, CORE_ANNOTATIONS, ElemID, getChangeData, InstanceElement,
  isInstanceElement, isRemovalChange, isStaticFile, ObjectType, ReferenceExpression, StaticFile,
} from '@salto-io/adapter-api'
import { normalizeFilePathPart, naclCase, elementExpressionStringifyReplacer,
  resolveChangeElement, safeJsonStringify, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { values, collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { ZENDESK, MACRO_TYPE_NAME } from '../constants'
import { addId, deployChange, deployChanges } from '../deployment'
import { getZendeskError } from '../errors'
import { lookupFunc } from './field_references'
import ZendeskClient from '../client/client'
import { createAdditionalParentChanges, isArrayOfRefExprToInstances } from './utils'

const log = logger(module)
const { awu } = collections.asynciterable

const { RECORDS_PATH, SUBTYPES_PATH, TYPES_PATH } = elementsUtils

export const MACRO_ATTACHMENT_TYPE_NAME = 'macro_attachment'
export const ATTACHMENTS_FIELD_NAME = 'attachments'
const MACRO_ATTACHMENT_DATA_FIELD = 'macro_attachment'

type Attachment = {
  id: number
  filename: string
  // eslint-disable-next-line camelcase
  content_type: string
  // eslint-disable-next-line camelcase
  content_url: string
}

const EXPECTED_ATTACHMENT_SCHEMA = Joi.array().items(Joi.object({
  id: Joi.number().required(),
  filename: Joi.string().required(),
  content_type: Joi.string().required(),
  content_url: Joi.string().required(),
}).unknown(true)).required()

const isAttachments = (value: unknown): value is Attachment[] => {
  const { error } = EXPECTED_ATTACHMENT_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${safeJsonStringify(value, elementExpressionStringifyReplacer)}`)
    return false
  }
  return true
}

const replaceAttachmentId = (
  parentChange: Change<InstanceElement>, fullNameToInstance: Record<string, InstanceElement>,
): Change<InstanceElement> => {
  const parentInstance = getChangeData(parentChange)
  const attachments = parentInstance.value[ATTACHMENTS_FIELD_NAME]
  if (attachments === undefined) {
    return parentChange
  }
  if (!isArrayOfRefExprToInstances(attachments)) {
    log.error(`Failed to deploy macro because its attachment field has an invalid format: ${
      safeJsonStringify(attachments, elementExpressionStringifyReplacer)}`)
    throw new Error('Failed to deploy macro because its attachment field has an invalid format')
  }
  parentInstance.value[ATTACHMENTS_FIELD_NAME] = attachments
    .map(ref => {
      const instance = fullNameToInstance[ref.elemID.getFullName()]
      return instance ? new ReferenceExpression(instance.elemID, instance) : ref
    })
  return parentChange
}

const addAttachment = async (client: ZendeskClient, instance: InstanceElement):
ReturnType<typeof client.post> => {
  const form = new FormData()
  const fileContent = isStaticFile(instance.value.content)
    ? await instance.value.content.getContent()
    : instance.value.content
  form.append('attachment', fileContent, instance.value.filename)
  form.append('filename', instance.value.filename)
  try {
    return await client.post({
      url: '/api/v2/macros/attachments',
      data: form,
      headers: { ...form.getHeaders() },
    })
  } catch (err) {
    throw getZendeskError(instance.elemID, err)
  }
}

const createAttachmentInstance = ({
  attachment, attachmentType, content, macro,
}: {
  attachment: Attachment
  attachmentType: ObjectType
  content: Buffer
  macro: InstanceElement
}): InstanceElement => {
  const name = elementsUtils.ducktype.toNestedTypeName(
    macro.value.title, attachment.filename
  )
  const naclName = naclCase(name)
  const pathName = pathNaclCase(naclName)
  const resourcePathName = normalizeFilePathPart(name)
  return new InstanceElement(
    naclName,
    attachmentType,
    {
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.content_type,
      content: new StaticFile({
        filepath: `${ZENDESK}/${attachmentType.elemID.name}/${resourcePathName}`,
        content,
      }),
    },
    [ZENDESK, RECORDS_PATH, MACRO_ATTACHMENT_TYPE_NAME, pathName],
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(macro.elemID, macro)] },
  )
}

const createAttachmentType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(ZENDESK, MACRO_ATTACHMENT_TYPE_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
      },
      filename: { refType: BuiltinTypes.STRING },
      contentType: { refType: BuiltinTypes.STRING },
      content: { refType: BuiltinTypes.STRING },
    },
    path: [ZENDESK, TYPES_PATH, SUBTYPES_PATH, MACRO_ATTACHMENT_TYPE_NAME],
  })

const getAttachmentContent = async ({
  client, attachment, macro, attachmentType,
}: {
  client: ZendeskClient
  attachment: Attachment
  macro: InstanceElement
  attachmentType: ObjectType
}): Promise<InstanceElement | undefined> => {
  const res = await client.getSinglePage({
    url: `/api/v2/macros/attachments/${attachment.id}/content`,
    responseType: 'arraybuffer',
  })
  const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
  if (!Buffer.isBuffer(content)) {
    log.error(`Received invalid response from Zendesk API for attachment content, ${safeJsonStringify(res.data, undefined, 2)}. Not adding macro attachments`)
    return undefined
  }
  return createAttachmentInstance({ attachment, attachmentType, macro, content })
}

const getMacroAttachments = async ({
  client, macro, attachmentType,
}: {
  client: ZendeskClient
  macro: InstanceElement
  attachmentType: ObjectType
}): Promise<InstanceElement[]> => {
  // We are ok with calling getSinglePage here
  //  because a macro can be associated with up to five attachments.
  const response = await client.getSinglePage({
    url: `/api/v2/macros/${macro.value.id}/attachments`,
  })
  if (Array.isArray(response.data)) {
    log.error(`Received invalid response from Zendesk API, ${safeJsonStringify(response.data, undefined, 2)}. Not adding macro attachments`)
    return []
  }
  const attachments = response.data.macro_attachments
  if (!isAttachments(attachments)) {
    return []
  }
  return (await Promise.all(
    attachments.map(async attachment =>
      getAttachmentContent({ client, attachment, macro, attachmentType }))
  )).filter(values.isDefined)
}

/**
 * Adds the macro attachments instances
 */
const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'macroAttachmentsFilter',
  onFetch: async elements => {
    const macrosWithAttachments = elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === MACRO_TYPE_NAME)
      .filter(e => !_.isEmpty(e.value[ATTACHMENTS_FIELD_NAME]))
    const attachmentType = createAttachmentType()
    const macroAttachments = (await Promise.all(macrosWithAttachments
      .map(async macro => getMacroAttachments({ client, attachmentType, macro })))).flat()
    _.remove(elements, element => element.elemID.isEqual(attachmentType.elemID))
    elements.push(attachmentType, ...macroAttachments)
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => [MACRO_ATTACHMENT_TYPE_NAME, MACRO_TYPE_NAME]
        .includes(getChangeData(change).elemID.typeName),
    )
    const [childrenChanges, parentChanges] = _.partition(
      relevantChanges,
      change => getChangeData(change).elemID.typeName === MACRO_ATTACHMENT_TYPE_NAME
    )
    const additionalParentChanges = parentChanges.length === 0 && childrenChanges.length > 0
      ? await createAdditionalParentChanges(childrenChanges, false)
      : []
    if (additionalParentChanges === undefined) {
      return {
        deployResult: {
          appliedChanges: [],
          errors: childrenChanges
            .map(getChangeData)
            .map(e => new Error(
              `Failed to update ${e.elemID.getFullName()} since it has no valid parent`
            )),
        },
        leftoverChanges,
      }
    }
    const childFullNameToInstance: Record<string, InstanceElement> = {}
    const resolvedChildrenChanges = await awu(childrenChanges)
      .map(change => resolveChangeElement(change, lookupFunc))
      .toArray()
    const attachmentDeployResult = await deployChanges(
      resolvedChildrenChanges,
      async change => {
        if (isRemovalChange(change)) {
          return
        }
        const instance = getChangeData(change)
        const response = await addAttachment(client, instance)
        addId({
          change,
          apiDefinitions: config.apiDefinitions,
          response: response.data,
          dataField: MACRO_ATTACHMENT_DATA_FIELD,
          addAlsoOnModification: true,
        })
        childFullNameToInstance[instance.elemID.getFullName()] = instance
      }
    )
    if (!_.isEmpty(attachmentDeployResult.errors)) {
      log.error('Failed to deploy the macro attachments. Therefore, the macro deployment failed as well')
      return {
        deployResult: {
          appliedChanges: [],
          errors: [...parentChanges
            .map(getChangeData)
            .map(e => new Error(
              `Failed to update ${e.elemID.getFullName()} since the deployment of its attachments failed`
            )),
          ...attachmentDeployResult.errors],
        },
        leftoverChanges,
      }
    }
    const additionalParentFullNames = new Set(
      additionalParentChanges.map(getChangeData).map(inst => inst.elemID.getFullName())
    )
    const resolvedParentChanges = await awu([...parentChanges, ...additionalParentChanges])
      .map(change => replaceAttachmentId(change, childFullNameToInstance))
      .map(change => resolveChangeElement(change, lookupFunc))
      .toArray()
    const macroDeployResult = await deployChanges(
      resolvedParentChanges,
      async change => {
        await deployChange(change, client, config.apiDefinitions)
      }
    )
    return {
      deployResult: {
        appliedChanges: [
          ...macroDeployResult.appliedChanges
            .filter(change =>
              !additionalParentFullNames.has(getChangeData(change).elemID.getFullName())),
          ...attachmentDeployResult.appliedChanges,
        ],
        errors: [...macroDeployResult.errors, ...attachmentDeployResult.errors],
      },
      leftoverChanges,
    }
  },
})

export default filterCreator
