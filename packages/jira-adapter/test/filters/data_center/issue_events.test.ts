/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ElemIdGetter, ObjectType } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA } from '../../../src/constants'
import issueEventsDcDeployFilter from '../../../src/filters/data_center/issue_events'

describe('issue_events', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let objectType: ObjectType
  let objectWrongType: ObjectType
  beforeEach(() => {
    const elemIdGetter = mockFunction<ElemIdGetter>().mockImplementation(
      (adapterName, _serviceIds, name) => new ElemID(adapterName, name),
    )

    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))

    const { client, paginator } = mockClient(true)
    filter = issueEventsDcDeployFilter(
      getFilterParams({
        client,
        paginator,
        config,
        getElemIdFunc: elemIdGetter,
      }),
    ) as typeof filter

    objectType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueEvent'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        templateName: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        id: { refType: BuiltinTypes.SERVICE_ID_NUMBER },
      },
    })
    objectWrongType = new ObjectType({
      elemID: new ElemID(JIRA, 'PermissionScheme'),
      fields: {
        name: { refType: BuiltinTypes.STRING },
        templateName: { refType: BuiltinTypes.STRING },
        description: { refType: BuiltinTypes.STRING },
        id: { refType: BuiltinTypes.SERVICE_ID_NUMBER },
      },
    })
  })
  it('should change annotations on type', async () => {
    await filter.onFetch([objectWrongType, objectType])
    expect(objectType.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeTrue()
    expect(objectType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    expect(objectType.fields.id.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeFalse()
    expect(objectType.fields.id.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    expect(objectType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    expect(objectType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeTrue()
    expect(objectType.fields.description.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    expect(objectType.fields.description.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeTrue()
    expect(objectType.fields.templateName.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeTrue()
    expect(objectType.fields.templateName.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeTrue()
  })
  it('should not add annotations when operating on a different type', async () => {
    await filter.onFetch([objectWrongType])
    expect(objectWrongType.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectWrongType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectWrongType.fields.id.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectWrongType.fields.id.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectWrongType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectWrongType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectWrongType.fields.description.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectWrongType.fields.description.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectWrongType.fields.templateName.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectWrongType.fields.templateName.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
  })
  it('should not change type on cloud flow', async () => {
    const elemIdGetter = mockFunction<ElemIdGetter>().mockImplementation(
      (adapterName, _serviceIds, name) => new ElemID(adapterName, name),
    )
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    const { client, paginator } = mockClient()
    const cloudFilter = issueEventsDcDeployFilter(
      getFilterParams({
        client,
        paginator,
        config,
        getElemIdFunc: elemIdGetter,
      }),
    ) as typeof filter
    await cloudFilter.onFetch([objectType])
    expect(objectType.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectType.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectType.fields.id.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectType.fields.id.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectType.fields.name.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectType.fields.name.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectType.fields.description.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectType.fields.description.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
    expect(objectType.fields.templateName.annotations[CORE_ANNOTATIONS.UPDATABLE]).toBeUndefined()
    expect(objectType.fields.templateName.annotations[CORE_ANNOTATIONS.CREATABLE]).toBeUndefined()
  })
})
