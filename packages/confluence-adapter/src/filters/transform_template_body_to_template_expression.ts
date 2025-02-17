/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  InstanceElement,
  ReferenceExpression,
  TemplateExpression,
  TemplatePart,
  UnresolvedReference,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import {
  applyFunctionToChangeData,
  extractTemplate,
  replaceTemplatesWithValues,
  resolveTemplates,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { Options } from '../definitions/types'
import { UserConfig } from '../config'
import { PAGE_TYPE_NAME, SPACE_TYPE_NAME, TEMPLATE_TYPE_NAMES } from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable

type PossibleRefsInTemplateIndices = {
  spaceByKey: Record<string, InstanceElement>
  pageBySpaceFullNameAndTitle: Record<string, Record<string, InstanceElement>>
}

// If you change one regex of a pair (TYPE_REF_REGEX, SPLIT_TYPE_REF_REGEX), you should change the other one as well
const PAGE_REF_REGEX = /(<ri:page\s+ri:space-key="[^"]*"\s+ri:content-title="[^"]*"\s+ri:version-at-save="\d+"\s*\/>)/
const SPLIT_PAGE_REF_REGEX =
  /(<ri:page\s+ri:space-key=")([^"]*)("\s+ri:content-title=")([^"]*)("\s+ri:version-at-save="\d+"\s*\/>)/

const SPACE_REF_REGEX = /(<ri:space\sri:space-key="[^"]*"\s*\/>)/
const SPLIT_SPACE_REF_REGEX = /(<ri:space\sri:space-key=")([^"]*)("\s*\/>)/

const handlePageRefMatch = (
  matches: RegExpMatchArray,
  indices: PossibleRefsInTemplateIndices,
  fallback: string,
): TemplatePart | TemplatePart[] => {
  const { spaceByKey, pageBySpaceFullNameAndTitle } = indices
  // dropping first item as it is the whole line
  const [, spaceKey, spaceKeyValue, contentTitle, contentTitleValue, versionAtSave] = matches
  const space = spaceByKey[spaceKeyValue]
  if (space === undefined) {
    log.warn('Could not find space with key %s', spaceKeyValue)
    return fallback
  }
  const spaceReference = new ReferenceExpression(space.elemID, space)
  const page = pageBySpaceFullNameAndTitle[space.elemID.getFullName()]?.[contentTitleValue]
  if (page === undefined) {
    log.warn(
      'Could not find page with title %s in spaceKey %s, creating reference for space only',
      contentTitleValue,
      spaceKeyValue,
    )
    return [spaceKey, spaceReference, contentTitle, contentTitleValue, versionAtSave]
  }
  const pageReference = new ReferenceExpression(page.elemID, page)
  return [spaceKey, spaceReference, contentTitle, pageReference, versionAtSave]
}

const handleSpaceRefMatch = (
  matches: RegExpMatchArray,
  spaceByKey: PossibleRefsInTemplateIndices['spaceByKey'],
  fallback: string,
): TemplatePart | TemplatePart[] => {
  // dropping first item as it is the whole line
  const [, spaceKey, spaceKeyValue, rest] = matches
  const space = spaceByKey[spaceKeyValue]
  if (space === undefined) {
    log.warn('Could not find space with key %s', spaceKeyValue)
    return fallback
  }
  const spaceReference = new ReferenceExpression(space.elemID, space)
  return [spaceKey, spaceReference, rest]
}

const extractionFunc = (expression: string, indices: PossibleRefsInTemplateIndices): TemplatePart | TemplatePart[] => {
  const pageMatches = expression.match(SPLIT_PAGE_REF_REGEX)
  if (pageMatches !== null) {
    return handlePageRefMatch(pageMatches, indices, expression)
  }
  const spaceMatches = expression.match(SPLIT_SPACE_REF_REGEX)
  if (spaceMatches !== null) {
    return handleSpaceRefMatch(spaceMatches, indices.spaceByKey, expression)
  }
  return expression
}

const prepRef = (ref: ReferenceExpression): TemplatePart => {
  if (ref.value instanceof UnresolvedReference) {
    log.debug(
      'prepRef received a part as unresolved reference, returning an empty string, instance fullName: %s unresolved reference fullName: %s',
      ref.elemID.getFullName(),
      ref.value.target.getFullName(),
    )
    return ''
  }
  if (ref.value.elemID.typeName === SPACE_TYPE_NAME && _.isString(ref.value.value?.key)) {
    return ref.value.value.key
  }
  if (ref.value.elemID.typeName === PAGE_TYPE_NAME && _.isString(ref.value.value?.title)) {
    return ref.value.value.title
  }
  log.warn('prepRef received a part that is not a space or page reference %o', ref)
  // fallback to the original reference
  return ref
}

const filter: filterUtils.AdapterFilterCreator<UserConfig, filterUtils.FilterResult, {}, Options> = () => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'templateBodyToTemplateExpressionFilter',
    onFetch: async elements => {
      const instances = elements.filter(isInstanceElement)
      const indices: PossibleRefsInTemplateIndices = {
        spaceByKey: {},
        pageBySpaceFullNameAndTitle: {},
      }
      instances.forEach(inst => {
        if (inst.elemID.typeName === SPACE_TYPE_NAME) {
          indices.spaceByKey[inst.value.key] = inst
        }
        if (inst.elemID.typeName === PAGE_TYPE_NAME) {
          const spaceRef = inst.value.spaceId
          if (!isReferenceExpression(spaceRef)) {
            return
          }
          const spaceFullName = spaceRef.elemID.getFullName()
          indices.pageBySpaceFullNameAndTitle[spaceFullName] = _.merge(
            indices.pageBySpaceFullNameAndTitle[spaceFullName],
            { [inst.value.title]: inst },
          )
        }
      })

      const templateInstances = instances.filter(inst => TEMPLATE_TYPE_NAMES.includes(inst.elemID.typeName))
      templateInstances.forEach(templateInst => {
        const bodyValue = _.get(templateInst.value, 'body.storage.value')
        if (!_.isString(bodyValue)) {
          log.warn('Body value is not a string for template instance %s', templateInst.elemID.getFullName())
          return
        }
        const templateExpression = extractTemplate(bodyValue, [PAGE_REF_REGEX, SPACE_REF_REGEX], expression =>
          extractionFunc(expression, indices),
        )
        templateInst.value.body.storage.value = templateExpression
      })
    },
    preDeploy: async changes => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => TEMPLATE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            replaceTemplatesWithValues(
              { values: [instance.value.body?.storage], fieldName: 'value' },
              deployTemplateMapping,
              prepRef,
            )
            return instance
          })
        })
    },
    // TODO, this part is just reverting the preDeploy step, we should do it in adjust function upon deploy
    // (when manipulating values with adjust function preDeploy, we do not need to revert it in onDeploy)
    onDeploy: async changes => {
      await awu(changes)
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => TEMPLATE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))
        .forEach(async change => {
          await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
            resolveTemplates({ values: [instance.value.body?.storage], fieldName: 'value' }, deployTemplateMapping)
            return instance
          })
        })
    },
  }
}

export default filter
