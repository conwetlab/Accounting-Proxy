/*
* Define the json in order to validate the administration requests
*/
var Joi = require('joi');
var schemas = {};

schemas.resource = Joi.object().keys({
	offering: Joi.object().keys({
		organization: Joi.string().min(1).required(),
		name: Joi.string().min(1).required(),
		version: Joi.string().min(1).required()
	}),
	provider: Joi.string().min(1).required(),
	name: Joi.string().min(1).required(),
	version: Joi.string().min(1).required(),
	content_type: Joi.string().min(1).required(),
	url: Joi.string().min(1).required(),
	record_type: Joi.string().min(1).required(),
	unit: Joi.string().min(1).required(),
	component_label: Joi.string().min(1).required()
});

schemas.offer = {
	offering: Joi.object().keys({
		organization: Joi.string().min(1).required(),
		name: Joi.string().min(1).required(),
		version: Joi.string().min(1).required()
	}),
	reference: Joi.string().min(1).required(),
	customer: Joi.string().min(1).required(),
	customer_name: Joi.string().min(1).required(),
	resources: Joi.array().required().items(
		Joi.object().keys({
			provider: Joi.string().min(1).required(),
			name: Joi.string().min(1).required(),
			version: Joi.string().min(1).required(),
			content_type: Joi.string().min(1).required(),
			url: Joi.string().min(1).required()
		})
	)
}

module.exports = schemas;