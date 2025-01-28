/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  dependencyChange,
  DependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
  isStaticFile,
} from '@salto-io/adapter-api'
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import { deployment } from '@salto-io/adapter-components'
import _ from 'lodash'
import { parserUtils } from '@salto-io/parser'
import { ARTICLE_ATTACHMENT_TYPE_NAME, ARTICLE_TRANSLATION_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues
const { awu } = collections.asynciterable

const getNameFromChange = (change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>): string =>
  getChangeData(change.change).elemID.getFullName()

const extractAttachmentReferencesFromBody = async (
  currentRecord: Record<string, string[]>,
  fullName: string,
  change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>,
): Promise<Record<string, string[]>> => {
  const data = getChangeData(change.change)
  const { body } = data.value
  if (isStaticFile(body) && body.isTemplate) {
    const template = await parserUtils.staticFileToTemplateExpression(body)
    const references = template?.parts
      .filter(isReferenceExpression)
      .filter(ref => ref.elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME)
      .map(ref => ref.elemID.getFullName())
    if (references === undefined || _.isEmpty(references)) {
      return currentRecord
    }
    return {
      ...currentRecord,
      [fullName]: references,
    }
  }
  return currentRecord
}

const getDependencies = async (
  changes: deployment.dependency.ChangeWithKey<Change<InstanceElement>>[],
): Promise<DependencyChange[]> => {
  const articleTranslationModificationChanges = changes.filter(
    change =>
      getChangeData(change.change).elemID.typeName === ARTICLE_TRANSLATION_TYPE_NAME &&
      isModificationChange(change.change),
  )

  const articleAttachmentModificationChanges = changes.filter(
    change =>
      getChangeData(change.change).elemID.typeName === ARTICLE_ATTACHMENT_TYPE_NAME &&
      isModificationChange(change.change),
  )

  const articleTranslationFullNameToChange = _.keyBy(articleTranslationModificationChanges, getNameFromChange)
  const articleAttachmentFullNameToChange = _.keyBy(articleAttachmentModificationChanges, getNameFromChange)

  const addDependencyForAttachmentChange = (
    attachment: string,
    change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>,
  ): DependencyChange | undefined => {
    const attachmentChange = articleAttachmentFullNameToChange[attachment]
    if (attachmentChange) {
      return dependencyChange('add', change.key, attachmentChange.key)
    }
    return undefined
  }

  const translationToAttachmentsList = await awu(Object.entries(articleTranslationFullNameToChange)).reduce<
    Record<string, string[]>
  >(
    async (currentRecord, [fullName, change]) => extractAttachmentReferencesFromBody(currentRecord, fullName, change),
    {},
  )
  return articleTranslationModificationChanges
    .flatMap(change => {
      const attachmentList = translationToAttachmentsList[getNameFromChange(change)]
      if (attachmentList === undefined) {
        return undefined
      }
      return attachmentList.map(attachment => addDependencyForAttachmentChange(attachment, change))
    })
    .filter(isDefined)
}

/**
 * This dependency changer is used to add dependency between article attachments and the translation that points them in the case
 * where the article translation changes are modifications and the article attachments are modifications. This is because
 * the modification of the translation doesn't work without the attachment changes happening first.
 * The dependency to addition attachments is happening in core.
 */
export const articleAttachmentAndTranslationDependencyChanger: DependencyChanger = async changes => {
  const potentialChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  return getDependencies(potentialChanges)
}
