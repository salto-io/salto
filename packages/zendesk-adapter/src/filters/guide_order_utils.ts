/*
*                      Copyright 2022 Salto Labs Ltd.
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

// Lowest position index first, if there is a tie - the newer is first
import {
  Change, DeployResult,
  InstanceElement,
  isAdditionChange, isReferenceExpression,
  isRemovalChange,
  ModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { deployChange, deployChanges } from '../deployment'
import ZendeskClient from '../client/client'
import { FilterContext } from '../config'

/* Split the changes into 3 groups:
  withOrderChanges    - Changes with order changes
  mixedOrderChanges   - Changes with order and non-order changes
  onlyNonOrderChanges - Changes without any order changes
 */
export const sortChanges = (changes: Change<InstanceElement>[], orderField: string) :
    {
      onlyOrderChanges : ModificationChange<InstanceElement>[]
      mixedOrderChanges: ModificationChange<InstanceElement>[]
      onlyNonOrderChanges : Change<InstanceElement>[]
    } => {
  const onlyOrderChanges : ModificationChange<InstanceElement>[] = []
  const mixedOrderChanges : ModificationChange<InstanceElement>[] = []
  const onlyNonOrderChanges : Change<InstanceElement>[] = []

  changes.forEach(change => {
    if (isRemovalChange(change)) {
      onlyNonOrderChanges.push(change)
      return
    }
    // currently isn't supported because children can't exist before the parent
    if (isAdditionChange(change)) {
      onlyNonOrderChanges.push(change)
      return
    }
    const parentChanges = detailedCompare(change.data.before, change.data.after)
    const hasOnlyOrderChanges = parentChanges.every(c =>
      c.id.createTopLevelParentID().path[0] === orderField)
    const hasAnyOrderChanges = parentChanges.some(c =>
      c.id.createTopLevelParentID().path[0] === orderField)

    if (hasOnlyOrderChanges) {
      onlyOrderChanges.push(change)
    } else if (hasAnyOrderChanges) {
      mixedOrderChanges.push(change)
    } else {
      onlyNonOrderChanges.push(change)
    }
  })

  return { onlyOrderChanges, mixedOrderChanges, onlyNonOrderChanges }
}

// Transform order changes to new changes and deploy them
export const deployOrderChanges = async (
  { onlyOrderChanges,
    mixedOrderChanges,
    client,
    config,
    orderField } : {
    onlyOrderChanges: ModificationChange<InstanceElement>[]
    mixedOrderChanges: ModificationChange<InstanceElement>[]
    client: ZendeskClient
    config: FilterContext
    orderField: string
}) : Promise<DeployResult> => {
  const orderChangesToApply: Change<InstanceElement>[] = []
  const orderChangeErrors: Error[] = []

  onlyOrderChanges.concat(mixedOrderChanges).forEach(change => {
    const parentValue = change.data.after.value

    if (!parentValue[orderField].every(isReferenceExpression)) {
      orderChangeErrors.push(new Error(`Error updating ${orderField} positions of '${parentValue.name}' - some values in the list are not a reference`))
      return
    }

    const children = parentValue[orderField].map((c: ReferenceExpression) => c.value)

    children.forEach((child: InstanceElement, i : number) => {
      // Create a 'fake' change of the child's position
      const beforeChild = new InstanceElement(
        child.elemID.name,
        child.refType,
        { id: child.value.id, position: child.value.position }
      )
      const afterChild = beforeChild.clone()
      afterChild.value.position = i

      orderChangesToApply.push({
        action: 'modify',
        data: {
          before: beforeChild,
          after: afterChild,
        },
      })
    })
  })

  const orderChangesDeployResult = await deployChanges(
    orderChangesToApply,
    async change => {
      await deployChange(change, client, config.apiDefinitions)
    }
  )

  // Deploy the changes that only included order changes, we are finished with them
  const onlyChangeDeployResult = await deployChanges(
    onlyOrderChanges,
    async change => {
      await deployChange(change, client, config.apiDefinitions, [orderField])
    }
  )

  return {
    // Without orderChangesDeployResult appliedChanges because they are fake temporary changes
    appliedChanges: onlyChangeDeployResult.appliedChanges,
    errors: [
      ...onlyChangeDeployResult.errors,
      ...orderChangesDeployResult.errors,
      ...orderChangeErrors,
    ],
  }
}
