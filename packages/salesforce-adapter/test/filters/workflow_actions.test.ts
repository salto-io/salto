import {
  ObjectType, ElemID, Element, Field, PrimitiveType, PrimitiveTypes, InstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import { FilterWith } from '../../src/filter'
import filterCreator, {
  WORKFLOW_RULE, ACTIONS, WORKFLOW_FIELD_TO_TYPE_MAP,
} from '../../src/filters/workflow_actions'
import * as constants from '../../src/constants'
import mockClient from '../client'

describe('Workflow actions filter', () => {
  const { client } = mockClient()
  const filter = filterCreator({ client }) as FilterWith<'onFetch'>

  let testElements: Element[]

  describe('Workflow actions tests', () => {
    it('should add the actions types to the actions field of the workflow_rule object type', async () => {
      const workflowRuleId = new ElemID(constants.SALESFORCE, WORKFLOW_RULE)
      const mockWorkflowRule = new ObjectType({
        elemID: workflowRuleId,
        fields: {
          [ACTIONS]: new Field(
            workflowRuleId, ACTIONS, new PrimitiveType({
              elemID: new ElemID(constants.SALESFORCE, 'string'),
              primitive: PrimitiveTypes.STRING,
            })
          ),
        },
      })
      const alertId = new ElemID(constants.SALESFORCE, WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[1])
      const mockAlert = new ObjectType({
        elemID: alertId,
        fields: {
          ananas: new Field(
            alertId, 'ananas', new PrimitiveType({
              elemID: new ElemID(constants.SALESFORCE, 'string'),
              primitive: PrimitiveTypes.STRING,
            })
          ),
        },
      })

      testElements = [mockWorkflowRule, mockAlert]
      // Run filter
      await filter.onFetch(testElements)
      // Get results
      const [resultWorkFlowRule, resultAlert, workflowActionsResult] = testElements
      const newActionsType = (resultWorkFlowRule as ObjectType).fields.actions.type
      const alertsField = (newActionsType as ObjectType).fields[WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[0]]
      // Make sure the alerts field in the test is included with our 'ananas' field
      expect(alertsField).toBeDefined()
      expect((alertsField.type as ObjectType).fields.ananas).toBeDefined()
      // And that the rest of the fields which were not in the elements,
      // are not included (such as 'field_updates')
      expect((newActionsType as ObjectType)
        .fields[WORKFLOW_FIELD_TO_TYPE_MAP.FIELD_UPDATE[0]]).toBeUndefined()
      expect(resultAlert).toBeDefined()
      // Make sure the new type is added to the elements
      expect(_.isEqual(workflowActionsResult, newActionsType)).toBeTruthy()
    })

    it('should move only the various action data of a workflow instance to its actions field', async () => {
      const workflowId = new ElemID(constants.SALESFORCE, 'workflow')
      const mockWorkflowInstance = new InstanceElement(
        'mockWorkflow',
        new ObjectType({
          elemID: workflowId,
        }),
        {
          rules: {
            actions: [],
          },
          [WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[0]]: 'abra',
          [WORKFLOW_FIELD_TO_TYPE_MAP.OUTBOUND_MESSAGE[0]]: 'kadabra',
          notMoving: 'avada kadavra',
        }
      )
      testElements = [mockWorkflowInstance]
      // Run filter
      await filter.onFetch(testElements)
      // Get results
      const [resultWorkFlow] = testElements
      // Fields that should move
      expect((resultWorkFlow as InstanceElement).value.rules.actions[WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[0]]).toEqual('abra')
      expect((resultWorkFlow as InstanceElement).value.rules.actions[WORKFLOW_FIELD_TO_TYPE_MAP.OUTBOUND_MESSAGE[0]]).toEqual('kadabra')
      // A field that should not move
      expect((resultWorkFlow as InstanceElement).value.rules.actions.notMoving).toBeUndefined()
    })

    it('should not move any action data of a workflow instance if it has not rules field', async () => {
      const workflowId = new ElemID(constants.SALESFORCE, 'workflow')
      const mockWorkflowInstance = new InstanceElement(
        'mockWorkflow',
        new ObjectType({
          elemID: workflowId,
        }),
        {
          [WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[0]]: 'abra',
          [WORKFLOW_FIELD_TO_TYPE_MAP.OUTBOUND_MESSAGE[0]]: 'kadabra',
        }
      )
      testElements = [mockWorkflowInstance]
      // Run filter
      await filter.onFetch(testElements)
      // Get results
      const [resultWorkFlow] = testElements
      // Fields that should move
      expect((resultWorkFlow as InstanceElement).value.rules).toBeUndefined()
    })

    it('should remove only the required instance records', async () => {
      const mockWorkflowAlertInstance = new InstanceElement(
        'mockWorkflowAlertInstance',
        new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, WORKFLOW_FIELD_TO_TYPE_MAP.ALERT[1]),
        }),
        {
          alpha: 'test',
        }
      )
      const mockWorkflowFieldUpdateInstance = new InstanceElement(
        'mockWorkflowFieldUpdateInstance',
        new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, WORKFLOW_FIELD_TO_TYPE_MAP.FIELD_UPDATE[1]),
        }),
        {
          alpha: 'test',
        }
      )
      const mockWorkflowOutboundMessageInstance = new InstanceElement(
        'mockWorkflowOutboundMessageInstance',
        new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, WORKFLOW_FIELD_TO_TYPE_MAP.OUTBOUND_MESSAGE[1]),
        }),
        {
          alpha: 'test',
        }
      )
      const mockStay = new InstanceElement(
        'mockStay',
        new ObjectType({
          elemID: new ElemID(constants.SALESFORCE, 'stay'),
        }),
        {
          alpha: 'test',
        }
      )
      testElements = [
        mockWorkflowAlertInstance,
        mockWorkflowFieldUpdateInstance,
        mockWorkflowOutboundMessageInstance,
        mockStay,
      ]
      // Run filter
      await filter.onFetch(testElements)
      // Get results
      const result = testElements
      // Verify all required instances were removed
      expect(result).toHaveLength(1)
      expect((result[0] as InstanceElement).elemID.name).toEqual('mockStay')
    })
  })
})
