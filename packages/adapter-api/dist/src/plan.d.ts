import { Type, Values } from './elements';
declare type NullableType = Type | null | undefined;
export declare enum PlanActionType {
    ADD = 0,
    MODIFY = 1,
    REMOVE = 2
}
export declare class PlanAction {
    name: string;
    actionType: PlanActionType;
    subChanges: PlanAction[];
    newValue: any;
    oldValue: any;
    constructor(name: string, actionType: PlanActionType, subChanges?: PlanAction[], newValue?: any, oldValue?: any);
    static createAnnotationValuesChanges(oldAnno: Values, newAnno: Values): PlanAction[];
    static fillActionPlanWithElement(element: Type, actionType: PlanActionType, name: string): PlanAction;
    static createFromElements(oldValue: NullableType, newValue: NullableType, name: string): PlanAction;
}
export {};
