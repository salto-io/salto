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
import {
  Change, ElemID, InstanceElement,
  isAdditionChange, isReferenceExpression,
  isRemovalChange,
  ModificationChange, ObjectType, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { deployChange, deployChanges } from '../deployment'
import ZendeskClient from '../client/client'
import { FilterContext } from '../config'
import { ARTICLE_TYPE_NAME, CATEGORY_TYPE_NAME, SECTION_TYPE_NAME, ZENDESK } from '../constants'

const { awu } = collections.asynciterable

export const CATEGORIES_FIELD = 'categories'
export const SECTIONS_FIELD = 'sections'
export const ARTICLES_FIELD = 'articles'

const orderFieldToType : {[key: string]: ObjectType} = {
  [CATEGORIES_FIELD]: new ObjectType({ elemID: new ElemID(ZENDESK, CATEGORY_TYPE_NAME) }),
  [SECTIONS_FIELD]: new ObjectType({ elemID: new ElemID(ZENDESK, SECTION_TYPE_NAME) }),
  [ARTICLES_FIELD]: new ObjectType({ elemID: new ElemID(ZENDESK, ARTICLE_TYPE_NAME) }),
}

/* Split the changes into 2 groups:
  withOrderChanges    - Changes with order changes
  onlyNonOrderChanges - Changes without any order changes
 */
export const sortChanges = (changes: Change<InstanceElement>[], orderField: string): {
  withOrderChanges : ModificationChange<InstanceElement>[]
  onlyNonOrderChanges : Change<InstanceElement>[]
} => {
  const withOrderChanges : ModificationChange<InstanceElement>[] = []
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
    const hasAnyOrderChanges = parentChanges.some(c =>
      c.id.createTopLevelParentID().path[0] === orderField)

    if (hasAnyOrderChanges) {
      withOrderChanges.push(change)
    } else {
      onlyNonOrderChanges.push(change)
    }
  })

  return { withOrderChanges, onlyNonOrderChanges }
}

// Transform order changes to new changes and deploy them
export const deployOrderChanges = async ({ changes, client, config, orderField, elementsSource } : {
  changes: ModificationChange<InstanceElement>[]
  client: ZendeskClient
  config: FilterContext
  orderField: string
  elementsSource: ReadOnlyElementsSource
}) : Promise<{ errors: Error[] }> => {
  const orderChangesToApply: Change<InstanceElement>[] = []
  const orderChangeErrors: Error[] = []

  await awu(changes).forEach(async change => {
    // We get the real instanceElement because we need the orderField to be references
    const parentInstanceElement = await elementsSource.get(change.data.after.elemID)
    const parentChildren = parentInstanceElement.value[orderField]

    if (!parentChildren.every(isReferenceExpression)) {
      orderChangeErrors.push(new Error(`Error updating ${orderField} positions of '${parentInstanceElement.value.name}' - some values in the list are not a reference`))
      return
    }

    await awu(parentChildren).filter(isReferenceExpression).forEach(async (child, i) => {
      const childInstanceElement = await child.getResolvedValue(elementsSource)
      const refType = orderFieldToType[orderField]
      // Create a 'fake' change of the child's position
      const beforeChild = new InstanceElement(
        childInstanceElement.elemID.name,
        refType,
        { id: childInstanceElement.value.id, position: childInstanceElement.value.position }
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

  return {
    errors: [
      ...orderChangesDeployResult.errors,
      ...orderChangeErrors,
    ],
  }
}
