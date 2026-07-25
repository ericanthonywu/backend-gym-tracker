'use strict';

/**
 * Request body validator middleware factory using Joi schemas.
 *
 * @param {import('joi').ObjectSchema} schema
 * @returns {import('express').RequestHandler}
 *
 * @example
 *   router.post('/sessions/start', validate(startSchema), sessionController.start);
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      return res.status(400).json({ error: messages });
    }

    req.body = value;
    next();
  };
}

module.exports = validate;
