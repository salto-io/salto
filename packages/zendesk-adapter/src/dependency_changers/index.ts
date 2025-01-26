/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { DependencyChanger } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { customFieldOptionDependencyChanger } from './custom_field_option_change'
import { orderDependencyChanger } from './order_change'
import { ticketFormDependencyChanger } from './ticket_form_change'
import { articleAttachmentDependencyChanger } from './article_attachment_change'
import { customObjectAndFieldDependencyChanger } from './custom_object_and_field_change'
import { modifiedAndDeletedDependencyChanger } from './modified_and_deleted'
import { articleAttachmentAndTranslationDependencyChanger } from './article_attachment_and_translation'

const { awu } = collections.asynciterable

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  deployment.dependency.removeStandaloneFieldDependency,
  customFieldOptionDependencyChanger,
  orderDependencyChanger,
  ticketFormDependencyChanger,
  articleAttachmentDependencyChanger,
  customObjectAndFieldDependencyChanger,
  modifiedAndDeletedDependencyChanger,
  articleAttachmentAndTranslationDependencyChanger,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
