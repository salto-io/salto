/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ChangeDataType } from './change'
import { ChangeId } from './dependency_changer'

export type ChangeGroupId = string

export type ChangeGroup<ChangeType = Change<ChangeDataType>> = {
  groupID: ChangeGroupId
  changes: ReadonlyArray<ChangeType>
}

export type ChangeGroupIdFunctionReturn = {
  changeGroupIdMap: Map<ChangeId, ChangeGroupId>
  disjointGroups?: Set<ChangeGroupId>
}

export type ChangeGroupIdFunction = (changes: Map<ChangeId, Change>) => Promise<ChangeGroupIdFunctionReturn>
