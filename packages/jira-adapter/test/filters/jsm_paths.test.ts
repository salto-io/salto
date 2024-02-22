/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { filterUtils, elements as adapterElements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { InstanceElement, ReferenceExpression, Element, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { FilterResult } from '../../src/filter'
import { getDefaultConfig } from '../../src/config/config'
import jsmArrangePathsFilter from '../../src/filters/jsm_paths'
import { createEmptyType, getFilterParams } from '../utils'
import {
  CALENDAR_TYPE,
  JIRA,
  PORTAL_GROUP_TYPE,
  PROJECT_TYPE,
  QUEUE_TYPE,
  REQUEST_TYPE_NAME,
} from '../../src/constants'

describe('jsmPathsFilter', () => {
  type FilterType = filterUtils.FilterWith<'deploy' | 'onFetch', FilterResult>
  let filter: FilterType
  let elements: Element[]
  let projectInstance: InstanceElement
  let queueInstance: InstanceElement
  let portalInstance: InstanceElement
  let requestTypeInstance: InstanceElement
  let calendarInstance: InstanceElement

  beforeEach(() => {
    projectInstance = new InstanceElement(
      'project1',
      createEmptyType(PROJECT_TYPE),
      {
        id: 11111,
        name: 'project1',
        projectTypeKey: 'service_desk',
      },
      [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'project1', 'project1'],
    )
  })
  describe('on fetch', () => {
    beforeEach(async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = true
      filter = jsmArrangePathsFilter(getFilterParams({ config })) as typeof filter
      queueInstance = new InstanceElement(
        'queue1',
        createEmptyType(QUEUE_TYPE),
        {
          id: 11111,
          name: 'All open',
        },
        [JIRA, adapterElements.RECORDS_PATH, QUEUE_TYPE, 'queue1'],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      portalInstance = new InstanceElement(
        'portal1',
        createEmptyType(PORTAL_GROUP_TYPE),
        {
          id: 2222,
          name: 'portal1',
          projectTypeKey: 'service_desk',
        },
        [JIRA, adapterElements.RECORDS_PATH, PORTAL_GROUP_TYPE, 'portal1'],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      requestTypeInstance = new InstanceElement(
        'requestType1',
        createEmptyType(REQUEST_TYPE_NAME),
        {
          id: 11111,
          name: 'requestType1',
          description: 'requestType1',
        },
        [JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestType1'],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      calendarInstance = new InstanceElement(
        'calendar1',
        createEmptyType(CALENDAR_TYPE),
        {
          id: 11111,
          name: 'calendar1',
        },
        [JIRA, adapterElements.RECORDS_PATH, CALENDAR_TYPE, 'calendar1'],
        {
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance.elemID, projectInstance)],
        },
      )
      elements = [projectInstance, queueInstance, portalInstance, requestTypeInstance, calendarInstance]
    })
    it('should change path to be subdirectory of parent', async () => {
      await filter.onFetch(elements)
      expect(queueInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        PROJECT_TYPE,
        'project1',
        'queues',
        'queue1',
      ])
      expect(portalInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        PROJECT_TYPE,
        'project1',
        'portalGroups',
        'portal1',
      ])
      expect(requestTypeInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        PROJECT_TYPE,
        'project1',
        'requestTypes',
        'requestType1',
      ])
      expect(calendarInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        PROJECT_TYPE,
        'project1',
        'calendars',
        'calendar1',
      ])
    })
    it('should not change path to be subdirectory of parent if enableJSM is false', async () => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = jsmArrangePathsFilter(getFilterParams({ config })) as typeof filter
      await filter.onFetch(elements)
      expect(queueInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, QUEUE_TYPE, 'queue1'])
      expect(portalInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, PORTAL_GROUP_TYPE, 'portal1'])
      expect(requestTypeInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestType1'])
      expect(calendarInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, CALENDAR_TYPE, 'calendar1'])
    })
    it('should not change path to be subdirectory of parent if parent is not valid', async () => {
      const queueWithInvalidParent = queueInstance.clone()
      queueWithInvalidParent.annotations[CORE_ANNOTATIONS.PARENT] = ['invalidParent']
      elements = [projectInstance, queueInstance, portalInstance, requestTypeInstance, calendarInstance]
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableJSM = false
      filter = jsmArrangePathsFilter(getFilterParams({ config })) as typeof filter
      await filter.onFetch(elements)
      expect(queueInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, QUEUE_TYPE, 'queue1'])
      expect(portalInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, PORTAL_GROUP_TYPE, 'portal1'])
      expect(requestTypeInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestType1'])
      expect(calendarInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, CALENDAR_TYPE, 'calendar1'])
    })
    it('should not change path to be subdirectory of parent if parent path is undefined', async () => {
      projectInstance.path = undefined
      await filter.onFetch(elements)
      expect(queueInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, QUEUE_TYPE, 'queue1'])
      expect(portalInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, PORTAL_GROUP_TYPE, 'portal1'])
      expect(requestTypeInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, REQUEST_TYPE_NAME, 'requestType1'])
      expect(calendarInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, CALENDAR_TYPE, 'calendar1'])
    })
    it('should add path for all types except portalGroup and Calendar', async () => {
      const projectWithPathUndefined = projectInstance.clone()
      projectWithPathUndefined.path = undefined
      portalInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(projectWithPathUndefined.elemID, projectWithPathUndefined),
      ]
      calendarInstance.annotations[CORE_ANNOTATIONS.PARENT] = [
        new ReferenceExpression(projectWithPathUndefined.elemID, projectWithPathUndefined),
      ]
      await filter.onFetch(elements)
      expect(queueInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        PROJECT_TYPE,
        'project1',
        'queues',
        'queue1',
      ])
      expect(portalInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, PORTAL_GROUP_TYPE, 'portal1'])
      expect(requestTypeInstance.path).toEqual([
        JIRA,
        adapterElements.RECORDS_PATH,
        PROJECT_TYPE,
        'project1',
        'requestTypes',
        'requestType1',
      ])
      expect(calendarInstance.path).toEqual([JIRA, adapterElements.RECORDS_PATH, CALENDAR_TYPE, 'calendar1'])
    })
  })
})
