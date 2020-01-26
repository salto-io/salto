import { MockElementSource } from "test/common/element_source"
import { ObjectType, ElemID, PrimitiveType, PrimitiveTypes, InstanceElement, Field, BuiltinTypes } from "adapter-api"
import _ from "lodash"

describe('projections', () => {
    const nestedElemID = new ElemID('salto', 'nested')
    const nestedObj = new ObjectType({
        elemID: nestedElemID,
        fields: {
            simple1 : new Field(nestedElemID, 'simple1', BuiltinTypes.STRING),
            simple2 : new Field(nestedElemID, 'simple2', BuiltinTypes.STRING),
        }
    })
    const annotationsObject = {
            simple1 :  BuiltinTypes.STRING,
            list1 :  BuiltinTypes.STRING, 
            nested1 :  nestedObj, 
            simple2 :  BuiltinTypes.STRING,
            list2 :  BuiltinTypes.STRING, 
            nested2 :  nestedObj, 
    }
    const primitiveType = new PrimitiveType({
        elemID: new ElemID('salto', 'string'),
        primitive: PrimitiveTypes.STRING,
        annotationTypes: annotationsObject,
        annotations: {
            simple1: "PRIMITIVE_1",
            list1: ['PRIMITIVE_LIST_1'],
            nested1: {
                simple1: 'PRIMITIVE_NESTED_1',
                simple2: 'PRIMITIVE_NESTED_2'
            },
            simple2: "PRIMITIVE_1",
            list2: ['PRIMITIVE_LIST_1'],
            nested2: {
                simple1: 'PRIMITIVE_NESTED_1',
                simple2: 'PRIMITIVE_NESTED_2'
            }
        }
    })
    const objectTypeElemID = new ElemID('salto', 'object')
    const objectType = new ObjectType({
        elemID: objectTypeElemID,
        annotationTypes : annotationsObject,
        annotations: {},
        fields: _.mapValues(annotationsObject, (v, k) => new Field(
            objectTypeElemID, k, v, {}, k.includes('list')
        )),
    })
    const instance = new InstanceElement(
        'instance', 
        objectType,
        {

        }
    )

    const baseElements = [primitiveType, objectType, instance]
    describe('project instances', () => {
        const source = new MockElementSource(baseElements)
        it('should project an add change for a non existing fragment for instances', async () =>{

        })
        it('should not project an add change for an existing fragment for instances', async () =>{
            
        })
        it('should project a modify change for an existing fragment for instances', async () =>{
            
        })
        it('should project a remove change for an existing fragment for instances', async () =>{
            
        })
    })

    describe('project object types', () => {
        describe('project object types annotations', () => {
            it('should project an add change for a non existing fragment for object types annotations', async () =>{

            })
            it('should not project an add change for an existing fragment for object types annotations', async () =>{
                
            })
            it('should project a modify change for an existing fragment for object types annotations', async () =>{
                
            })
            it('should project a remove change for an existing fragment for object types annotations', async () =>{
                
            })
        })
        describe('project object types annotationTypes', () => {
            it('should project an add change for a non existing fragment for object types annotations', async () =>{

            })
            it('should not project an add change for an existing fragment for object types annotations', async () =>{
                
            })
            it('should project a modify change for an existing fragment for object types annotations', async () =>{
                
            })
            it('should project a remove change for an existing fragment for object types annotations', async () =>{
                
            })
        })
        describe('project object types fields', () => {
            it('should project an add change for a non existing fragment for object types fields', async () =>{

            })
            it('should not project an add change for an existing fragment for object types fields', async () =>{
                
            })
            it('should project a modify change for an existing fragment for object types fields', async () =>{
                
            })
            it('should project a remove change for an existing fragment for object types fields', async () =>{
                
            })
        })
    })
    describe('project primitive types', () => {
        describe('project primitive types annotations', () => {
            it('should project an add change for a non existing fragment for primitive types annotations', async () =>{

            })
            it('should not project an add change for an existing fragment for primitive types annotations', async () =>{
                
            })
            it('should project a modify change for an existing fragment for primitive types annotations', async () =>{
                
            })
            it('should project a remove change for an existing fragment for primitive types annotations', async () =>{
                
            })
        })
        describe('project primitive types annotationTypes', () => {
            it('should project an add change for a non existing fragment for object types annotationsTypes', async () =>{

            })
            it('should not project an add change for an existing fragment for object types annotationsTypes', async () =>{
                
            })
            it('should project a modify change for an existing fragment for object types annotationsTypes', async () =>{
                
            })
            it('should project a remove change for an existing fragment for object types annotationsTypes', async () =>{
                
            })
        })
    })
    describe('project fields', () => {
        describe('project fields annotations', () => {
            it('should project an add change for a non existing fragment for fields annotations', async () =>{

            })
            it('should not project an add change for an existing fragment for fields annotations', async () =>{
                
            })
            it('should project a modify change for an existing fragment for fields annotations', async () =>{
                
            })
            it('should project a remove change for an existing fragment for fields annotations', async () =>{
                
            })
        })
    })
})