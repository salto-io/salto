/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { FixElementsFunc } from '@salto-io/adapter-api'
import { customReferenceHandlers } from '../custom_references'
import { fallbackUsersHandler } from './fallback_user'
import { FixElementsArgs } from './types'
import { removeDupUsersHandler } from './remove_dup_users'
import { mergeListsHandler } from './merge_lists'
import { deployArticlesAsDraftHandler } from './deploy_articles_as_drafts'
import { fixTicketFormsHandler } from './fix_ticket_forms'

export const createFixElementFunctions = (args: FixElementsArgs): Record<string, FixElementsFunc> => ({
  ..._.mapValues(customReferenceHandlers, handler => handler.removeWeakReferences(args)),
  fallbackUsers: fallbackUsersHandler(args),
  mergeLists: mergeListsHandler(args),
  // removingDupes needs to be after fallbackUsers
  removeDupUsers: removeDupUsersHandler(args),
  deployArticlesAsDraft: deployArticlesAsDraftHandler(args),
  fixTicketForms: fixTicketFormsHandler(args),
})
