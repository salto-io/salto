/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ChangeValidator, InstanceElement, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import flowsChangeValidator from '../../src/change_validators/flows'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import mockClient from '../client'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('flows change validator', () => {
  let flowChanges: Change
  let changeValidator: ChangeValidator
  const { client } = mockClient()

  describe('deactivate a flow', () => {
    let beforeRecord: InstanceElement
    let statusChange: InstanceElement
    let otherModifications: InstanceElement
    beforeEach(() => {
      beforeRecord = createInstanceElement({ fullName: 'flow1', status: 'Active', actionType: 'quick' }, mockTypes.Flow)
      statusChange = beforeRecord.clone()
      statusChange.value.status = 'Obsolete'
      otherModifications = statusChange.clone()
      otherModifications.value.actionType = 'case'
    })

    it('should have info when trying to deactivate a flow', async () => {
      flowChanges = toChange({ before: beforeRecord, after: statusChange })
      changeValidator = flowsChangeValidator(
        buildFetchProfile({ fetchParams: { preferActiveFlowVersions: true } }),
        true,
        client,
      )
      const changeErrors = await changeValidator([flowChanges])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
    })

    it('should inform that a new inactive flow version will be created', async () => {
      flowChanges = toChange({
        before: beforeRecord,
        after: otherModifications,
      })
      changeValidator = flowsChangeValidator(
        buildFetchProfile({ fetchParams: { preferActiveFlowVersions: true } }),
        true,
        client,
      )
      const changeErrors = await changeValidator([flowChanges])
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Info')
      expect(changeError.detailedMessage).toInclude(
        'Bear in mind that the new inactive version will not appear in Salto',
      )
    })
  })
  describe('adding and editing an active flow', () => {
    beforeEach(() => {
      const beforeRecord = createInstanceElement(
        { fullName: 'flow2', status: 'Active', actionType: 'quick' },
        mockTypes.Flow,
      )
      const afterRecord = beforeRecord.clone()
      afterRecord.value.actionType = 'case'
      flowChanges = toChange({ before: beforeRecord, after: afterRecord })
    })
    describe('sandbox env', () => {
      beforeEach(() => {
        changeValidator = flowsChangeValidator(
          buildFetchProfile({ fetchParams: { preferActiveFlowVersions: true } }),
          true,
          client,
        )
      })
      it('should have info message regarding the new flow version', async () => {
        const changeErrors = await changeValidator([flowChanges])
        expect(changeErrors).toHaveLength(1)
        const [changeError] = changeErrors
        expect(changeError.severity).toEqual('Info')
      })
    })
    describe('non-sandbox env', () => {
      const flowSettings = createInstanceElement(
        { fullName: '', enableFlowDeployAsActiveEnabled: true },
        mockTypes.FlowSettings,
      )
      const elementsSource = buildElementsSourceFromElements([flowSettings])
      // const elementsSources = elementSource.createInMemoryElementSource([flowSettings])
      beforeEach(() => {
        changeValidator = flowsChangeValidator(
          buildFetchProfile({ fetchParams: { preferActiveFlowVersions: true } }),
          false,
          client,
        )
      })
      describe('active flow modifications', () => {
        it('should have info message and post deploy action regarding the new flow version', async () => {
          const changeErrors = await changeValidator([flowChanges], elementsSource)
          expect(changeErrors).toHaveLength(1)
          const [changeError] = changeErrors
          expect(changeError.severity).toEqual('Info')
          expect(changeError.deployActions?.postAction?.title).toEqual('Flows test coverage')
        })
        it('should have info message regarding the new flow version', async () => {
          const changeErrors = await changeValidator([flowChanges]) // enableActiveDeploy setting is false
          expect(changeErrors).toHaveLength(1)
          const [changeError] = changeErrors
          expect(changeError.severity).toEqual('Info')
          expect(changeError.deployActions?.postAction?.title).toEqual('Deploying flows as inactive')
        })
      })
      describe('activating a flow', () => {
        describe('when status is Draft', () => {
          beforeEach(() => {
            const beforeRecord = createInstanceElement(
              { fullName: 'flow3', status: 'Draft', actionType: 'quick' },
              mockTypes.Flow,
            )
            const afterRecord = beforeRecord.clone()
            afterRecord.value.status = 'Active'
            flowChanges = toChange({ before: beforeRecord, after: afterRecord })
          })
          it('should have info message and post deploy action regarding the new flow version', async () => {
            const changeErrors = await changeValidator([flowChanges], elementsSource)
            expect(changeErrors).toHaveLength(1)
            const [changeError] = changeErrors
            expect(changeError.severity).toEqual('Info')
          })
          it('should have error message regarding the new flow version', async () => {
            const changeErrors = await changeValidator([flowChanges]) // enableActiveDeploy setting is false
            expect(changeErrors).toHaveLength(1)
            const [changeError] = changeErrors
            expect(changeError.severity).toEqual('Error')
          })
        })
        describe('when status is InvalidDraft', () => {
          beforeEach(() => {
            const beforeRecord = createInstanceElement(
              { fullName: 'flow', status: 'InvalidDraft', actionType: 'quick' },
              mockTypes.Flow,
            )
            const afterRecord = beforeRecord.clone()
            afterRecord.value.status = 'Active'
            flowChanges = toChange({ before: beforeRecord, after: afterRecord })
          })
          it('should return error message regarding trying to activate InvalidDraft', async () => {
            const changeErrors = await changeValidator([flowChanges])
            expect(changeErrors).toHaveLength(1)
            expect(changeErrors[0].severity).toEqual('Error')
            expect(changeErrors[0].message).toContain('Invalid')
          })
        })
      })
      describe('adding an active flow', () => {
        beforeEach(() => {
          const afterRecord = createInstanceElement(
            { fullName: 'flow2', status: 'Active', actionType: 'quick' },
            mockTypes.Flow,
          )
          flowChanges = toChange({ after: afterRecord })
        })
        it('should have post deploy action regarding the new flow version', async () => {
          const changeErrors = await changeValidator([flowChanges], elementsSource)
          expect(changeErrors).toHaveLength(1)
          const [changeError] = changeErrors
          expect(changeError.severity).toEqual('Info')
          expect(changeError.deployActions?.postAction?.title).toEqual('Flows test coverage')
        })
        it('should have info message regarding the new flow version', async () => {
          const changeErrors = await changeValidator([flowChanges]) // enableActiveDeploy setting is false
          expect(changeErrors).toHaveLength(1)
          const [changeError] = changeErrors
          expect(changeError.severity).toEqual('Info')
          expect(changeError.deployActions?.postAction?.title).toEqual('Deploying flows as inactive')
        })
      })
    })
  })
  describe('deleting a flow', () => {
    beforeEach(() => {
      changeValidator = flowsChangeValidator(
        buildFetchProfile({ fetchParams: { preferActiveFlowVersions: true } }),
        false,
        client,
      )
      const beforeRecord = createInstanceElement({ fullName: 'flow', status: 'Active' }, mockTypes.Flow)
      flowChanges = toChange({ before: beforeRecord })
    })

    it('should have error when trying to delete a flow', async () => {
      const changeErrors = await changeValidator([flowChanges])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('adding and editing a draft flow', () => {
    beforeEach(() => {
      changeValidator = flowsChangeValidator(
        buildFetchProfile({ fetchParams: { preferActiveFlowVersions: true } }),
        false,
        client,
      )
    })
    describe('add a new draft flow', () => {
      beforeEach(() => {
        const afterRecord = createInstanceElement(
          { fullName: 'flow', status: 'Draft', actionType: 'quick' },
          mockTypes.Flow,
        )
        flowChanges = toChange({ after: afterRecord })
      })
      it('should not throw any error', async () => {
        const changeErrors = await changeValidator([flowChanges])
        expect(changeErrors).toHaveLength(0)
      })
    })
    describe('edit draft flow', () => {
      beforeEach(() => {
        const beforeRecord = createInstanceElement(
          { fullName: 'flow', status: 'Draft', actionType: 'quick' },
          mockTypes.Flow,
        )
        const afterRecord = beforeRecord.clone()
        afterRecord.value.actionType = 'fast'
        flowChanges = toChange({ before: beforeRecord, after: afterRecord })
      })
      it('should not throw any error', async () => {
        const changeErrors = await changeValidator([flowChanges])
        expect(changeErrors).toHaveLength(0)
      })
    })
  })
})
