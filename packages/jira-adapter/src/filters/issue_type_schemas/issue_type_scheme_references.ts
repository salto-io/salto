/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, InstanceElement, isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { ISSUE_TYPE_SCHEMA_NAME } from '../../constants'
import { FilterCreator } from '../../filter'

const filter: FilterCreator = () => ({
  name: 'issueTypeSchemeReferences',
  onFetch: async (elements: Element[]) => {
    const isIssueTypeScheme = (element: Element): boolean => element.elemID.typeName === ISSUE_TYPE_SCHEMA_NAME
    const setReferences = (scheme: InstanceElement): void => {
      type IssueTypeMapping = { issueTypeId: ReferenceExpression }
      scheme.value.issueTypeIds = scheme.value.issueTypeIds?.map(
        (issueTypeMapping: IssueTypeMapping) => issueTypeMapping.issueTypeId,
      )
    }
    elements.filter(isInstanceElement).filter(isIssueTypeScheme).forEach(setReferences)
  },
})

export default filter
