/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, getChangeData, isReferenceExpression } from '@salto-io/adapter-api'
import { getParents } from '@salto-io/adapter-utils'
import { DefaultWithCustomizations, queryWithDefault } from '../../definitions/system'
import { InstanceDeployApiDefinitions } from '../../definitions/system/deploy'

export type ChangeIdFunction = (change: Change) => Promise<string | undefined>

export const selfGroup: ChangeIdFunction = async change => getChangeData(change).elemID.getFullName()

export const groupByType: ChangeIdFunction = async change => getChangeData(change).elemID.typeName

export const groupWithFirstParent: ChangeIdFunction = async change => {
  const parent = getParents(getChangeData(change))?.[0]
  if (isReferenceExpression(parent)) {
    return parent.elemID.getFullName()
  }
  return undefined
}

export const getChangeGroupIdFromDefinition =
  <AdditionalAction extends string, ClientOptions extends string>(
    groupingDef: DefaultWithCustomizations<InstanceDeployApiDefinitions<AdditionalAction, ClientOptions>>,
  ): ChangeIdFunction =>
  async change =>
    queryWithDefault(groupingDef).query(getChangeData(change).elemID.typeName)?.changeGroupId?.(change)
