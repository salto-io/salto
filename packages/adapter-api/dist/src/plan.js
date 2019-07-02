"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = __importStar(require("lodash"));
const elements_1 = require("./elements");
var PlanActionType;
(function (PlanActionType) {
    PlanActionType[PlanActionType["ADD"] = 0] = "ADD";
    PlanActionType[PlanActionType["MODIFY"] = 1] = "MODIFY";
    PlanActionType[PlanActionType["REMOVE"] = 2] = "REMOVE";
})(PlanActionType = exports.PlanActionType || (exports.PlanActionType = {}));
class PlanAction {
    constructor(name, actionType, subChanges, 
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    newValue, 
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    oldValue) {
        this.name = name;
        this.actionType = actionType;
        this.subChanges = subChanges || [];
        this.newValue = newValue;
        this.oldValue = oldValue;
    }
    static createAnnotationValuesChanges(oldAnno, newAnno) {
        const allKeys = Object.keys(oldAnno).concat(Object.keys(newAnno));
        return allKeys.map((k) => {
            let actionType;
            if (oldAnno[k] && newAnno[k]) {
                actionType = PlanActionType.MODIFY;
            }
            else if (!oldAnno[k] && newAnno[k]) {
                actionType = PlanActionType.ADD;
            }
            else {
                actionType = PlanActionType.REMOVE;
            }
            const subChanges = (_.isPlainObject(oldAnno[k]) || _.isPlainObject(newAnno[k]))
                ? PlanAction.createAnnotationValuesChanges(oldAnno[k] || {}, newAnno[k] || {}) : [];
            return new PlanAction(k, actionType, subChanges, newAnno[k], oldAnno[k]);
        });
    }
    static fillActionPlanWithElement(element, actionType, name) {
        const newValue = (actionType === PlanActionType.ADD) ? element : undefined;
        const oldValue = (actionType === PlanActionType.REMOVE) ? element : undefined;
        const annotationFill = Object.keys(element.annotations).map(key => PlanAction.fillActionPlanWithElement(element.annotations[key], actionType, key));
        const valuesFill = (actionType === PlanActionType.ADD)
            ? PlanAction.createAnnotationValuesChanges({}, element.annotationsValues)
            : PlanAction.createAnnotationValuesChanges(element.annotationsValues, {});
        const baseFill = annotationFill.concat(valuesFill);
        if (elements_1.isObjectType(element)) {
            const fieldChanges = Object.keys(element.fields).map(key => PlanAction.fillActionPlanWithElement(element.fields[key], actionType, key));
            const subChanges = baseFill.concat(fieldChanges);
            return new PlanAction(name, actionType, subChanges, newValue, oldValue);
        }
        if (elements_1.isListType(element) && element.elementType) {
            return PlanAction.fillActionPlanWithElement(element.elementType, actionType, name);
        }
        return new PlanAction(name, actionType, baseFill, newValue, oldValue);
    }
    static createFromElements(oldValue, newValue, name) {
        if (oldValue && !newValue) {
            return PlanAction.fillActionPlanWithElement(oldValue, PlanActionType.REMOVE, name);
        }
        if (!oldValue && newValue) {
            return PlanAction.fillActionPlanWithElement(newValue, PlanActionType.ADD, name);
        }
        if (elements_1.isListType(oldValue) && elements_1.isListType(newValue)) {
            return PlanAction.createFromElements(oldValue.elementType, newValue.elementType, name);
        }
        if (oldValue && newValue) {
            const actionType = PlanActionType.MODIFY;
            const annotationChanges = Object.keys(oldValue.annotations).map(key => PlanAction.createFromElements(oldValue.annotations[key], newValue.annotations[key], key));
            const fieldChanges = (elements_1.isObjectType(oldValue) && elements_1.isObjectType(newValue))
                ? Object.keys(oldValue.fields).map(key => PlanAction.createFromElements(oldValue.fields[key], newValue.fields[key], key)) : [];
            const valuesChanges = PlanAction.createAnnotationValuesChanges(oldValue.annotationsValues, newValue.annotationsValues);
            const subChanges = annotationChanges.concat(fieldChanges).concat(valuesChanges);
            return new PlanAction(name, actionType, subChanges, newValue, oldValue);
        }
        throw new Error('At least one element has to be defined');
    }
}
exports.PlanAction = PlanAction;
//# sourceMappingURL=plan.js.map