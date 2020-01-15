import { ElemID, InstanceElement, ObjectType } from 'adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  WORKFLOW_ALERTS_FIELD, WORKFLOW_FIELD_UPDATES_FIELD, WORKFLOW_RULES_FIELD,
  WORKFLOW_TASKS_FIELD, WORKFLOW_TYPE_ID,
} from '../../src/filters/workflow'
import mockClient from '../client'
import {
  API_NAME_SEPERATOR, INSTANCE_FULL_NAME_FIELD, SALESFORCE, WORKFLOW_METADATA_TYPE,
} from '../../src/constants'

describe('Workflow filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'> & FilterWith<'onAdd'>
    & FilterWith<'onUpdate'> & FilterWith<'onRemove'>

  const workflowInstanceName = 'Account'
  const workflowObjectType = new ObjectType({ elemID: WORKFLOW_TYPE_ID })
  const generateWorkFlowInstance = (beforeFetch = false): InstanceElement => {
    const fullNamePrefix = beforeFetch ? '' : `${workflowInstanceName}${API_NAME_SEPERATOR}`
    return new InstanceElement('Account',
      workflowObjectType,
      {
        [INSTANCE_FULL_NAME_FIELD]: workflowInstanceName,
        [WORKFLOW_ALERTS_FIELD]: [
          {
            [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowAlert1`,
            description: 'description',
          },
          {
            [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowAlert2`,
            description: 'description',
          },
        ],
        [WORKFLOW_FIELD_UPDATES_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowFieldUpdate`,
        },
        [WORKFLOW_TASKS_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowTask`,
        },
        [WORKFLOW_RULES_FIELD]: {
          [INSTANCE_FULL_NAME_FIELD]: `${fullNamePrefix}MyWorkflowRule`,
        },
      },
      beforeFetch ? [SALESFORCE, 'records', WORKFLOW_METADATA_TYPE, 'Account']
        : [SALESFORCE, 'records', 'WorkflowRules', 'AccountWorkflowRules'])
  }

  describe('on fetch', () => {
    it('should modify inner types full_names to contain the parent fullName', async () => {
      const workflowWithInnerTypes = generateWorkFlowInstance(true)
      await filter.onFetch([workflowWithInnerTypes])
      expect(workflowWithInnerTypes.value[WORKFLOW_ALERTS_FIELD][0][INSTANCE_FULL_NAME_FIELD])
        .toEqual('Account.MyWorkflowAlert1')
      expect(workflowWithInnerTypes.value[WORKFLOW_ALERTS_FIELD][1][INSTANCE_FULL_NAME_FIELD])
        .toEqual('Account.MyWorkflowAlert2')
      expect(workflowWithInnerTypes.value[WORKFLOW_FIELD_UPDATES_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('Account.MyWorkflowFieldUpdate')
      expect(workflowWithInnerTypes.value[WORKFLOW_TASKS_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('Account.MyWorkflowTask')
      expect(workflowWithInnerTypes.value[WORKFLOW_RULES_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('Account.MyWorkflowRule')
    })

    it('should not modify non workflow instances', async () => {
      const dummyInstance = generateWorkFlowInstance(true)
      dummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
      await filter.onFetch([dummyInstance])
      expect(dummyInstance.value[WORKFLOW_ALERTS_FIELD][0][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowAlert1')
      expect(dummyInstance.value[WORKFLOW_ALERTS_FIELD][1][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowAlert2')
      expect(dummyInstance.value[WORKFLOW_FIELD_UPDATES_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowFieldUpdate')
      expect(dummyInstance.value[WORKFLOW_TASKS_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowTask')
      expect(dummyInstance.value[WORKFLOW_RULES_FIELD][INSTANCE_FULL_NAME_FIELD])
        .toEqual('MyWorkflowRule')
    })

    it('should set workflow instances path correctly', async () => {
      const workflowWithInnerTypes = generateWorkFlowInstance(true)
      await filter.onFetch([workflowWithInnerTypes])
      expect(workflowWithInnerTypes.path)
        .toEqual([SALESFORCE, 'records', 'WorkflowRules', 'AccountWorkflowRules'])
    })

    it('should set non workflow instances path correctly', async () => {
      const dummyInstance = generateWorkFlowInstance(true)
      dummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
      const beforeFilterPath = dummyInstance.path
      await filter.onFetch([dummyInstance])
      expect(dummyInstance.path).toEqual(beforeFilterPath)
    })
  })

  describe('on add', () => {
    let mockUpsert: jest.Mock

    beforeEach(() => {
      mockUpsert = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.upsert = mockUpsert
    })

    it('should call upsert for all workflow inner types', async () => {
      await filter.onAdd(generateWorkFlowInstance())
      expect(mockUpsert).toHaveBeenCalledWith('WorkflowAlert', [{
        fullName: 'Account.MyWorkflowAlert1',
        description: 'description',
      },
      {
        fullName: 'Account.MyWorkflowAlert2',
        description: 'description',
      }])
      expect(mockUpsert).toHaveBeenCalledWith('WorkflowFieldUpdate', [{
        fullName: 'Account.MyWorkflowFieldUpdate',
      }])
      expect(mockUpsert).toHaveBeenCalledWith('WorkflowTask', [{
        fullName: 'Account.MyWorkflowTask',
      }])
      expect(mockUpsert).toHaveBeenCalledWith('WorkflowRule', [{
        fullName: 'Account.MyWorkflowRule',
      }])
    })

    it('should not call upsert for non workflow instances', async () => {
      const dummyInstance = generateWorkFlowInstance()
      dummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
      await filter.onAdd(dummyInstance)
      expect(mockUpsert).toHaveBeenCalledTimes(0)
    })
  })

  describe('on update', () => {
    let mockUpsert: jest.Mock
    let mockUpdate: jest.Mock
    let mockDelete: jest.Mock

    beforeEach(() => {
      mockUpsert = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.upsert = mockUpsert
      mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.update = mockUpdate
      mockDelete = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.delete = mockDelete
    })

    describe('for workflow instance', () => {
      beforeEach(async () => {
        const beforeWorkflowInstance = generateWorkFlowInstance()
        const afterWorkflowInstance = beforeWorkflowInstance.clone()
        afterWorkflowInstance.value[WORKFLOW_ALERTS_FIELD][0][INSTANCE_FULL_NAME_FIELD] = 'Account.MyWorkflowAlert3'
        afterWorkflowInstance.value[WORKFLOW_ALERTS_FIELD][1].description = 'updated description'
        await filter.onUpdate(beforeWorkflowInstance, afterWorkflowInstance, [])
      })

      it('should call upsert for new inner types', async () => {
        expect(mockUpsert).toHaveBeenCalledWith('WorkflowAlert', [{
          fullName: 'Account.MyWorkflowAlert3',
          description: 'description',
        }])
      })

      it('should call update for modified inner types', async () => {
        expect(mockUpdate).toHaveBeenCalledWith('WorkflowAlert', [{
          fullName: 'Account.MyWorkflowAlert2',
          description: 'updated description',
        }])
      })

      it('should call delete for deleted inner types', async () => {
        expect(mockDelete).toHaveBeenCalledWith('WorkflowAlert', ['Account.MyWorkflowAlert1'])
      })
    })

    it('should not call upsert/update/delete for non workflow instances', async () => {
      const beforeDummyInstance = generateWorkFlowInstance()
      beforeDummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
      const afterDummyInstance = beforeDummyInstance.clone()
      afterDummyInstance.value[WORKFLOW_ALERTS_FIELD][0][INSTANCE_FULL_NAME_FIELD] = 'Account.MyWorkflowAlert3'
      afterDummyInstance.value[WORKFLOW_ALERTS_FIELD][1].description = 'updated description'
      await filter.onUpdate(beforeDummyInstance, afterDummyInstance, [])
      expect(mockUpsert).toHaveBeenCalledTimes(0)
      expect(mockUpdate).toHaveBeenCalledTimes(0)
      expect(mockDelete).toHaveBeenCalledTimes(0)
    })
  })

  describe('on remove', () => {
    let mockDelete: jest.Mock

    beforeEach(() => {
      mockDelete = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
      client.delete = mockDelete
    })

    it('should call delete for all workflow inner types', async () => {
      await filter.onRemove(generateWorkFlowInstance())
      expect(mockDelete).toHaveBeenCalledWith('WorkflowAlert',
        ['Account.MyWorkflowAlert1', 'Account.MyWorkflowAlert2'])
      expect(mockDelete).toHaveBeenCalledWith('WorkflowFieldUpdate',
        ['Account.MyWorkflowFieldUpdate'])
      expect(mockDelete).toHaveBeenCalledWith('WorkflowTask', ['Account.MyWorkflowTask'])
      expect(mockDelete).toHaveBeenCalledWith('WorkflowRule', ['Account.MyWorkflowRule'])
    })

    it('should not call delete for non workflow instances', async () => {
      const dummyInstance = generateWorkFlowInstance()
      dummyInstance.type = new ObjectType({ elemID: new ElemID(SALESFORCE, 'dummy') })
      await filter.onRemove(dummyInstance)
      expect(mockDelete).toHaveBeenCalledTimes(0)
    })
  })
})
