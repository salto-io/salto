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
import _ from 'lodash'
import Joi from 'joi'
import FormData from 'form-data'
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  createSaltoElementError,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isRemovalChange,
  isSaltoError,
  isStaticFile,
  ObjectType,
  ReferenceExpression,
  SaltoElementError,
  StaticFile,
  toChange,
} from '@salto-io/adapter-api'
import {
  normalizeFilePathPart,
  naclCase,
  safeJsonStringify,
  pathNaclCase,
  references,
  inspectValue,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { elements as elementsUtils, fetch as fetchUtils, resolveChangeElement } from '@salto-io/adapter-components'
import { values, collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { ZENDESK, MACRO_TYPE_NAME } from '../constants'
import { addId, deployChange, deployChanges } from '../deployment'
import { getZendeskError } from '../errors'
import { lookupFunc } from './field_references'
import ZendeskClient from '../client/client'

const { isDefined } = values
const log = logger(module)
const { awu } = collections.asynciterable
const { isArrayOfRefExprToInstances } = references

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

const EXPECTED_ATTACHMENT_SCHEMA = Joi.array()
  .items(
    Joi.object({
      id: Joi.number().required(),
      filename: Joi.string().required(),
      content_type: Joi.string().required(),
      content_url: Joi.string().required(),
    }).unknown(true),
  )
  .required()

const isAttachments = (value: unknown): value is Attachment[] => {
  const { error } = EXPECTED_ATTACHMENT_SCHEMA.validate(value)
  if (error !== undefined) {
    log.error(`Received an invalid response for the attachments values: ${error.message}, ${inspectValue(value)}`)
    return false
  }
  return true
}

const replaceAttachmentId = (
  macroChange: Change<InstanceElement>,
  fullNameToInstance: Record<string, InstanceElement>,
): Change<InstanceElement> => {
  const macroInstance = getChangeData(macroChange)
  const attachments = macroInstance.value[ATTACHMENTS_FIELD_NAME]
  if (attachments === undefined) {
    return macroChange
  }
  if (!isArrayOfRefExprToInstances(attachments)) {
    log.error(`Failed to deploy macro because its attachment field has an invalid format: ${inspectValue(attachments)}`)
    throw createSaltoElementError({
      // caught in try block
      message: 'Macro attachment field has an invalid format',
      severity: 'Error',
      elemID: macroInstance.elemID,
    })
  }
  macroInstance.value[ATTACHMENTS_FIELD_NAME] = attachments.map(ref => {
    const instance = fullNameToInstance[ref.elemID.getFullName()]
    return instance ? new ReferenceExpression(instance.elemID, instance) : ref
  })
  return macroChange
}

const addAttachment = async (client: ZendeskClient, instance: InstanceElement): ReturnType<typeof client.post> => {
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
    throw getZendeskError(instance.elemID, err) // caught in deployChanges
  }
}

const createAttachmentInstance = ({
  attachment,
  attachmentType,
  content,
  macro,
}: {
  attachment: Attachment
  attachmentType: ObjectType
  content?: Buffer
  macro: InstanceElement
}): InstanceElement => {
  const name = fetchUtils.element.toNestedTypeName(macro.value.title, attachment.filename)
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
      content: content
        ? new StaticFile({ filepath: `${ZENDESK}/${attachmentType.elemID.name}/${resourcePathName}`, content })
        : undefined,
      macros: [new ReferenceExpression(macro.elemID, macro)],
    },
    [ZENDESK, RECORDS_PATH, MACRO_ATTACHMENT_TYPE_NAME, pathName],
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

const getAttachmentError = (attachment: Attachment, attachmentInstance: InstanceElement): SaltoElementError => ({
  message: `could not add content to attachment ${attachment.filename} with id ${attachment.id}`,
  severity: 'Warning',
  elemID: attachmentInstance.elemID,
})

const getAttachmentContent = async ({
  client,
  attachment,
  macro,
  attachmentType,
}: {
  client: ZendeskClient
  attachment: Attachment
  macro: InstanceElement
  attachmentType: ObjectType
}): Promise<(InstanceElement | undefined | SaltoElementError)[]> => {
  try {
    const res = await client.get({
      url: `/api/v2/macros/attachments/${attachment.id}/content`,
      responseType: 'arraybuffer',
    })
    const content = _.isString(res.data) ? Buffer.from(res.data) : res.data
    if (!Buffer.isBuffer(content)) {
      log.error(
        `Received invalid response from Zendesk API for attachment content, ${safeJsonStringify(res.data, undefined, 2)}. Not adding macro attachments`,
      )
      const attachmentInstance = createAttachmentInstance({ attachment, attachmentType, macro })
      return [getAttachmentError(attachment, attachmentInstance), attachmentInstance]
    }
    return [createAttachmentInstance({ attachment, attachmentType, macro, content })]
  } catch (e) {
    log.error(
      `could not add content to attachment ${attachment.filename} with id ${attachment.id} received error: ${e}`,
    )
    const attachmentInstance = createAttachmentInstance({ attachment, attachmentType, macro })
    return [getAttachmentError(attachment, attachmentInstance), attachmentInstance]
  }
}

const getAttachmentsForMacro = async ({
  macro,
  attachments,
  client,
  attachmentType,
  allAttachments,
}: {
  client: ZendeskClient
  macro: InstanceElement
  attachments: Attachment[]
  attachmentType: ObjectType
  allAttachments: (InstanceElement | SaltoElementError)[]
}): Promise<(InstanceElement | SaltoElementError)[]> =>
  (
    await Promise.all(
      attachments.map(async attachment => {
        const existingAttachment = allAttachments.find(a => isInstanceElement(a) && a.value.id === attachment.id)
        if (existingAttachment !== undefined) {
          // The same attachment can be used by multiple macros
          // Instead of creating new instances, we add references to the macros field
          const instance = existingAttachment as InstanceElement
          instance.value.macros = instance.value.macros.concat([new ReferenceExpression(macro.elemID, macro)])
          return []
        }
        return getAttachmentContent({ client, attachment, macro, attachmentType })
      }),
    )
  )
    .flat()
    .filter(values.isDefined)

const getMacroAttachments = async ({
  macros,
  client,
  attachmentType,
}: {
  macros: InstanceElement[]
  client: ZendeskClient
  attachmentType: ObjectType
}): Promise<(InstanceElement | SaltoElementError)[]> => {
  let allAttachments: (InstanceElement | SaltoElementError)[] = []
  // We need to create the attachments sequentially so that we can check if
  // different macros use the same attachments
  for await (const macro of macros) {
    // We are ok with calling get here
    // because a macro can be associated with up to five attachments.
    const response = await client.get({
      url: `/api/v2/macros/${macro.value.id}/attachments`,
    })
    let currentAttachments: Attachment[]
    if (Array.isArray(response.data)) {
      log.error(
        `Received invalid response from Zendesk API, ${safeJsonStringify(response.data, undefined, 2)}. Not adding macro attachments`,
      )
      currentAttachments = []
    } else {
      currentAttachments = !isAttachments(response.data.macro_attachments) ? [] : response.data.macro_attachments
    }
    if (currentAttachments.length > 0) {
      const currentMacroAttachments = (
        await getAttachmentsForMacro({ macro, attachments: currentAttachments, client, attachmentType, allAttachments })
      ).flat()
      allAttachments = allAttachments.concat(currentMacroAttachments)
    }
  }
  return allAttachments
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
    const macroAttachmentsAndErrors = await getMacroAttachments({
      macros: macrosWithAttachments,
      client,
      attachmentType,
    })
    const [macroAttachments, errors] = _.partition(macroAttachmentsAndErrors, isInstanceElement)
    _.remove(elements, element => element.elemID.isEqual(attachmentType.elemID))
    elements.push(attachmentType, ...macroAttachments)
    return {
      errors,
    }
  },
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [relevantChanges, leftoverChanges] = _.partition(changes, change =>
      [MACRO_ATTACHMENT_TYPE_NAME, MACRO_TYPE_NAME].includes(getChangeData(change).elemID.typeName),
    )
    if (relevantChanges.length === 0) {
      return {
        leftoverChanges: changes,
        deployResult: {
          errors: [],
          appliedChanges: [],
        },
      }
    }
    const [childrenChanges, macroChanges] = _.partition(
      relevantChanges,
      change => getChangeData(change).elemID.typeName === MACRO_ATTACHMENT_TYPE_NAME,
    )
    let additionalMacroChanges: Change<InstanceElement>[] | undefined = []
    if (macroChanges.length === 0 && childrenChanges.length > 0) {
      additionalMacroChanges = childrenChanges
        .flatMap(childChange => {
          const { macros } = getChangeData(childChange).value
          if (!isArrayOfRefExprToInstances(macros)) {
            return undefined
          }
          return macros.map(macro =>
            toChange({
              before: macro.value.clone(),
              after: macro.value.clone(),
            }),
          )
        })
        .filter(isDefined)
    }

    if (additionalMacroChanges === undefined) {
      return {
        deployResult: {
          appliedChanges: [],
          errors: childrenChanges.map(getChangeData).map(e =>
            createSaltoElementError({
              message: 'Attachment is not linked to a valid macro',
              severity: 'Error',
              elemID: e.elemID,
            }),
          ),
        },
        leftoverChanges,
      }
    }
    const childFullNameToInstance: Record<string, InstanceElement> = {}
    const resolvedChildrenChanges = await awu(childrenChanges)
      .map(change => resolveChangeElement(change, lookupFunc))
      .toArray()
    const attachmentDeployResult = await deployChanges(resolvedChildrenChanges, async change => {
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
    })
    if (!_.isEmpty(attachmentDeployResult.errors)) {
      log.error('Failed to deploy the macro attachments. Therefore, the macro deployment failed as well')
      return {
        deployResult: {
          appliedChanges: [],
          errors: [
            ...macroChanges.map(getChangeData).map(e =>
              createSaltoElementError({
                message: `Failed to update ${e.elemID.getFullName()} since the deployment of its attachments failed`,
                severity: 'Error',
                elemID: e.elemID,
              }),
            ),
            ...attachmentDeployResult.errors,
          ],
        },
        leftoverChanges,
      }
    }
    try {
      const additionalMacrosFullNames = new Set(
        additionalMacroChanges.map(getChangeData).map(inst => inst.elemID.getFullName()),
      )
      const resolvedMacroChanges = await awu([...macroChanges, ...additionalMacroChanges])
        .map(change => replaceAttachmentId(change, childFullNameToInstance))
        .map(change => resolveChangeElement(change, lookupFunc))
        .toArray()
      const macroDeployResult = await deployChanges(resolvedMacroChanges, async change => {
        await deployChange(change, client, config.apiDefinitions)
      })
      return {
        deployResult: {
          appliedChanges: [
            ...macroDeployResult.appliedChanges.filter(
              change => !additionalMacrosFullNames.has(getChangeData(change).elemID.getFullName()),
            ),
            ...attachmentDeployResult.appliedChanges,
          ],
          errors: [...macroDeployResult.errors, ...attachmentDeployResult.errors],
        },
        leftoverChanges,
      }
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      return {
        // this is not the correct applied changes, need to be fixed in https://salto-io.atlassian.net/browse/SALTO-4466
        deployResult: {
          appliedChanges: [],
          errors: [e],
        },
        leftoverChanges: changes,
      }
    }
  },
})

export default filterCreator
