import { LightningElement, wire, track, api } from 'lwc';
import{ getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import { FlowAttributeChangeEvent } from "lightning/flowSupport";
import { publish, subscribe, MessageContext } from 'lightning/messageService';
import PICKLIST_CHANNEL from '@salesforce/messageChannel/picklistImproved__c';

export default class WireGetPicklistValues extends LightningElement {
    @api defaultValue;
    @api interviewGuid;
    @api label;
    @api objectfieldApiName;
    @api required;
    @api selectedValue;

    @track controllerFieldApiName;
    @track error;
    @track helpTextToUse;
    @track mapPicklistValues;
    @track picklistValues;
    @track recordTypeIdToUse;

    get selectedValueStorageKey() {
        return this.interviewGuid+'selectedvalue';
    }

    get controllerValueStorageKey() {
        return this.interviewGuid+'controllervalue';
    }
    
    get objectApiName() {
        return this.objectfieldApiName.split('.')[0];
    }

    get fieldApiName() {
        return this.objectfieldApiName.split('.')[1];
    }

    _controllerValue = null;
    @api
    set controllerValue(value){
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

    @wire(MessageContext)
    messageContext;

    @wire(getObjectInfo, {
        objectApiName: '$objectApiName'
    })
    wiredGetObjectInfo({data}){
        if(data){
            console.log(data);
            if(this.recordTypeId){
                this.recordTypeIdToUse = this.recordTypeId;
            } else {
                this.recordTypeIdToUse = data.defaultRecordTypeId;
            }
            var helpTextToUse = null;
            var fieldApiName = this.fieldApiName;
            var helpText = this.helpText;
            var controllerFieldApiName = null
            Object.keys(data.fields).map(function(key){
                if(key == fieldApiName){
                    if(helpText){
                        helpTextToUse = helpText;
                    }
                    else if (data.fields[key].inlineHelpText != null) {
                        helpTextToUse = data.fields[key].inlineHelpText;
                    }
                    if(data.fields[key].controllerName != null){
                        controllerFieldApiName = data.fields[key].controllerName;
                    }
                }
            });
            this.helpTextToUse = helpTextToUse;
            this.controllerFieldApiName = controllerFieldApiName;
        }
    }
    
    
    @wire(getPicklistValues, {
        recordTypeId: '$recordTypeIdToUse',
        fieldApiName: '$objectfieldApiName'
    })
    wiredGetPicklistValues({data,error}){
        if(data){
            this.error = undefined;
            if(Object.keys(data.controllerValues).length === 0){
                this.constructPicklist(data.values);
            } else {
                const indices = [];
                const picklistValues = [];
                var controllerValue = this.controllerValue;
                const mapPicklist = new Map();
                Object.keys(data.controllerValues).map(function(key){
                    mapPicklist.set(key,[]);
                    if(key == controllerValue){
                        indices.push(data.controllerValues[key]);
                    }
                });
                data.values.forEach((value) => {
                    value.validFor.forEach((valid) =>{
                        var index = 0
                        for(let key of mapPicklist.keys()){
                            if(valid === index){
                                mapPicklist.get(key).push(value);
                            }
                            index++;
                        }
                        indices.forEach((index) => {
                            if(valid === index){
                                picklistValues.push(value);
                            }
                        });
                    });
                });
                this.mapPicklistValues = mapPicklist;
                this.constructPicklist(picklistValues);
            }
            if(this.defaultValue === undefined){
                if(data.defaultValue != null){
                    this.defaultValue = data.defaultValue.value;
                }
            }
            this.checkCache();
        }
        if(error){
            this.picklistValues = undefined;
            this.error = error;
            this.defaultValue = undefined;
            console.log(this.error);
        }
    }

    disabled;
    canRequire;
    constructPicklist(value){
        this.picklistValues = value;
        if(this.picklistValues.length === 0){
            this.disabled = true;
            this.canRequire = false;
            this.dispatchEvent(new FlowAttributeChangeEvent('selectedValue', undefined));
        } else {
            this.disabled = false;
            this.canRequire = true;
        }
    }
    
    connectedCallback(){
        this.checkCache();
        this.subscribeToMessageChannel();
    }

    handleChange(event){
        this.broadcast(event.detail.value);
    }

    checkCache(){
        let cachedSelectedValue = sessionStorage.getItem(this.selectedValueStorageKey);
        if(this.defaultValue || cachedSelectedValue){
            if(cachedSelectedValue){
                this.broadcast(cachedSelectedValue);
            } else {
                this.broadcast(this.defaultValue);
            }
        }

        let cachedControllerValue = sessionStorage.getItem(this.controllerValueStorageKey);
        if(cachedControllerValue){
            if(this.mapPicklistValues){
                this.constructPicklist(this.mapPicklistValues.get(cachedControllerValue));
            }
        }
    }

    broadcast(selectedValue){
        this.dispatchEvent(new FlowAttributeChangeEvent('selectedValue', selectedValue));

        sessionStorage.setItem(this.selectedValueStorageKey, selectedValue);

        const payload = {
            objectApiName: this.objectApiName,
            fieldApiName: this.fieldApiName,
            selectedvalue: selectedValue
        };
        publish(this.messageContext, PICKLIST_CHANNEL, payload);
    }

    subscription = null;
    subscribeToMessageChannel() {
        this.subscription = subscribe(
            this.messageContext,
            PICKLIST_CHANNEL,
            (message) => this.handleMessage(message)
        );
    }

    handleMessage(message) {
        if(message.objectApiName === this.objectApiName && message.fieldApiName === this.controllerFieldApiName && this.controllerValue === null){
            this.constructPicklist(this.mapPicklistValues.get(message.selectedvalue));
            sessionStorage.setItem(this.controllerValueStorageKey, message.selectedvalue);
        }
    }

    @api
    validate() {
    	let errorMessage = "Please select a choice.";
    	if (this.canRequire === true && this.required === true && !this.selectedValue) {
    		return {
    			isValid: false,
    			errorMessage: errorMessage
    		};
    	}
    	return { isValid: true };
    }
}