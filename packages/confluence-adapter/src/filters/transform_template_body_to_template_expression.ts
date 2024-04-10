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
  Change,
  InstanceElement,
  ReferenceExpression,
  TemplateExpression,
  UnresolvedReference,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isTemplateExpression,
} from '@salto-io/adapter-api'
import { AdapterFilterCreator, FilterResult } from '@salto-io/adapter-components/src/filter_utils'
import {
  applyFunctionToChangeData,
  extractTemplate,
  replaceTemplatesWithValues,
  resolveTemplates,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { awu } from '@salto-io/lowerdash/src/collections/asynciterable'
import { Options } from '../definitions/types'
import { UserConfig } from '../config'

const log = logger(module)

const TEMPLATE_TYPE_NAMES = ['template', 'global_template']
const PAGE_REF_REGEX = /<ri:page ri:space-key=".*?" ri:content-title=".*?" ri:version-at-save=".*?" >/

const filter: AdapterFilterCreator<UserConfig, FilterResult, {}, Options> = () => {
  let deployTemplateMapping: Record<string, TemplateExpression>
  const fetchTemplateMapping = new Map<ReferenceExpression, string>()
  return {
    name: 'templateBodyToTemplateExpressionFilter',
    onFetch: async elements => {
      const instances = elements.filter(isInstanceElement)
      const templateInstances = instances.filter(inst => TEMPLATE_TYPE_NAMES.includes(inst.elemID.typeName))
      templateInstances.forEach(templateInst => {
        const bodyValue = _.get(templateInst.value, 'body.storage.value')
        if (!_.isString(bodyValue)) {
          return
        }
        const templateExpression = extractTemplate(bodyValue, [PAGE_REF_REGEX], expression => {
          const splitRegex = /(<ri:page ri:space-key=")(.*?)(" ri:content-title=")(.*?)(" ri:version-at-save=".*?" \/>)/
          const matches = expression.match(splitRegex)
          if (matches !== null) {
            const [, spaceKey, spaceKeyValue, contentTitle, contentTitleValue, versionAtSave] = matches
            const space = instances.find(inst => inst.elemID.typeName === 'space' && inst.value.key === spaceKeyValue)
            if (space === undefined) {
              return expression
            }
            const spaceReference = new ReferenceExpression(space.elemID, space)
            fetchTemplateMapping.set(spaceReference, spaceKeyValue)
            const page = instances.find(
              inst =>
                inst.elemID.typeName === 'page' &&
                inst.value.title === contentTitleValue &&
                isReferenceExpression(inst.value.spaceId) &&
                inst.value.spaceId.elemID.isEqual(spaceReference.elemID),
            )
            if (page === undefined) {
              // TODO_F add log
              return [spaceKey, spaceReference, contentTitle, contentTitle, versionAtSave]
            }
            const pageReference = new ReferenceExpression(page.elemID, page)
            fetchTemplateMapping.set(pageReference, contentTitle)
            return [spaceKey, spaceReference, contentTitle, pageReference, versionAtSave]
          }
          return expression
        })
        templateInst.value.body.storage.value = templateExpression
      })
    },
    preDeploy: async changes => {
      const templateChanges = changes
        .filter(isInstanceChange)
        .filter(isAdditionOrModificationChange)
        .filter(change => TEMPLATE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))

      templateChanges.forEach(async ({ data }) => {
        const { after } = data
        const bodyStorage = _.get(after.value, 'body.storage')
        if (!_.isPlainObject(bodyStorage) || !isTemplateExpression(bodyStorage.value)) {
          return
        }
        const container = { values: [bodyStorage], fieldName: 'value' }
        replaceTemplatesWithValues(container, deployTemplateMapping, ref => {
          if (ref.value instanceof UnresolvedReference) {
            log.trace(
              'prepRef received a part as unresolved reference, returning an empty string, instance fullName: %s ',
              ref.elemID.getFullName(),
            )
            return ''
          }
          const stringValueSavedOnFetch = fetchTemplateMapping.get(ref)
          if (stringValueSavedOnFetch) {
            return stringValueSavedOnFetch
          }
          // cases where reference hasn't created upon fetch
          if (ref.value.elemID.typeName === 'space' && _.isString(ref.value?.key)) {
            return ref.value.key
          }
          if (ref.value.elemID.typeName === 'page' && _.isString(ref.value?.title)) {
            return ref.value.title
          }
          // TODO_F add log
          // fallback to the original reference
          return ref
        })
      })
    },
    onDeploy: async changes => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => TEMPLATE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            resolveTemplates({ values: [instance.value], fieldName: 'body.storage.value' }, deployTemplateMapping)
            return instance
          })
        })
    },
  }
}

export default filter
