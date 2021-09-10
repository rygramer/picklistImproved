import { LightningElement, wire, track, api } from 'lwc';
import{ getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from "lightning/flowSupport";

export default class WireGetPicklistValues extends LightningElement {
    @api defaultValue;
    @api interviewGuid;
    @api label;
    @api objectfieldApiName;
    @api required;
    @api requiredMessage;
    @api selectedValue;
    @track helpTextToUse;
    @track recordTypeIdToUse;
    @track error;
    @track picklistValues;

    get sessionStorageKey() {
        return this.interviewGuid;
    }
    
    get objectApiName() {
        return this.objectfieldApiName.split('.')[0];
    }

    get fieldApiName() {
        return this.objectfieldApiName.split('.')[1];
    }

    _controllerValue;
    @api
    set controllerValue(value){
        this._controllerValue = '';
        if(value){
            this._controllerValue = value;
        }
    }
    get controllerValue() {
        return this._controllerValue;
    }

    _recordTypeId;
    @api
    set recordTypeId(value) {
        this._recordTypeId = value;
    }
    get recordTypeId() {
        return this._recordTypeId;
    }

    _helpText;
    @api
    set helpText(value) {
        this._helpText = value;
    }
    get helpText() {
        return this._helpText;
    }

    @wire(getObjectInfo, {
        objectApiName: '$objectApiName'
    })
    wiredDefaultRecordTypeId({data}){
        if(data){
            if(this.recordTypeId){
                this.recordTypeIdToUse = this.recordTypeId;
            } else {
                this.recordTypeIdToUse = data.defaultRecordTypeId;
            }
            var helpTextToUse = null;
            var fieldApiName = this.fieldApiName;
            var helpText = this.helpText;
            Object.keys(data.fields).map(function(key){
                if(key == fieldApiName){
                    if(helpText){
                        helpTextToUse = helpText;
                    }
                    else if (data.fields[key].inlineHelpText != null) {
                        helpTextToUse = data.fields[key].inlineHelpText;
                    }
                }
            });
            this.helpTextToUse = helpTextToUse;
        }
    }
    
    disabled = false;
    @wire(getPicklistValues, {
        recordTypeId: '$recordTypeIdToUse',
        fieldApiName: '$objectfieldApiName'
    })
    wiredPicklistValues({data,error}){
        if(data){
            this.error = undefined;
            if(Object.keys(data.controllerValues).length === 0){
                this.picklistValues = data.values;
            } else {
                const indices = [];
                const picklistValues = [];
                var controllerValue = this.controllerValue;
                Object.keys(data.controllerValues).map(function(key){
                    if(key == controllerValue){
                        indices.push(data.controllerValues[key]);
                    }
                });
                data.values.forEach((value) => {
                    value.validFor.forEach((valid) =>{
                        indices.forEach((index) => {
                            if(valid === index){
                                picklistValues.push(value);
                            }
                        });
                    });
                });
                this.picklistValues = picklistValues;
            }
            if(this.picklistValues.length === 0){
                this.disabled = true;
            }
            if(this.defaultValue === undefined){
                if(data.defaultValue != null){
                    this.defaultValue = data.defaultValue.value;
                }
            }
            this.cacheCheck();
        }
        if(error){
            this.picklistValues = undefined;
            this.error = error;
            this.defaultValue = undefined;
            console.log(this.error);
        }
    }
    
    connectedCallback(){
        this.cacheCheck();
    }

    handleChange(event){
        this.addToCache(event.detail.value);
    }

    cacheCheck(){
        let cachedSelection = sessionStorage.getItem(this.sessionStorageKey);
        if(this.defaultValue || cachedSelection){
            if(cachedSelection){
                this.addToCache(cachedSelection);
            } else {
                this.addToCache(this.defaultValue);
            }
        }
    }

    addToCache(selectedValue){
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedValue', selectedValue));
        sessionStorage.setItem(this.sessionStorageKey, selectedValue);
    }

    @api
    validate() {
    	let errorMessage = "Please select a choice.";
    	if (this.required === true && !this.selectedValue) {
    		return {
    			isValid: false,
    			errorMessage: errorMessage
    		};
    	}
    	return { isValid: true };
    }
}